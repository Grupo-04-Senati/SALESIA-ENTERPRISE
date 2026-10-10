"""Notificaciones automáticas por módulo y rol (puente auditoría → campana).

Cada cambio registrado con ``write_audit`` genera notificaciones visibles para
los roles configurados del módulo afectado. La configuración por empresa vive
en ``ajustes_sistema`` con la clave ``notif_modules`` y puede sobrescribir los
destinatarios por defecto (``PUT /notifications/config``).
"""

from __future__ import annotations

import logging
import uuid
from typing import Optional

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.audit_log import AuditLog
from app.models.system import Notification, SystemSetting
from app.models.user import User

logger = logging.getLogger('salesia.notifications')

CONFIG_KEY = 'notif_modules'

ROLES_OPERACION = ('Admin', 'Gerente', 'Vendedor')
ROLES_ALMACEN = ('Admin', 'Gerente', 'Almacén')
ROLES_EQUIPO = ('Admin', 'Gerente')
ROLES_UNICO = ('Admin',)

# entity audit → (clave de módulo, etiqueta, ruta, roles por defecto)
ENTITY_MODULES: dict[str, tuple[str, str, str, tuple[str, ...]]] = {
    'products': ('productos', 'Productos', '/productos', ROLES_ALMACEN),
    'categories': ('categorias', 'Categorías', '/categorias', ROLES_ALMACEN),
    'unidades': ('productos', 'Productos', '/productos', ROLES_ALMACEN),
    'inventory_movements': ('inventario', 'Inventario', '/inventario', ROLES_ALMACEN),
    'stock_almacenes': ('inventario', 'Inventario', '/inventario', ROLES_ALMACEN),
    'conteos_stock': ('inventario', 'Inventario', '/inventario', ROLES_ALMACEN),
    'almacenes': ('inventario', 'Inventario', '/inventario', ROLES_ALMACEN),
    'sales': ('ventas', 'Ventas', '/ventas', ROLES_OPERACION),
    'payments': ('ventas', 'Ventas', '/ventas', ROLES_OPERACION),
    'customers': ('clientes', 'Clientes', '/clientes', ROLES_OPERACION),
    'segmentos_clientes': ('clientes', 'Clientes', '/clientes', ROLES_OPERACION),
    'interacciones_clientes': ('clientes', 'Clientes', '/clientes', ROLES_OPERACION),
    'employees': ('vendedores', 'Vendedores', '/vendedores', ROLES_EQUIPO),
    'cotizaciones': ('cotizaciones', 'Cotizaciones', '/cotizaciones', ROLES_OPERACION),
    'proveedores': ('compras', 'Compras', '/compras', ROLES_ALMACEN),
    'ordenes_compra': ('compras', 'Compras', '/compras', ROLES_ALMACEN),
    'envios': ('compras', 'Compras', '/compras', ROLES_ALMACEN),
    'devoluciones': ('devoluciones', 'Devoluciones', '/devoluciones', ROLES_OPERACION),
    'listas_precios': ('precios', 'Precios', '/precios', ROLES_EQUIPO),
    'promociones': ('precios', 'Precios', '/precios', ROLES_EQUIPO),
    'users': ('configuracion', 'Configuración', '/configuracion', ROLES_EQUIPO),
    'sucursales': ('configuracion', 'Configuración', '/configuracion', ROLES_EQUIPO),
    'system': ('configuracion', 'Configuración', '/configuracion', ROLES_UNICO),
    'reportes_programados': ('reportes', 'Reportes', '/reportes', ROLES_EQUIPO),
    'exportaciones_datos': ('reportes', 'Reportes', '/reportes', ROLES_EQUIPO),
    'instantaneas_kpi': ('analytics', 'Analytics', '/analytics', ('Admin', 'Gerente', 'Analista')),
    'reglas_automatizacion': ('automatizaciones', 'Automatizaciones', '/automatizaciones', ROLES_UNICO),
}

# Acciones que no son cambios de módulo (evitan bucles y ruido).
EXCLUDED_ACTIONS = frozenset(
    {
        'auth.login',
        'auth.logout',
        'notification.create',
        'notification.read',
        'notification.read_all',
        'notification.delete',
    }
)

_SUBJECTS = {
    'product': 'Producto',
    'sale': 'Venta',
    'customer': 'Cliente',
    'quote': 'Cotización',
    'category': 'Categoría',
    'supplier': 'Proveedor',
    'employee': 'Empleado',
    'user': 'Usuario',
    'branch': 'Sucursal',
    'warehouse': 'Almacén',
    'inventory': 'Movimiento de inventario',
    'payment': 'Pago',
    'price_list': 'Lista de precios',
    'promotion': 'Promoción',
    'purchase_order': 'Orden de compra',
    'return': 'Devolución',
    'shipment': 'Envío',
    'segment': 'Segmento',
    'interaction': 'Interacción',
    'unit': 'Unidad',
    'stock_count': 'Conteo de stock',
    'export': 'Exportación',
    'scheduled_report': 'Reporte programado',
    'automation_rule': 'Regla de automatización',
    'kpi_snapshot': 'Instantánea de KPI',
    'auth': 'Cuenta de usuario',
}

_VERBS = {
    'create': 'creado',
    'update': 'actualizado',
    'delete': 'eliminado',
    'status': 'actualizado (estado)',
    'movement': 'registrado',
    'payment': 'registrado',
    'cancel': 'cancelado',
    'convert': 'convertido a venta',
    'approve': 'aprobado',
    'confirm': 'confirmado',
    'items': 'actualizado',
    'profile_update': 'actualizado (perfil)',
    'deactivate': 'desactivado',
    'password_change': 'actualizada (contraseña)',
    'password_reset': 'restablecida (contraseña)',
    'receive': 'marcado como recibido',
    'unreceive': 'desmarcado como recibido',
}

_WARNING_SUFFIXES = ('delete', 'cancel', 'deactivate')


def default_modules_config() -> dict[str, list[str]]:
    """Config por defecto: módulo → roles receptores (lista vacía = apagado)."""
    config: dict[str, list[str]] = {}
    for module_key, _label, _link, roles in ENTITY_MODULES.values():
        config.setdefault(module_key, list(roles))
    return dict(sorted(config.items()))


def _modules_meta() -> list[dict]:
    seen: dict[str, tuple[str, str]] = {}
    for module_key, label, link, roles in ENTITY_MODULES.values():
        seen.setdefault(module_key, (label, link))
    defaults = default_modules_config()
    return [
        {'key': key, 'label': label, 'link': link, 'roles': defaults.get(key, [])}
        for key, (label, link) in sorted(seen.items())
    ]


def load_modules_config(db: Session, company_id: int) -> dict[str, list[str]]:
    """Roles configurados por empresa (claves conocidas; fusiona con defaults)."""
    config = default_modules_config()
    row = db.execute(
        select(SystemSetting).where(
            SystemSetting.company_id == company_id, SystemSetting.key == CONFIG_KEY
        )
    ).scalar_one_or_none()
    overrides = ((row.value or {}).get('modules')) if row and row.value else None
    if isinstance(overrides, dict):
        for key, roles in overrides.items():
            if key in config and isinstance(roles, list):
                config[key] = [str(role) for role in roles]
    return config


def save_modules_config(db: Session, company_id: int, modules: dict[str, list[str]]) -> dict:
    """Guarda (o reemplaza) la configuración de destinatarios por módulo."""
    config = default_modules_config()
    for key, roles in modules.items():
        if key not in config:
            raise ValueError(f'Módulo desconocido: {key}')
        if not isinstance(roles, list):
            raise ValueError(f'Roles inválidos para {key}.')
        config[key] = [str(role) for role in roles]

    row = db.execute(
        select(SystemSetting).where(
            SystemSetting.company_id == company_id, SystemSetting.key == CONFIG_KEY
        )
    ).scalar_one_or_none()
    if row is None:
        row = SystemSetting(company_id=company_id, key=CONFIG_KEY, value={'modules': config})
        db.add(row)
    else:
        row.value = {'modules': config}
    db.flush()
    return config


def modules_config_response(db: Session, company_id: int) -> dict:
    """GET /notifications/config → matriz completa para la UI."""
    config = load_modules_config(db, company_id)
    return {
        'modules': [
            {**meta, 'roles': config.get(meta['key'], [])}
            for meta in _modules_meta()
        ]
    }


def _human_message(action: str, entity_id: Optional[int], actor_name: str) -> str:
    parts = (action or '').split('.')
    subject = _SUBJECTS.get(parts[0], 'Registro')
    verb = _VERBS.get(parts[1] if len(parts) > 1 else '', 'modificado')
    message = f'{subject} {verb}'
    if entity_id:
        message += f' (registro #{entity_id})'
    if actor_name:
        message += f' · por {actor_name}'
    return message


def notify_from_audit(db: Session, *, entry: AuditLog, actor: Optional[User]) -> None:
    """Crea las notificaciones de un cambio. Nunca lanza excepciones."""
    try:
        action = entry.action or ''
        if action in EXCLUDED_ACTIONS or entry.company_id is None:
            return
        mapping = ENTITY_MODULES.get(entry.entity or '')
        if mapping is None:
            return
        module_key, label, link, default_roles = mapping
        roles = load_modules_config(db, entry.company_id).get(module_key, list(default_roles))
        if not roles:
            return

        actor_name = actor.full_name if actor is not None else ''
        level = 'warning' if action.split('.')[-1] in _WARNING_SUFFIXES else 'info'
        detail = {'action': action}
        if entry.entity:
            detail['entity'] = entry.entity
        if entry.entity_id:
            detail['entity_id'] = entry.entity_id
        if actor_name:
            detail['actor'] = actor_name
        if entry.detail:
            detail.update(entry.detail)

        group_id = uuid.uuid4().hex
        for role in roles:
            db.add(
                Notification(
                    company_id=entry.company_id,
                    user_id=None,
                    level=level,
                    title=f'Cambios en {label}',
                    message=_human_message(action, entry.entity_id, actor_name),
                    module=module_key,
                    entity=entry.entity,
                    entity_id=entry.entity_id,
                    link=link,
                    target_role=role,
                    group_id=group_id,
                    detail=detail,
                    actor_name=actor_name or None,
                )
            )
        db.flush()
    except Exception:  # noqa: BLE001 — la notificación jamás rompe el cambio
        logger.exception('No se pudieron crear notificaciones para audit id=%s', getattr(entry, 'id', None))
