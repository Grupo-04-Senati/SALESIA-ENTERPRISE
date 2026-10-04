"""Devoluciones de venta: alta, aprobación y reposición de stock (BE-1)."""

from __future__ import annotations

from datetime import datetime, timezone
from typing import Dict, List, Optional

from sqlalchemy import delete, func, or_, select
from sqlalchemy.orm import Session

from app.core.exceptions import BusinessRuleError, NotFound, ValidationAppError
from app.models.inventory_movement import InventoryMovement
from app.models.product import Product
from app.models.sale import Sale
from app.models.sale_detail import SaleDetail
from app.models.sales_return import SalesReturn, SalesReturnDetail
from app.schemas.returns import ReturnCreate, ReturnStatusUpdate, ReturnUpdate
from app.services.audit_service import write_audit
from app.services.event_service import log_app_event
from app.services.inventory_service import apply_stock
from app.utils.helpers import as_float, clamp_page, paginate


def _serialize(ret: SalesReturn, sale_number: str, item_count: int) -> dict:
    return {
        'id': ret.id,
        'return_number': ret.return_number,
        'sale_id': ret.sale_id,
        'sale_number': sale_number,
        'reason': ret.reason,
        'status': ret.status,
        'total': as_float(ret.total),
        'item_count': item_count,
        'created_at': ret.created_at,
    }


def _get(db: Session, company_id: int, return_id: int) -> SalesReturn:
    ret = db.execute(
        select(SalesReturn).where(
            SalesReturn.id == return_id, SalesReturn.company_id == company_id
        )
    ).scalar_one_or_none()
    if ret is None:
        raise NotFound('Devolución no encontrada.')
    return ret


def _next_return_number(db: Session, company_id: int) -> str:
    year = datetime.now(timezone.utc).year
    count = db.execute(
        select(func.count(SalesReturn.id)).where(
            SalesReturn.company_id == company_id, SalesReturn.return_number.like(f'NC-{year}-%')
        )
    ).scalar_one()
    return f'NC-{year}-{count + 1:04d}'


def _item_counts(db: Session, return_ids: List[int]) -> Dict[int, int]:
    if not return_ids:
        return {}
    rows = db.execute(
        select(SalesReturnDetail.return_id, func.count(SalesReturnDetail.id))
        .where(SalesReturnDetail.return_id.in_(return_ids))
        .group_by(SalesReturnDetail.return_id)
    ).all()
    return {row[0]: row[1] for row in rows}


def _sale_lines(db: Session, sale_id: int) -> Dict[int, SaleDetail]:
    """Líneas de la venta indexadas por producto (RN: el producto debe estar vendido)."""
    details = db.execute(
        select(SaleDetail).where(SaleDetail.sale_id == sale_id).order_by(SaleDetail.id)
    ).scalars().all()
    return {detail.product_id: detail for detail in details}


def _compute(db: Session, sale_id: int, items) -> List[tuple]:
    """(product_id, quantity, unit_price, subtotal) validando pertenencia a la venta."""
    lines = _sale_lines(db, sale_id)
    computed = []
    for item in items:
        detail = lines.get(item.product_id)
        if detail is None:
            raise ValidationAppError('El producto no pertenece a la venta.')
        unit_price = as_float(detail.unit_price)
        computed.append(
            (item.product_id, item.quantity, unit_price, round(item.quantity * unit_price, 2))
        )
    return computed


def list_returns(
    db: Session,
    company_id: int,
    *,
    q: str = '',
    status: str = '',
    page: int = 1,
    page_size: int = 20,
) -> dict:
    page, page_size = clamp_page(page, page_size)
    statement = (
        select(SalesReturn, Sale.sale_number)
        .join(Sale, Sale.id == SalesReturn.sale_id)
        .where(SalesReturn.company_id == company_id)
    )
    if status:
        statement = statement.where(SalesReturn.status == status)
    if q:
        term = f'%{q.strip()}%'
        statement = statement.where(
            or_(SalesReturn.return_number.ilike(term), Sale.sale_number.ilike(term))
        )

    rows = db.execute(statement.order_by(SalesReturn.id.desc())).all()
    counts = _item_counts(db, [row[0].id for row in rows])
    payload = [_serialize(row[0], row[1], counts.get(row[0].id, 0)) for row in rows]
    return paginate(payload, page, page_size)


def get_return(db: Session, company_id: int, return_id: int) -> dict:
    ret = _get(db, company_id, return_id)
    sale = db.get(Sale, ret.sale_id)
    rows = db.execute(
        select(SalesReturnDetail, Product.name)
        .join(Product, Product.id == SalesReturnDetail.product_id)
        .where(SalesReturnDetail.return_id == ret.id)
        .order_by(SalesReturnDetail.id)
    ).all()

    payload = _serialize(ret, sale.sale_number if sale else '', len(rows))
    payload['items'] = [
        {
            'id': row[0].id,
            'product_id': row[0].product_id,
            'product_name': row[1],
            'quantity': row[0].quantity,
            'unit_price': as_float(row[0].unit_price),
            'subtotal': as_float(row[0].subtotal),
        }
        for row in rows
    ]
    return payload


def create_return(
    db: Session, company_id: int, payload: ReturnCreate, actor=None, ip: Optional[str] = None
) -> dict:
    sale = db.execute(
        select(Sale).where(Sale.id == payload.sale_id, Sale.company_id == company_id)
    ).scalar_one_or_none()
    if sale is None:
        raise NotFound('Venta no encontrada.')

    computed = _compute(db, sale.id, payload.items)
    ret = SalesReturn(
        company_id=company_id,
        sale_id=sale.id,
        return_number=_next_return_number(db, company_id),
        reason=payload.reason,
        status='pending',
        total=round(sum(row[3] for row in computed), 2),
        created_by=actor.id if actor else None,
    )
    db.add(ret)
    db.flush()
    for product_id, quantity, unit_price, subtotal in computed:
        db.add(
            SalesReturnDetail(
                return_id=ret.id,
                product_id=product_id,
                quantity=quantity,
                unit_price=unit_price,
                subtotal=subtotal,
            )
        )

    write_audit(
        db,
        user=actor,
        action='return.create',
        entity='devoluciones',
        entity_id=ret.id,
        detail={'return_number': ret.return_number, 'total': as_float(ret.total)},
        ip_address=ip,
    )
    db.commit()
    return get_return(db, company_id, ret.id)


def update_return(
    db: Session,
    company_id: int,
    return_id: int,
    payload: ReturnUpdate,
    actor=None,
    ip: Optional[str] = None,
) -> dict:
    ret = _get(db, company_id, return_id)
    if ret.status != 'pending':
        raise BusinessRuleError('Solo las devoluciones pendientes se pueden editar.')

    sale = db.execute(
        select(Sale).where(Sale.id == payload.sale_id, Sale.company_id == company_id)
    ).scalar_one_or_none()
    if sale is None:
        raise NotFound('Venta no encontrada.')

    computed = _compute(db, sale.id, payload.items)
    ret.sale_id = sale.id
    ret.reason = payload.reason
    ret.total = round(sum(row[3] for row in computed), 2)

    db.execute(delete(SalesReturnDetail).where(SalesReturnDetail.return_id == ret.id))
    for product_id, quantity, unit_price, subtotal in computed:
        db.add(
            SalesReturnDetail(
                return_id=ret.id,
                product_id=product_id,
                quantity=quantity,
                unit_price=unit_price,
                subtotal=subtotal,
            )
        )

    write_audit(
        db,
        user=actor,
        action='return.update',
        entity='devoluciones',
        entity_id=ret.id,
        detail={'return_number': ret.return_number, 'total': as_float(ret.total)},
        ip_address=ip,
    )
    db.commit()
    return get_return(db, company_id, ret.id)


def approve_return(
    db: Session, company_id: int, return_id: int, actor=None, ip: Optional[str] = None
) -> dict:
    """Repone el stock por ítem y registra el kardex (RN-20)."""
    ret = _get(db, company_id, return_id)
    if ret.status != 'pending':
        raise BusinessRuleError('Solo las devoluciones pendientes se pueden aprobar.')

    details = db.execute(
        select(SalesReturnDetail).where(SalesReturnDetail.return_id == ret.id)
    ).scalars().all()
    for detail in details:
        _product, inventory, _previous = apply_stock(
            db, company_id, detail.product_id, detail.quantity, actor=actor, ip=ip
        )
        db.add(
            InventoryMovement(
                product_id=detail.product_id,
                movement_type='return',
                quantity=detail.quantity,
                reason=f'Devolución {ret.return_number}',
                resulting_stock=inventory.stock,
                reference_id=ret.id,
                created_by=actor.id if actor else None,
            )
        )

    ret.status = 'completed'
    log_app_event(
        db,
        event_type='return.approved',
        company_id=company_id,
        entity='devoluciones',
        entity_id=ret.id,
        payload={'return_number': ret.return_number, 'items': len(details)},
    )
    write_audit(
        db,
        user=actor,
        action='return.approve',
        entity='devoluciones',
        entity_id=ret.id,
        detail={'return_number': ret.return_number, 'items': len(details)},
        ip_address=ip,
    )
    db.commit()
    return get_return(db, company_id, ret.id)


def update_return_status(
    db: Session,
    company_id: int,
    return_id: int,
    payload: ReturnStatusUpdate,
    actor=None,
    ip: Optional[str] = None,
) -> dict:
    if payload.status != 'rejected':
        raise ValidationAppError('Estado no válido: use rejected.')

    ret = _get(db, company_id, return_id)
    if ret.status != 'pending':
        raise BusinessRuleError('Solo las devoluciones pendientes se pueden rechazar.')

    ret.status = 'rejected'
    write_audit(
        db,
        user=actor,
        action='return.status',
        entity='devoluciones',
        entity_id=ret.id,
        detail={'return_number': ret.return_number, 'status': ret.status},
        ip_address=ip,
    )
    db.commit()
    return get_return(db, company_id, ret.id)


def delete_return(
    db: Session, company_id: int, return_id: int, actor=None, ip: Optional[str] = None
) -> dict:
    ret = _get(db, company_id, return_id)
    if ret.status != 'pending':
        raise BusinessRuleError('Solo las devoluciones pendientes se pueden eliminar.')

    return_number = ret.return_number
    write_audit(
        db,
        user=actor,
        action='return.delete',
        entity='devoluciones',
        entity_id=ret.id,
        detail={'return_number': return_number},
        ip_address=ip,
    )
    db.execute(delete(SalesReturnDetail).where(SalesReturnDetail.return_id == ret.id))
    db.delete(ret)
    db.commit()
    return {'id': return_id, 'deleted': True}
