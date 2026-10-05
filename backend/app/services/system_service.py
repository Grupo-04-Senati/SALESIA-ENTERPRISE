"""Sistema: notificaciones y exportaciones de datos (BE-3 · docs/04 §2.4)."""

from __future__ import annotations

import csv
import io
from typing import Optional

from sqlalchemy import func, or_, select
from sqlalchemy.orm import Session

from app.core.exceptions import NotFound, ValidationAppError
from app.models.analytics_extra import DataExport
from app.models.customer import Customer
from app.models.inventory import Inventory
from app.models.product import Product
from app.models.quote import Quote
from app.models.sale import Sale
from app.models.sales_return import SalesReturn
from app.models.system import Notification, NotificationRead
from app.models.user import User
from app.schemas.system import DataExportCreate, NotificationCreate, NotificationsConfigData
from app.services import notification_bridge
from app.services.audit_service import write_audit
from app.services.event_service import log_app_event
from app.utils.helpers import clamp_page, paginate, utcnow


def _serialize(notification: Notification, read: bool = False) -> dict:
    return {
        'id': notification.id,
        'level': notification.level,
        'title': notification.title,
        'message': notification.message,
        'read_at': notification.read_at,
        'created_at': notification.created_at,
        'read': read,
        'module': notification.module,
        'entity': notification.entity,
        'entity_id': notification.entity_id,
        'link': notification.link,
        'target_role': notification.target_role,
        'group_id': notification.group_id,
        'detail': notification.detail or {},
        'actor_name': notification.actor_name,
    }


def _serialize_export(export: DataExport, requested_by_name: str = '') -> dict:
    return {
        'id': export.id,
        'export_type': export.export_type,
        'format': export.format,
        'status': export.status,
        'row_count': export.row_count,
        'requested_by_name': requested_by_name,
        'created_at': export.created_at,
    }


def _is_unread_flag(unread: str) -> bool:
    return str(unread).strip().lower() in ('true', '1', 'yes', 'si', 'sí')


def _visible_notifications(db: Session, company_id: int, actor: User) -> list[Notification]:
    """Notificaciones que el usuario puede ver: su rol + dirigidas a él."""
    from app.api.deps import role_display

    role = role_display(actor.role.name)
    statement = select(Notification).where(
        Notification.company_id == company_id,
        or_(Notification.user_id.is_(None), Notification.user_id == actor.id),
        or_(Notification.target_role.is_(None), Notification.target_role == role),
    )
    return list(db.execute(statement.order_by(Notification.id.desc())).scalars().all())


def _read_ids_for(db: Session, user_id: int, notification_ids: list[int]) -> set[int]:
    if not notification_ids:
        return set()
    rows = db.execute(
        select(NotificationRead.notification_id).where(
            NotificationRead.user_id == user_id,
            NotificationRead.notification_id.in_(notification_ids),
        )
    ).scalars()
    return set(rows)


def list_notifications(
    db: Session,
    company_id: int,
    *,
    actor: User,
    unread: str = '',
    page: int = 1,
    page_size: int = 20,
) -> dict:
    page, page_size = clamp_page(page, page_size)
    notifications = _visible_notifications(db, company_id, actor)
    read_ids = _read_ids_for(db, actor.id, [item.id for item in notifications])
    payload = [_serialize(item, item.id in read_ids) for item in notifications]
    if _is_unread_flag(unread):
        payload = [item for item in payload if not item['read']]
    return paginate(payload, page, page_size)


def get_notification(db: Session, company_id: int, notification_id: int, *, actor: User) -> dict:
    notifications = _visible_notifications(db, company_id, actor)
    match = next((item for item in notifications if item.id == notification_id), None)
    if match is None:
        raise NotFound('Notificación no encontrada.')
    return _serialize(match, match.id in _read_ids_for(db, actor.id, [match.id]))


def create_notification(
    db: Session, company_id: int, payload: NotificationCreate, actor=None, ip: Optional[str] = None
) -> dict:
    if payload.user_id is not None:
        target = db.execute(
            select(User).where(User.id == payload.user_id, User.company_id == company_id)
        ).scalar_one_or_none()
        if target is None:
            raise ValidationAppError('El usuario indicado no pertenece a la empresa.')

    notification = Notification(
        company_id=company_id,
        user_id=payload.user_id,
        level=payload.level,
        title=payload.title,
        message=payload.message,
        module=payload.module,
        link=payload.link,
        target_role=payload.target_role,
        detail=payload.detail,
        actor_name=actor.full_name if actor is not None else None,
    )
    db.add(notification)
    db.flush()
    write_audit(
        db,
        user=actor,
        action='notification.create',
        entity='notificaciones',
        entity_id=notification.id,
        detail={'title': payload.title, 'level': payload.level},
        ip_address=ip,
    )
    db.commit()
    return _serialize(notification, read=False)


def _mark_read_rows(db: Session, actor: User, notifications: list[Notification]) -> int:
    """Inserta las lecturas individuales pendientes. Devuelve cuántas marcó."""
    if not notifications:
        return 0
    read_ids = _read_ids_for(db, actor.id, [item.id for item in notifications])
    now = utcnow()
    marked = 0
    for item in notifications:
        if item.id in read_ids:
            continue
        db.add(
            NotificationRead(
                notification_id=item.id, user_id=actor.id, read_at=now
            )
        )
        if item.read_at is None:
            item.read_at = now
        marked += 1
    return marked


def mark_notification_read(
    db: Session, company_id: int, notification_id: int, actor=None, ip: Optional[str] = None
) -> dict:
    notifications = _visible_notifications(db, company_id, actor)
    notification = next((item for item in notifications if item.id == notification_id), None)
    if notification is None:
        raise NotFound('Notificación no encontrada.')

    marked = _mark_read_rows(db, actor, [notification])
    if marked:
        write_audit(
            db,
            user=actor,
            action='notification.read',
            entity='notificaciones',
            entity_id=notification.id,
            ip_address=ip,
        )
        db.commit()
    return _serialize(notification, read=True)


def mark_all_notifications_read(
    db: Session, company_id: int, actor=None, ip: Optional[str] = None
) -> dict:
    notifications = _visible_notifications(db, company_id, actor)
    marked = _mark_read_rows(db, actor, notifications)
    write_audit(
        db,
        user=actor,
        action='notification.read_all',
        entity='notificaciones',
        detail={'updated': marked},
        ip_address=ip,
    )
    db.commit()
    return {'updated': marked}


def notification_readers(
    db: Session, company_id: int, notification_id: int, *, actor: User
) -> dict:
    """Personal que ya leyó la notificación (agrupa las filas del mismo evento)."""
    notifications = _visible_notifications(db, company_id, actor)
    match = next((item for item in notifications if item.id == notification_id), None)
    if match is None:
        raise NotFound('Notificación no encontrada.')

    if match.group_id:
        ids = [
            item.id
            for item in db.execute(
                select(Notification).where(
                    Notification.company_id == company_id,
                    Notification.group_id == match.group_id,
                )
            ).scalars()
        ]
    else:
        ids = [match.id]

    rows = db.execute(
        select(NotificationRead, User)
        .join(User, User.id == NotificationRead.user_id)
        .where(NotificationRead.notification_id.in_(ids))
        .order_by(NotificationRead.read_at.asc())
    ).all()
    from app.api.deps import role_display

    return {
        'items': [
            {
                'user_id': user.id,
                'name': user.full_name,
                'role': role_display(user.role.name),
                'read_at': read.read_at,
            }
            for read, user in rows
        ]
    }


def export_notifications_csv(
    db: Session, company_id: int, *, actor: User
) -> tuple[str, str]:
    """CSV del historial visible para el usuario (para descargar y vaciar)."""
    from app.api.deps import role_display

    notifications = _visible_notifications(db, company_id, actor)
    read_ids = _read_ids_for(db, actor.id, [item.id for item in notifications])
    buffer = io.StringIO()
    writer = csv.writer(buffer)
    writer.writerow(
        ['id', 'fecha', 'nivel', 'modulo', 'titulo', 'mensaje', 'destinatario', 'autor', 'enlace', 'leido']
    )
    for item in notifications:
        writer.writerow(
            [
                item.id,
                item.created_at.isoformat() if item.created_at else '',
                item.level,
                item.module or '',
                item.title,
                item.message,
                role_display(item.target_role) if item.target_role else 'Todos',
                item.actor_name or '',
                item.link or '',
                'sí' if item.id in read_ids else 'no',
            ]
        )
    filename = f'notificaciones-{utcnow().date().isoformat()}.csv'
    return buffer.getvalue(), filename


def delete_notification(
    db: Session, company_id: int, notification_id: int, actor=None, ip: Optional[str] = None
) -> dict:
    notification = db.execute(
        select(Notification).where(
            Notification.id == notification_id, Notification.company_id == company_id
        )
    ).scalar_one_or_none()
    if notification is None:
        raise NotFound('Notificación no encontrada.')

    write_audit(
        db,
        user=actor,
        action='notification.delete',
        entity='notificaciones',
        entity_id=notification.id,
        ip_address=ip,
    )
    db.execute(
        NotificationRead.__table__.delete().where(
            NotificationRead.notification_id == notification.id
        )
    )
    db.delete(notification)
    db.commit()
    return {'id': notification_id, 'deleted': True}


def clear_notifications(
    db: Session, company_id: int, actor=None, ip: Optional[str] = None
) -> dict:
    """Vaciar el historial (tras exportarlo a CSV, desde Configuración)."""
    notifications = list(
        db.execute(
            select(Notification).where(Notification.company_id == company_id)
        ).scalars().all()
    )
    deleted = len(notifications)
    for item in notifications:
        db.execute(
            NotificationRead.__table__.delete().where(
                NotificationRead.notification_id == item.id
            )
        )
        db.delete(item)
    write_audit(
        db,
        user=actor,
        action='notification.clear',
        entity='notificaciones',
        detail={'deleted': deleted},
        ip_address=ip,
    )
    db.commit()
    return {'deleted': deleted}


def get_notifications_config(db: Session, company_id: int) -> dict:
    return notification_bridge.modules_config_response(db, company_id)


def update_notifications_config(
    db: Session, company_id: int, payload: NotificationsConfigData, actor=None, ip: Optional[str] = None
) -> dict:
    from app.api.deps import ROLE_DISPLAY

    allowed_roles = set(ROLE_DISPLAY.values())
    for key, roles in payload.modules.items():
        for role in roles:
            if role not in allowed_roles:
                raise ValidationAppError(f'Rol desconocido: {role}.')
    try:
        config = notification_bridge.save_modules_config(db, company_id, payload.modules)
    except ValueError as exc:
        raise ValidationAppError(str(exc)) from exc
    write_audit(
        db,
        user=actor,
        action='notification.config',
        entity='notificaciones',
        detail={'modules': config},
        ip_address=ip,
    )
    db.commit()
    return notification_bridge.modules_config_response(db, company_id)


def _count_export_rows(db: Session, company_id: int, export_type: str) -> int:
    """Filas reales del tipo de exportación dentro de la empresa."""
    if export_type == 'sales':
        statement = select(func.count(Sale.id)).where(
            Sale.company_id == company_id, Sale.status != 'cancelled'
        )
    elif export_type == 'products':
        statement = select(func.count(Product.id)).where(Product.company_id == company_id)
    elif export_type == 'customers':
        statement = select(func.count(Customer.id)).where(Customer.company_id == company_id)
    elif export_type == 'inventory':
        statement = (
            select(func.count(Inventory.id))
            .join(Product, Inventory.product_id == Product.id)
            .where(Product.company_id == company_id)
        )
    elif export_type == 'returns':
        statement = select(func.count(SalesReturn.id)).where(SalesReturn.company_id == company_id)
    elif export_type == 'quotes':
        statement = select(func.count(Quote.id)).where(Quote.company_id == company_id)
    else:
        raise ValidationAppError(f'Tipo de exportación no soportado: {export_type}.')

    return int(db.execute(statement).scalar_one() or 0)


def list_data_exports(
    db: Session, company_id: int, *, page: int = 1, page_size: int = 20
) -> dict:
    page, page_size = clamp_page(page, page_size)
    rows = db.execute(
        select(DataExport, User.full_name)
        .outerjoin(User, DataExport.requested_by == User.id)
        .where(DataExport.company_id == company_id)
        .order_by(DataExport.id.desc())
    ).all()
    payload = [_serialize_export(export, name or '') for export, name in rows]
    return paginate(payload, page, page_size)


def get_data_export(db: Session, company_id: int, export_id: int) -> dict:
    row = db.execute(
        select(DataExport, User.full_name)
        .outerjoin(User, DataExport.requested_by == User.id)
        .where(DataExport.id == export_id, DataExport.company_id == company_id)
    ).first()
    if row is None:
        raise NotFound('Exportación no encontrada.')
    return _serialize_export(row[0], row[1] or '')


def create_data_export(
    db: Session, company_id: int, payload: DataExportCreate, actor=None, ip: Optional[str] = None
) -> dict:
    export = DataExport(
        company_id=company_id,
        export_type=payload.export_type,
        format=payload.format,
        status='pending',
        requested_by=actor.id if actor else None,
    )
    db.add(export)
    db.flush()

    export.row_count = _count_export_rows(db, company_id, payload.export_type)
    export.status = 'completed'
    log_app_event(
        db,
        event_type='data.exported',
        company_id=company_id,
        entity='exportaciones_datos',
        entity_id=export.id,
        payload={'export_type': payload.export_type, 'row_count': export.row_count},
    )

    write_audit(
        db,
        user=actor,
        action='export.create',
        entity='exportaciones_datos',
        entity_id=export.id,
        detail={
            'export_type': payload.export_type,
            'format': payload.format,
            'row_count': export.row_count,
        },
        ip_address=ip,
    )
    db.commit()
    return _serialize_export(export, actor.full_name if actor else '')


def delete_data_export(
    db: Session, company_id: int, export_id: int, actor=None, ip: Optional[str] = None
) -> dict:
    export = db.execute(
        select(DataExport).where(DataExport.id == export_id, DataExport.company_id == company_id)
    ).scalar_one_or_none()
    if export is None:
        raise NotFound('Exportación no encontrada.')

    write_audit(
        db,
        user=actor,
        action='export.delete',
        entity='exportaciones_datos',
        entity_id=export.id,
        ip_address=ip,
    )
    db.delete(export)
    db.commit()
    return {'id': export_id, 'deleted': True}
