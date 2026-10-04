"""Sistema: notificaciones y exportaciones de datos (BE-3 · docs/04 §2.4)."""

from __future__ import annotations

from typing import Optional

from sqlalchemy import func, select, update
from sqlalchemy.orm import Session

from app.core.exceptions import NotFound, ValidationAppError
from app.models.analytics_extra import DataExport
from app.models.customer import Customer
from app.models.inventory import Inventory
from app.models.product import Product
from app.models.quote import Quote
from app.models.sale import Sale
from app.models.sales_return import SalesReturn
from app.models.system import Notification
from app.models.user import User
from app.schemas.system import DataExportCreate, NotificationCreate
from app.services.audit_service import write_audit
from app.services.event_service import log_app_event
from app.utils.helpers import clamp_page, paginate, utcnow


def _serialize(notification: Notification) -> dict:
    return {
        'id': notification.id,
        'level': notification.level,
        'title': notification.title,
        'message': notification.message,
        'read_at': notification.read_at,
        'created_at': notification.created_at,
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


def list_notifications(
    db: Session,
    company_id: int,
    *,
    unread: str = '',
    page: int = 1,
    page_size: int = 20,
) -> dict:
    page, page_size = clamp_page(page, page_size)
    statement = select(Notification).where(Notification.company_id == company_id)

    if _is_unread_flag(unread):
        statement = statement.where(Notification.read_at.is_(None))

    notifications = db.execute(
        statement.order_by(Notification.id.desc())
    ).scalars().all()
    payload = [_serialize(notification) for notification in notifications]
    return paginate(payload, page, page_size)


def get_notification(db: Session, company_id: int, notification_id: int) -> dict:
    notification = db.execute(
        select(Notification).where(
            Notification.id == notification_id, Notification.company_id == company_id
        )
    ).scalar_one_or_none()
    if notification is None:
        raise NotFound('Notificación no encontrada.')
    return _serialize(notification)


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
    return _serialize(notification)


def mark_notification_read(
    db: Session, company_id: int, notification_id: int, actor=None, ip: Optional[str] = None
) -> dict:
    notification = db.execute(
        select(Notification).where(
            Notification.id == notification_id, Notification.company_id == company_id
        )
    ).scalar_one_or_none()
    if notification is None:
        raise NotFound('Notificación no encontrada.')

    if notification.read_at is None:
        notification.read_at = utcnow()
        write_audit(
            db,
            user=actor,
            action='notification.read',
            entity='notificaciones',
            entity_id=notification.id,
            ip_address=ip,
        )
        db.commit()
    return _serialize(notification)


def mark_all_notifications_read(
    db: Session, company_id: int, actor=None, ip: Optional[str] = None
) -> dict:
    result = db.execute(
        update(Notification)
        .where(Notification.company_id == company_id, Notification.read_at.is_(None))
        .values(read_at=utcnow())
    )
    updated = int(result.rowcount or 0)
    write_audit(
        db,
        user=actor,
        action='notification.read_all',
        entity='notificaciones',
        detail={'updated': updated},
        ip_address=ip,
    )
    db.commit()
    return {'updated': updated}


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
    db.delete(notification)
    db.commit()
    return {'id': notification_id, 'deleted': True}


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
