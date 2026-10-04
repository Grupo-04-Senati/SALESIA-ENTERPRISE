"""Envíos de ventas: alta, estados y seguimiento (BE-1)."""

from __future__ import annotations

from datetime import datetime, timezone
from typing import Optional

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.exceptions import Conflict, NotFound, ValidationAppError
from app.models.sale import Sale
from app.models.warehouse import Shipment
from app.schemas.shipments import ShipmentCreate, ShipmentStatusUpdate, ShipmentUpdate
from app.services.audit_service import write_audit
from app.utils.helpers import clamp_page, paginate

SHIPMENT_STATUSES = ('pending', 'shipped', 'delivered', 'cancelled')


def _serialize(shipment: Shipment, sale_number: str) -> dict:
    return {
        'id': shipment.id,
        'sale_id': shipment.sale_id,
        'sale_number': sale_number,
        'carrier': shipment.carrier,
        'tracking_code': shipment.tracking_code,
        'status': shipment.status,
        'shipped_at': shipment.shipped_at,
        'created_at': shipment.created_at,
    }


def _get(db: Session, company_id: int, shipment_id: int) -> tuple[Shipment, str]:
    row = db.execute(
        select(Shipment, Sale.sale_number)
        .join(Sale, Sale.id == Shipment.sale_id)
        .where(Shipment.id == shipment_id, Shipment.company_id == company_id)
    ).first()
    if row is None:
        raise NotFound('Envío no encontrado.')
    return row[0], row[1]


def _validate_sale(db: Session, company_id: int, sale_id: int) -> Sale:
    sale = db.execute(
        select(Sale).where(Sale.id == sale_id, Sale.company_id == company_id)
    ).scalar_one_or_none()
    if sale is None:
        raise NotFound('Venta no encontrada.')
    return sale


def _validate_status(status_value: str) -> None:
    if status_value not in SHIPMENT_STATUSES:
        raise ValidationAppError('Estado no válido: use pending, shipped, delivered o cancelled.')


def _duplicated_tracking(
    db: Session, company_id: int, tracking_code: Optional[str], shipment_id: Optional[int] = None
) -> bool:
    if not tracking_code:
        return False
    statement = select(Shipment).where(
        Shipment.company_id == company_id, Shipment.tracking_code == tracking_code
    )
    if shipment_id:
        statement = statement.where(Shipment.id != shipment_id)
    return db.execute(statement).scalar_one_or_none() is not None


def _apply_status(shipment: Shipment, status_value: str) -> None:
    shipment.status = status_value
    if status_value == 'shipped' and shipment.shipped_at is None:
        shipment.shipped_at = datetime.now(timezone.utc)


def list_shipments(
    db: Session,
    company_id: int,
    *,
    status: str = '',
    page: int = 1,
    page_size: int = 20,
) -> dict:
    page, page_size = clamp_page(page, page_size)
    statement = (
        select(Shipment, Sale.sale_number)
        .join(Sale, Sale.id == Shipment.sale_id)
        .where(Shipment.company_id == company_id)
    )
    if status:
        statement = statement.where(Shipment.status == status)

    rows = db.execute(statement.order_by(Shipment.id.desc())).all()
    payload = [_serialize(row[0], row[1]) for row in rows]
    return paginate(payload, page, page_size)


def get_shipment(db: Session, company_id: int, shipment_id: int) -> dict:
    shipment, sale_number = _get(db, company_id, shipment_id)
    return _serialize(shipment, sale_number)


def create_shipment(
    db: Session, company_id: int, payload: ShipmentCreate, actor=None, ip: Optional[str] = None
) -> dict:
    sale = _validate_sale(db, company_id, payload.sale_id)
    _validate_status(payload.status)
    if _duplicated_tracking(db, company_id, payload.tracking_code):
        raise Conflict('Ya existe un envío con ese código de rastreo.')

    shipment = Shipment(
        company_id=company_id,
        sale_id=sale.id,
        carrier=payload.carrier,
        tracking_code=payload.tracking_code,
        status=payload.status,
    )
    _apply_status(shipment, shipment.status)
    db.add(shipment)
    db.flush()

    write_audit(
        db,
        user=actor,
        action='shipment.create',
        entity='envios',
        entity_id=shipment.id,
        detail={'sale_id': sale.id, 'tracking_code': shipment.tracking_code},
        ip_address=ip,
    )
    db.commit()
    return _serialize(shipment, sale.sale_number)


def update_shipment(
    db: Session,
    company_id: int,
    shipment_id: int,
    payload: ShipmentUpdate,
    actor=None,
    ip: Optional[str] = None,
) -> dict:
    shipment, _sale_number = _get(db, company_id, shipment_id)
    sale = _validate_sale(db, company_id, payload.sale_id)
    _validate_status(payload.status)
    if _duplicated_tracking(db, company_id, payload.tracking_code, shipment_id):
        raise Conflict('Ya existe un envío con ese código de rastreo.')

    shipment.sale_id = sale.id
    shipment.carrier = payload.carrier
    shipment.tracking_code = payload.tracking_code
    _apply_status(shipment, payload.status)

    write_audit(
        db,
        user=actor,
        action='shipment.update',
        entity='envios',
        entity_id=shipment.id,
        detail={'sale_id': sale.id, 'status': shipment.status},
        ip_address=ip,
    )
    db.commit()
    return _serialize(shipment, sale.sale_number)


def update_shipment_status(
    db: Session,
    company_id: int,
    shipment_id: int,
    payload: ShipmentStatusUpdate,
    actor=None,
    ip: Optional[str] = None,
) -> dict:
    shipment, sale_number = _get(db, company_id, shipment_id)
    _validate_status(payload.status)
    _apply_status(shipment, payload.status)

    write_audit(
        db,
        user=actor,
        action='shipment.status',
        entity='envios',
        entity_id=shipment.id,
        detail={'status': shipment.status},
        ip_address=ip,
    )
    db.commit()
    return _serialize(shipment, sale_number)


def delete_shipment(
    db: Session, company_id: int, shipment_id: int, actor=None, ip: Optional[str] = None
) -> dict:
    shipment, sale_number = _get(db, company_id, shipment_id)

    write_audit(
        db,
        user=actor,
        action='shipment.delete',
        entity='envios',
        entity_id=shipment.id,
        detail={'sale_number': sale_number, 'tracking_code': shipment.tracking_code},
        ip_address=ip,
    )
    db.delete(shipment)
    db.commit()
    return {'id': shipment_id, 'deleted': True}
