"""Órdenes de compra: alta, edición, estados y recepción de stock (BE-1)."""

from __future__ import annotations

from datetime import datetime, timezone
from typing import Dict, List, Optional

from sqlalchemy import delete, func, or_, select
from sqlalchemy.orm import Session

from app.core.exceptions import BusinessRuleError, NotFound, ValidationAppError
from app.models.inventory_movement import InventoryMovement
from app.models.product import Product
from app.models.purchase import PurchaseOrder, PurchaseOrderDetail
from app.models.supplier import Supplier
from app.schemas.purchase_orders import (
    PurchaseOrderCreate,
    PurchaseOrderItemInput,
    PurchaseOrderStatusUpdate,
    PurchaseOrderUpdate,
)
from app.services.audit_service import write_audit
from app.services.inventory_service import apply_stock
from app.utils.helpers import as_float, clamp_page, paginate

PURCHASE_STATUSES = ('pending', 'approved', 'received', 'cancelled')
TRANSITIONS = {
    'pending': ('approved', 'cancelled'),
    'approved': ('received', 'cancelled'),
}


def _serialize(order: PurchaseOrder, supplier_name: str, item_count: int) -> dict:
    return {
        'id': order.id,
        'order_number': order.order_number,
        'supplier_id': order.supplier_id,
        'supplier_name': supplier_name,
        'status': order.status,
        'total': as_float(order.total),
        'notes': order.notes,
        'item_count': item_count,
        'created_at': order.created_at,
    }


def _serialize_item(row: PurchaseOrderDetail, product_name: str) -> dict:
    return {
        'id': row.id,
        'product_id': row.product_id,
        'product_name': product_name,
        'quantity': row.quantity,
        'unit_cost': as_float(row.unit_cost),
        'subtotal': as_float(row.subtotal),
    }


def _get(db: Session, company_id: int, order_id: int) -> PurchaseOrder:
    order = db.execute(
        select(PurchaseOrder).where(
            PurchaseOrder.id == order_id, PurchaseOrder.company_id == company_id
        )
    ).scalar_one_or_none()
    if order is None:
        raise NotFound('Orden de compra no encontrada.')
    return order


def _next_order_number(db: Session, company_id: int) -> str:
    year = datetime.now(timezone.utc).year
    count = db.execute(
        select(func.count(PurchaseOrder.id)).where(
            PurchaseOrder.company_id == company_id,
            PurchaseOrder.order_number.like(f'OC-{year}-%'),
        )
    ).scalar_one()
    return f'OC-{year}-{count + 1:04d}'


def _item_counts(db: Session, order_ids: List[int]) -> Dict[int, int]:
    if not order_ids:
        return {}
    rows = db.execute(
        select(PurchaseOrderDetail.purchase_order_id, func.count(PurchaseOrderDetail.id))
        .where(PurchaseOrderDetail.purchase_order_id.in_(order_ids))
        .group_by(PurchaseOrderDetail.purchase_order_id)
    ).all()
    return {row[0]: row[1] for row in rows}


def _validate_supplier(db: Session, company_id: int, supplier_id: int) -> None:
    supplier = db.execute(
        select(Supplier).where(Supplier.id == supplier_id, Supplier.company_id == company_id)
    ).scalar_one_or_none()
    if supplier is None:
        raise NotFound('Proveedor no encontrado.')
    if not supplier.is_active:
        raise BusinessRuleError('El proveedor debe estar activo para operar compras.')


def _validate_products(db: Session, company_id: int, product_ids: List[int]) -> None:
    found = set(
        db.execute(
            select(Product.id).where(Product.company_id == company_id, Product.id.in_(product_ids))
        ).scalars().all()
    )
    for product_id in product_ids:
        if product_id not in found:
            raise NotFound(f'Producto {product_id} no encontrado.')


def _replace_details(
    db: Session, order: PurchaseOrder, items: List[PurchaseOrderItemInput]
) -> None:
    """Reemplaza las líneas y recalcula el total (RN-11: total en servidor)."""
    db.execute(
        delete(PurchaseOrderDetail).where(PurchaseOrderDetail.purchase_order_id == order.id)
    )
    total = 0.0
    for item in items:
        subtotal = round(item.quantity * item.unit_cost, 2)
        total += subtotal
        db.add(
            PurchaseOrderDetail(
                purchase_order_id=order.id,
                product_id=item.product_id,
                quantity=item.quantity,
                unit_cost=item.unit_cost,
                subtotal=subtotal,
            )
        )
    order.total = round(total, 2)


def list_purchase_orders(
    db: Session,
    company_id: int,
    *,
    q: str = '',
    status: str = '',
    supplier_id: Optional[int] = None,
    page: int = 1,
    page_size: int = 20,
) -> dict:
    page, page_size = clamp_page(page, page_size)
    statement = (
        select(PurchaseOrder, Supplier.name)
        .join(Supplier, Supplier.id == PurchaseOrder.supplier_id)
        .where(PurchaseOrder.company_id == company_id)
    )
    if status:
        statement = statement.where(PurchaseOrder.status == status)
    if supplier_id:
        statement = statement.where(PurchaseOrder.supplier_id == supplier_id)
    if q:
        term = f'%{q.strip()}%'
        statement = statement.where(
            or_(PurchaseOrder.order_number.ilike(term), Supplier.name.ilike(term))
        )

    rows = db.execute(statement.order_by(PurchaseOrder.id.desc())).all()
    counts = _item_counts(db, [row[0].id for row in rows])
    payload = [_serialize(row[0], row[1], counts.get(row[0].id, 0)) for row in rows]
    return paginate(payload, page, page_size)


def get_purchase_order(db: Session, company_id: int, order_id: int) -> dict:
    order = _get(db, company_id, order_id)
    supplier = db.get(Supplier, order.supplier_id)
    rows = db.execute(
        select(PurchaseOrderDetail, Product.name)
        .join(Product, Product.id == PurchaseOrderDetail.product_id)
        .where(PurchaseOrderDetail.purchase_order_id == order.id)
        .order_by(PurchaseOrderDetail.id)
    ).all()

    payload = _serialize(order, supplier.name if supplier else '', len(rows))
    payload['items'] = [_serialize_item(row[0], row[1]) for row in rows]
    return payload


def create_purchase_order(
    db: Session, company_id: int, payload: PurchaseOrderCreate, actor=None, ip: Optional[str] = None
) -> dict:
    _validate_supplier(db, company_id, payload.supplier_id)
    _validate_products(db, company_id, [item.product_id for item in payload.items])

    order = PurchaseOrder(
        company_id=company_id,
        supplier_id=payload.supplier_id,
        order_number=_next_order_number(db, company_id),
        status='pending',
        notes=payload.notes,
        created_by=actor.id if actor else None,
    )
    db.add(order)
    db.flush()
    _replace_details(db, order, payload.items)

    write_audit(
        db,
        user=actor,
        action='purchase_order.create',
        entity='ordenes_compra',
        entity_id=order.id,
        detail={'order_number': order.order_number, 'total': as_float(order.total)},
        ip_address=ip,
    )
    db.commit()
    return get_purchase_order(db, company_id, order.id)


def update_purchase_order(
    db: Session,
    company_id: int,
    order_id: int,
    payload: PurchaseOrderUpdate,
    actor=None,
    ip: Optional[str] = None,
) -> dict:
    order = _get(db, company_id, order_id)
    if order.status != 'pending':
        raise BusinessRuleError('Solo las órdenes pendientes se pueden editar.')

    _validate_supplier(db, company_id, payload.supplier_id)
    _validate_products(db, company_id, [item.product_id for item in payload.items])

    order.supplier_id = payload.supplier_id
    order.notes = payload.notes
    _replace_details(db, order, payload.items)

    write_audit(
        db,
        user=actor,
        action='purchase_order.update',
        entity='ordenes_compra',
        entity_id=order.id,
        detail={'order_number': order.order_number, 'total': as_float(order.total)},
        ip_address=ip,
    )
    db.commit()
    return get_purchase_order(db, company_id, order.id)


def update_purchase_order_status(
    db: Session,
    company_id: int,
    order_id: int,
    payload: PurchaseOrderStatusUpdate,
    actor=None,
    ip: Optional[str] = None,
) -> dict:
    """Cambio de estado; al recibir repone el stock y registra el kardex."""
    if payload.status not in PURCHASE_STATUSES:
        raise ValidationAppError('Estado no válido: use pending, approved, received o cancelled.')

    order = _get(db, company_id, order_id)
    if payload.status not in TRANSITIONS.get(order.status, ()):
        raise BusinessRuleError('Transición de estado no válida para la orden de compra.')

    order.status = payload.status
    if payload.status == 'received':
        details = db.execute(
            select(PurchaseOrderDetail).where(PurchaseOrderDetail.purchase_order_id == order.id)
        ).scalars().all()
        for detail in details:
            _product, inventory, _previous = apply_stock(
                db, company_id, detail.product_id, detail.quantity, actor=actor, ip=ip
            )
            db.add(
                InventoryMovement(
                    product_id=detail.product_id,
                    movement_type='in',
                    quantity=detail.quantity,
                    reason=f'Orden {order.order_number}',
                    resulting_stock=inventory.stock,
                    reference_id=order.id,
                    created_by=actor.id if actor else None,
                )
            )

    write_audit(
        db,
        user=actor,
        action='purchase_order.status',
        entity='ordenes_compra',
        entity_id=order.id,
        detail={'order_number': order.order_number, 'status': order.status},
        ip_address=ip,
    )
    db.commit()
    return get_purchase_order(db, company_id, order.id)


def delete_purchase_order(
    db: Session, company_id: int, order_id: int, actor=None, ip: Optional[str] = None
) -> dict:
    order = _get(db, company_id, order_id)
    if order.status != 'pending':
        raise BusinessRuleError('Solo las órdenes pendientes se pueden eliminar.')

    order_number = order.order_number
    write_audit(
        db,
        user=actor,
        action='purchase_order.delete',
        entity='ordenes_compra',
        entity_id=order.id,
        detail={'order_number': order_number},
        ip_address=ip,
    )
    db.execute(
        delete(PurchaseOrderDetail).where(PurchaseOrderDetail.purchase_order_id == order.id)
    )
    db.delete(order)
    db.commit()
    return {'id': order_id, 'deleted': True}
