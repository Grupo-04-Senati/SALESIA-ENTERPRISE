"""Inventario: stock, kardex y alertas (RF-08 · RN-10, RN-20…RN-24)."""

from __future__ import annotations

from typing import Optional

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.exceptions import BusinessRuleError, NotFound, ValidationAppError
from app.models.inventory import Inventory
from app.models.inventory_movement import InventoryMovement
from app.models.product import Product
from app.schemas.sale import MovementCreate
from app.services.audit_service import write_audit
from app.utils.helpers import clamp_page, paginate

# API usa mayúsculas; la BD almacena en minúsculas.
KIND_TO_DB = {
    'IN': 'in',
    'OUT': 'out',
    'RETURN': 'return',
    'SHRINKAGE': 'shrinkage',
    'ADJUSTMENT': 'adjustment',
}
DELTA = {'in': 1, 'return': 1, 'out': -1, 'shrinkage': -1, 'adjustment': -1}


def apply_stock(
    db: Session, company_id: int, product_id: int, delta: int, *, actor=None, ip: Optional[str] = None
) -> tuple[Product, Inventory, int]:
    """RN-20: el stock nunca queda negativo. Devuelve (product, inventory, stock_anterior)."""
    product = db.execute(
        select(Product).where(Product.id == product_id, Product.company_id == company_id)
    ).scalar_one_or_none()
    if product is None:
        raise NotFound('Producto no encontrado.')

    stock = db.execute(select(Inventory).where(Inventory.product_id == product_id)).scalar_one_or_none()
    if stock is None:
        stock = Inventory(product_id=product_id, stock=0, min_stock=product.min_stock)
        db.add(stock)
        db.flush()

    previous = stock.stock
    next_stock = previous + delta
    if next_stock < 0:
        raise BusinessRuleError(
            f'Stock insuficiente de {product.name} (disponible: {previous}).'
        )
    stock.stock = next_stock
    return product, stock, previous


def _serialize_movement(row: InventoryMovement) -> dict:
    return {
        'id': row.id,
        'product_id': row.product_id,
        'sku': row.product.sku if row.product else '',
        'type': (row.movement_type or '').upper(),
        'quantity': row.quantity,
        'resulting_stock': row.resulting_stock,
        'reason': row.reason or '',
        'user': (
            {'id': row.created_by_user.id, 'name': row.created_by_user.full_name}
            if row.created_by_user
            else None
        ),
        'created_at': row.created_at,
    }


def list_stock(db: Session, company_id: int, *, low_stock: bool = False) -> dict:
    products = db.execute(
        select(Product).where(Product.company_id == company_id).order_by(Product.name)
    ).scalars().all()
    stocks = {
        row.product_id: row for row in db.execute(select(Inventory)).scalars().all()
    }

    items = []
    for product in products:
        stock = stocks.get(product.id)
        current = stock.stock if stock else 0
        if low_stock and current > product.min_stock:
            continue
        items.append(
            {
                'product_id': product.id,
                'sku': product.sku,
                'name': product.name,
                'category': product.category.name if product.category else '',
                'current_stock': current,
                'min_stock': product.min_stock,
                'unit': product.unit,
            }
        )
    return paginate(items, 1, max(len(items), 1))


def list_alerts(db: Session, company_id: int) -> dict:
    """RN-24: stock ≤ stock mínimo."""
    return list_stock(db, company_id, low_stock=True)


def list_movements(
    db: Session,
    company_id: int,
    *,
    product_id: Optional[int] = None,
    page: int = 1,
    page_size: int = 20,
) -> dict:
    page, page_size = clamp_page(page, page_size)
    statement = (
        select(InventoryMovement)
        .join(Product, Product.id == InventoryMovement.product_id)
        .where(Product.company_id == company_id)
    )
    if product_id:
        statement = statement.where(InventoryMovement.product_id == product_id)

    rows = (
        db.execute(statement.order_by(InventoryMovement.created_at.desc()))
        .scalars()
        .all()
    )
    return paginate([_serialize_movement(row) for row in rows], page, page_size)


def create_movement(
    db: Session,
    company_id: int,
    payload: MovementCreate,
    actor=None,
    ip: Optional[str] = None,
) -> dict:
    kind = KIND_TO_DB.get(payload.type.upper())
    if kind is None:
        raise ValidationAppError('Tipo de movimiento no válido.')

    # RN-21: merma y ajuste exigen motivo.
    if kind in ('shrinkage', 'adjustment') and not (payload.reason or '').strip():
        raise ValidationAppError('El motivo es obligatorio en merma y ajuste (RN-21).')

    product, stock, previous = apply_stock(
        db, company_id, payload.product_id, DELTA[kind] * payload.quantity, actor=actor, ip=ip
    )

    movement = InventoryMovement(
        product_id=product.id,
        movement_type=kind,
        quantity=payload.quantity,
        reason=(payload.reason or '').strip() or 'Sin motivo',
        resulting_stock=stock.stock,
        created_by=actor.id if actor else None,
    )
    db.add(movement)
    db.flush()

    write_audit(
        db,
        user=actor,
        action='inventory.movement',
        entity='inventory_movements',
        entity_id=movement.id,
        detail={'type': payload.type, 'quantity': payload.quantity, 'sku': product.sku},
        ip_address=ip,
    )
    db.commit()
    db.refresh(movement)
    return _serialize_movement(movement)
