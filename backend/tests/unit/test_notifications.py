"""Notificaciones automáticas: puente auditoría→campana, visibilidad y utilidades."""

from __future__ import annotations

import pytest
from sqlalchemy import BigInteger, create_engine
from sqlalchemy.ext.compiler import compiles
from sqlalchemy.orm import sessionmaker

from app.core.database import Base
from app.models.audit_log import AuditLog
from app.models.company import Company
from app.models.role import Role
from app.models.system import Notification, NotificationRead, SystemSetting
from app.models.user import User
from app.schemas.system import NotificationCreate, NotificationsConfigData
from app.services import notification_bridge, system_service


@compiles(BigInteger, 'sqlite')
def _sqlite_integer_pk(type_, compiler, **kw):
    # SQLite solo autoincrementa INTEGER PRIMARY KEY (BIGINT no es rowid alias).
    return 'INTEGER'

# roles/registros_auditoria usan JSONB (solo PostgreSQL): se crean a mano con
# columnas TEXT para que el dialecto SQLite de las unitarias los acepte.
_DDL_MANUAL = (
    'CREATE TABLE roles (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT UNIQUE, '
    'description TEXT, permissions TEXT, created_at DATETIME)',
    'CREATE TABLE registros_auditoria (id INTEGER PRIMARY KEY AUTOINCREMENT, '
    'company_id BIGINT, user_id BIGINT, action TEXT, entity TEXT, entity_id BIGINT, '
    'detail TEXT, ip_address TEXT, created_at DATETIME)',
)


@pytest.fixture()
def session():
    engine = create_engine('sqlite://')
    Base.metadata.create_all(
        engine,
        tables=[
            Notification.__table__,
            NotificationRead.__table__,
            SystemSetting.__table__,
            User.__table__,
            Company.__table__,
        ],
    )
    with engine.begin() as connection:
        for statement in _DDL_MANUAL:
            connection.exec_driver_sql(statement)
    yield sessionmaker(bind=engine)()
    engine.dispose()


def _user(session, *, name: str, role: str, email: str) -> User:
    role_row = session.query(Role).filter_by(name=role).one_or_none()
    if role_row is None:
        role_row = Role(name=role, permissions={})
        session.add(role_row)
        session.flush()
    user = User(
        company_id=1,
        role_id=role_row.id,
        full_name=name,
        email=email,
        password_hash='x',
    )
    session.add(user)
    session.commit()
    return user


def _audit(*, action: str, entity: str, entity_id: int | None = 12) -> AuditLog:
    return AuditLog(
        company_id=1,
        action=action,
        entity=entity,
        entity_id=entity_id,
        detail={'campo': 'valor'},
    )


def test_puente_crea_notificaciones_por_rol(session):
    admin = _user(session, name='Ana Admin', role='admin', email='a@x.com')
    notification_bridge.notify_from_audit(
        session, entry=_audit(action='product.update', entity='products'), actor=admin
    )
    session.flush()

    rows = session.query(Notification).all()
    assert len(rows) == 3
    assert {row.target_role for row in rows} == {'Admin', 'Gerente', 'Almacén'}
    assert {row.title for row in rows} == {'Cambios en Productos'}
    assert {row.module for row in rows} == {'productos'}
    assert {row.link for row in rows} == {'/productos'}
    assert len({row.group_id for row in rows}) == 1
    assert rows[0].level == 'info'
    assert 'Producto actualizado (registro #12)' in rows[0].message
    assert rows[0].detail['action'] == 'product.update'
    assert rows[0].actor_name == 'Ana Admin'


def test_puente_nivel_warning_en_cancelaciones(session):
    admin = _user(session, name='Ana Admin', role='admin', email='a@x.com')
    notification_bridge.notify_from_audit(
        session, entry=_audit(action='sale.cancel', entity='sales', entity_id=7), actor=admin
    )
    session.flush()
    row = session.query(Notification).first()
    assert row is not None
    assert row.title == 'Cambios en Ventas'
    assert row.level == 'warning'
    assert row.target_role in {'Admin', 'Gerente', 'Vendedor'}


def test_puente_ignora_login_y_entidades_desconocidas(session):
    admin = _user(session, name='Ana Admin', role='admin', email='a@x.com')
    notification_bridge.notify_from_audit(
        session, entry=_audit(action='auth.login', entity='sales'), actor=admin
    )
    notification_bridge.notify_from_audit(
        session, entry=_audit(action='algo.create', entity='inexistente'), actor=admin
    )
    session.flush()
    assert session.query(Notification).count() == 0


def test_config_empresa_sobrescribe_roles(session):
    saved = notification_bridge.save_modules_config(session, 1, {'productos': ['Admin']})
    assert saved['productos'] == ['Admin'] and 'ventas' in saved
    admin = _user(session, name='Ana Admin', role='admin', email='a@x.com')
    notification_bridge.notify_from_audit(
        session, entry=_audit(action='product.create', entity='products'), actor=admin
    )
    session.flush()
    rows = session.query(Notification).all()
    assert len(rows) == 1
    assert rows[0].target_role == 'Admin'

    notification_bridge.save_modules_config(session, 1, {'productos': []})
    notification_bridge.notify_from_audit(
        session, entry=_audit(action='product.create', entity='products'), actor=admin
    )
    session.flush()
    assert session.query(Notification).count() == 1  # módulo apagado


def test_config_rechaza_modulo_desconocido(session):
    with pytest.raises(ValueError):
        notification_bridge.save_modules_config(session, 1, {'no_existe': ['Admin']})


def test_list_filtrado_por_rol_y_leitura(session):
    admin = _user(session, name='Ana Admin', role='admin', email='a@x.com')
    vendedor = _user(session, name='Vic Vendedor', role='vendedor', email='v@x.com')

    for action, entity in (('product.update', 'products'), ('sale.create', 'sales')):
        notification_bridge.notify_from_audit(
            session, entry=_audit(action=action, entity=entity, entity_id=1), actor=admin
        )
    session.flush()
    products_rows = session.query(Notification).filter_by(module='productos').all()
    sales_rows = session.query(Notification).filter_by(module='ventas').all()

    # Cada evento crea una fila por rol: el vendedor solo ve las suyas (target 'Vendedor'),
    # nunca las de almacén/productos.
    payload = system_service.list_notifications(session, 1, actor=vendedor)
    visible_ids = {item['id'] for item in payload['items']}
    expected = {row.id for row in sales_rows if row.target_role == 'Vendedor'}
    assert expected and visible_ids == expected
    assert visible_ids.isdisjoint({row.id for row in products_rows})
    assert all(item['read'] is False for item in payload['items'])

    # El vendedor marca la suya como leída → su bandera cambia.
    own_row = next(row for row in sales_rows if row.target_role == 'Vendedor')
    system_service.mark_notification_read(session, 1, own_row.id, actor=vendedor)
    payload = system_service.list_notifications(session, 1, actor=vendedor)
    by_id = {item['id']: item['read'] for item in payload['items']}
    assert by_id[own_row.id] is True

    # El admin ve las suyas (target 'Admin' de ambos eventos) y siguen no leídas
    # (la lectura es individual por usuario).
    admin_payload = system_service.list_notifications(session, 1, actor=admin)
    admin_ids = {item['id'] for item in admin_payload['items']}
    assert admin_ids == {row.id for row in products_rows + sales_rows if row.target_role == 'Admin'}
    assert all(item['read'] is False for item in admin_payload['items'])

    # Filtro unread solo devuelve no leídas para ese usuario.
    unread = system_service.list_notifications(session, 1, actor=vendedor, unread='true')
    assert unread['total'] == 0


def test_lectores_agrupados_por_evento(session):
    admin = _user(session, name='Ana Admin', role='admin', email='a@x.com')
    gerente = _user(session, name='Gus Gerente', role='gerente', email='g@x.com')
    notification_bridge.notify_from_audit(
        session, entry=_audit(action='product.update', entity='products'), actor=admin
    )
    session.flush()
    rows = session.query(Notification).all()
    assert len(rows) == 3

    system_service.mark_notification_read(session, 1, rows[0].id, actor=admin)
    system_service.mark_notification_read(session, 1, rows[1].id, actor=gerente)

    readers = system_service.notification_readers(session, 1, rows[0].id, actor=admin)
    names = {item['name'] for item in readers['items']}
    assert names == {'Ana Admin', 'Gus Gerente'}
    roles = {item['role'] for item in readers['items']}
    assert roles == {'Admin', 'Gerente'}


def test_marcar_todas_es_individual(session):
    admin = _user(session, name='Ana Admin', role='admin', email='a@x.com')
    notification_bridge.notify_from_audit(
        session, entry=_audit(action='product.update', entity='products'), actor=admin
    )
    # Una notificación sin target_role es visible para todos los roles.
    system_service.create_notification(
        session,
        1,
        NotificationCreate(
            title='Aviso general',
            message='Recordatorio de cierre.',
            module='configuracion',
            link='/configuracion',
        ),
        actor=admin,
    )
    session.flush()

    first = system_service.mark_all_notifications_read(session, 1, actor=admin)
    # Solo la fila con target 'Admin' + la general son visibles para el admin.
    assert first['updated'] == 2
    second = system_service.mark_all_notifications_read(session, 1, actor=admin)
    assert second['updated'] == 0


def test_export_csv_y_vaciado(session):
    admin = _user(session, name='Ana Admin', role='admin', email='a@x.com')
    notification_bridge.notify_from_audit(
        session, entry=_audit(action='product.update', entity='products'), actor=admin
    )
    session.flush()

    content, filename = system_service.export_notifications_csv(session, 1, actor=admin)
    assert filename.startswith('notificaciones-') and filename.endswith('.csv')
    assert 'titulo' in content.splitlines()[0]
    assert 'Cambios en Productos' in content

    result = system_service.clear_notifications(session, 1, actor=admin)
    assert result['deleted'] == 3
    assert session.query(Notification).count() == 0


def test_create_manual_guarda_origen_y_autor(session):
    admin = _user(session, name='Ana Admin', role='admin', email='a@x.com')
    payload = NotificationCreate(
        title='Cierre de caja pendiente',
        message='Recuerda registrar los ingresos del turno.',
        level='warning',
        module='ventas',
        link='/ventas',
    )
    created = system_service.create_notification(session, 1, payload, actor=admin)
    assert created['module'] == 'ventas'
    assert created['link'] == '/ventas'
    assert created['actor_name'] == 'Ana Admin'
    assert created['read'] is False


def test_config_get_devuelve_matriz_completa(session):
    response = system_service.get_notifications_config(session, 1)
    keys = {module['key'] for module in response['modules']}
    assert {'productos', 'ventas', 'clientes', 'inventario', 'configuracion'} <= keys
    for module in response['modules']:
        assert isinstance(module['roles'], list)
        assert module['label'] and module['link'].startswith('/')

    updated = system_service.update_notifications_config(
        session,
        1,
        NotificationsConfigData(modules={'ventas': ['Gerente', 'Vendedor']}),
        actor=_user(session, name='Ana Admin', role='admin', email='a@x.com'),
    )
    roles_by_key = {module['key']: module['roles'] for module in updated['modules']}
    assert roles_by_key['ventas'] == ['Gerente', 'Vendedor']
