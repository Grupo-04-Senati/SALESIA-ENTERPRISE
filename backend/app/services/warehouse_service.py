"""Unidades, sucursales, almacenes, stock por almacén y conteos (docs/04 §2.4)."""

from __future__ import annotations

from datetime import datetime, timezone
from typing import Dict, List, Optional, Tuple

from sqlalchemy import and_, delete, func, or_, select
from sqlalchemy.orm import Session

from app.core.exceptions import BusinessRuleError, Conflict, NotFound, ValidationAppError
from app.models.branch import Branch
from app.models.inventory import Inventory
from app.models.inventory_movement import InventoryMovement
from app.models.pricing import Unit
from app.models.product import Product
from app.models.user import User
from app.models.warehouse import StockCount, StockCountDetail, Warehouse, WarehouseStock
from app.schemas.warehouse import (
    BranchCreate,
    BranchUpdate,
    StockCountCreate,
    StockCountItemInput,
    StockCountUpdate,
    UnitCreate,
    UnitUpdate,
    WarehouseCreate,
    WarehouseStockCreate,
    WarehouseStockUpdate,
    WarehouseUpdate,
)
from app.services.audit_service import write_audit
from app.services.inventory_service import apply_stock
from app.utils.helpers import clamp_page, paginate


def _status_of(is_active: bool) -> str:
    return 'active' if is_active else 'inactive'


def _to_active(status: Optional[str]) -> bool:
    """'active'/'inactive' → is_active; vacío → activo."""
    if status is None or status == '':
        return True
    if status not in ('active', 'inactive'):
        raise ValidationAppError('Estado no válido.')
    return status == 'active'


# --------------------------------------------------------------------------- unidades


def _serialize_unit(unit: Unit) -> dict:
    return {
        'id': unit.id,
        'name': unit.name,
        'symbol': unit.symbol or '',
        'status': _status_of(unit.is_active),
    }


def _get_unit(db: Session, company_id: int, unit_id: int) -> Unit:
    unit = db.execute(
        select(Unit).where(Unit.id == unit_id, Unit.company_id == company_id)
    ).scalar_one_or_none()
    if unit is None:
        raise NotFound('Unidad no encontrada.')
    return unit


def list_units(db: Session, company_id: int, *, page: int = 1, page_size: int = 20) -> dict:
    page, page_size = clamp_page(page, page_size)
    rows = db.execute(
        select(Unit).where(Unit.company_id == company_id).order_by(Unit.name)
    ).scalars().all()
    return paginate([_serialize_unit(row) for row in rows], page, page_size)


def get_unit(db: Session, company_id: int, unit_id: int) -> dict:
    return _serialize_unit(_get_unit(db, company_id, unit_id))


def create_unit(
    db: Session, company_id: int, payload: UnitCreate, actor=None, ip: Optional[str] = None
) -> dict:
    duplicated = db.execute(
        select(Unit).where(Unit.company_id == company_id, Unit.name == payload.name)
    ).scalar_one_or_none()
    if duplicated:
        raise Conflict('Ya existe una unidad con ese nombre.')

    unit = Unit(
        company_id=company_id,
        name=payload.name,
        symbol=payload.symbol,
        is_active=_to_active(payload.status),
    )
    db.add(unit)
    db.flush()
    write_audit(
        db, user=actor, action='unit.create', entity='unidades', entity_id=unit.id,
        detail={'name': unit.name}, ip_address=ip,
    )
    db.commit()
    return _serialize_unit(unit)


def update_unit(
    db: Session, company_id: int, unit_id: int, payload: UnitUpdate,
    actor=None, ip: Optional[str] = None,
) -> dict:
    unit = _get_unit(db, company_id, unit_id)
    duplicated = db.execute(
        select(Unit).where(
            Unit.company_id == company_id, Unit.name == payload.name, Unit.id != unit_id
        )
    ).scalar_one_or_none()
    if duplicated:
        raise Conflict('Ya existe una unidad con ese nombre.')

    data = payload.model_dump(exclude_unset=True)
    status = data.pop('status', None)
    for field, value in data.items():
        setattr(unit, field, value)
    if status is not None:
        unit.is_active = _to_active(status)

    write_audit(
        db, user=actor, action='unit.update', entity='unidades', entity_id=unit.id,
        ip_address=ip,
    )
    db.commit()
    return _serialize_unit(unit)


def deactivate_unit(
    db: Session, company_id: int, unit_id: int, actor=None, ip: Optional[str] = None
) -> dict:
    unit = _get_unit(db, company_id, unit_id)
    unit.is_active = False
    write_audit(
        db, user=actor, action='unit.delete', entity='unidades', entity_id=unit.id,
        ip_address=ip,
    )
    db.commit()
    return _serialize_unit(unit)


# ------------------------------------------------------------------------- sucursales


def _serialize_branch(branch: Branch) -> dict:
    return {
        'id': branch.id,
        'code': branch.code,
        'name': branch.name,
        'address': branch.address or '',
        'phone': branch.phone or '',
        'status': _status_of(branch.is_active),
    }


def _get_branch(db: Session, company_id: int, branch_id: int) -> Branch:
    branch = db.execute(
        select(Branch).where(Branch.id == branch_id, Branch.company_id == company_id)
    ).scalar_one_or_none()
    if branch is None:
        raise NotFound('Sucursal no encontrada.')
    return branch


def list_branches(
    db: Session, company_id: int, *, page: int = 1, page_size: int = 20
) -> dict:
    page, page_size = clamp_page(page, page_size)
    rows = db.execute(
        select(Branch).where(Branch.company_id == company_id).order_by(Branch.name)
    ).scalars().all()
    return paginate([_serialize_branch(row) for row in rows], page, page_size)


def get_branch(db: Session, company_id: int, branch_id: int) -> dict:
    return _serialize_branch(_get_branch(db, company_id, branch_id))


def create_branch(
    db: Session, company_id: int, payload: BranchCreate, actor=None, ip: Optional[str] = None
) -> dict:
    duplicated = db.execute(
        select(Branch).where(Branch.company_id == company_id, Branch.code == payload.code)
    ).scalar_one_or_none()
    if duplicated:
        raise Conflict('Ya existe una sucursal con ese código.')

    branch = Branch(
        company_id=company_id,
        code=payload.code,
        name=payload.name,
        address=payload.address,
        phone=payload.phone,
        is_active=_to_active(payload.status),
    )
    db.add(branch)
    db.flush()
    write_audit(
        db, user=actor, action='branch.create', entity='sucursales', entity_id=branch.id,
        detail={'code': branch.code}, ip_address=ip,
    )
    db.commit()
    return _serialize_branch(branch)


def update_branch(
    db: Session, company_id: int, branch_id: int, payload: BranchUpdate,
    actor=None, ip: Optional[str] = None,
) -> dict:
    branch = _get_branch(db, company_id, branch_id)
    duplicated = db.execute(
        select(Branch).where(
            Branch.company_id == company_id, Branch.code == payload.code, Branch.id != branch_id
        )
    ).scalar_one_or_none()
    if duplicated:
        raise Conflict('Ya existe una sucursal con ese código.')

    data = payload.model_dump(exclude_unset=True)
    status = data.pop('status', None)
    for field, value in data.items():
        setattr(branch, field, value)
    if status is not None:
        branch.is_active = _to_active(status)

    write_audit(
        db, user=actor, action='branch.update', entity='sucursales', entity_id=branch.id,
        ip_address=ip,
    )
    db.commit()
    return _serialize_branch(branch)


def deactivate_branch(
    db: Session, company_id: int, branch_id: int, actor=None, ip: Optional[str] = None
) -> dict:
    branch = _get_branch(db, company_id, branch_id)
    branch.is_active = False
    write_audit(
        db, user=actor, action='branch.delete', entity='sucursales', entity_id=branch.id,
        ip_address=ip,
    )
    db.commit()
    return _serialize_branch(branch)


# -------------------------------------------------------------------------- almacenes


def _warehouse_stats(db: Session, company_id: int) -> Dict[int, Tuple[int, int]]:
    rows = db.execute(
        select(
            WarehouseStock.warehouse_id,
            func.count(WarehouseStock.id),
            func.coalesce(func.sum(WarehouseStock.stock), 0),
        )
        .join(Warehouse, Warehouse.id == WarehouseStock.warehouse_id)
        .where(Warehouse.company_id == company_id)
        .group_by(WarehouseStock.warehouse_id)
    ).all()
    return {row[0]: (row[1], int(row[2])) for row in rows}


def _serialize_warehouse(warehouse: Warehouse, stats: Dict[int, Tuple[int, int]]) -> dict:
    stock_lines, total_units = stats.get(warehouse.id, (0, 0))
    return {
        'id': warehouse.id,
        'code': warehouse.code,
        'name': warehouse.name,
        'address': warehouse.address or '',
        'status': _status_of(warehouse.is_active),
        'stock_lines': stock_lines,
        'total_units': total_units,
    }


def _get_warehouse(db: Session, company_id: int, warehouse_id: int) -> Warehouse:
    warehouse = db.execute(
        select(Warehouse).where(
            Warehouse.id == warehouse_id, Warehouse.company_id == company_id
        )
    ).scalar_one_or_none()
    if warehouse is None:
        raise NotFound('Almacén no encontrado.')
    return warehouse


def list_warehouses(
    db: Session, company_id: int, *, page: int = 1, page_size: int = 20
) -> dict:
    page, page_size = clamp_page(page, page_size)
    rows = db.execute(
        select(Warehouse).where(Warehouse.company_id == company_id).order_by(Warehouse.name)
    ).scalars().all()
    stats = _warehouse_stats(db, company_id)
    return paginate([_serialize_warehouse(row, stats) for row in rows], page, page_size)


def get_warehouse(db: Session, company_id: int, warehouse_id: int) -> dict:
    warehouse = _get_warehouse(db, company_id, warehouse_id)
    return _serialize_warehouse(warehouse, _warehouse_stats(db, company_id))


def create_warehouse(
    db: Session, company_id: int, payload: WarehouseCreate, actor=None, ip: Optional[str] = None
) -> dict:
    duplicated = db.execute(
        select(Warehouse).where(Warehouse.company_id == company_id, Warehouse.code == payload.code)
    ).scalar_one_or_none()
    if duplicated:
        raise Conflict('Ya existe un almacén con ese código.')

    warehouse = Warehouse(
        company_id=company_id,
        code=payload.code,
        name=payload.name,
        address=payload.address,
        is_active=_to_active(payload.status),
    )
    db.add(warehouse)
    db.flush()
    write_audit(
        db, user=actor, action='warehouse.create', entity='almacenes', entity_id=warehouse.id,
        detail={'code': warehouse.code}, ip_address=ip,
    )
    db.commit()
    return _serialize_warehouse(warehouse, {})


def update_warehouse(
    db: Session, company_id: int, warehouse_id: int, payload: WarehouseUpdate,
    actor=None, ip: Optional[str] = None,
) -> dict:
    warehouse = _get_warehouse(db, company_id, warehouse_id)
    duplicated = db.execute(
        select(Warehouse).where(
            Warehouse.company_id == company_id,
            Warehouse.code == payload.code,
            Warehouse.id != warehouse_id,
        )
    ).scalar_one_or_none()
    if duplicated:
        raise Conflict('Ya existe un almacén con ese código.')

    data = payload.model_dump(exclude_unset=True)
    status = data.pop('status', None)
    for field, value in data.items():
        setattr(warehouse, field, value)
    if status is not None:
        warehouse.is_active = _to_active(status)

    write_audit(
        db, user=actor, action='warehouse.update', entity='almacenes', entity_id=warehouse.id,
        ip_address=ip,
    )
    db.commit()
    return _serialize_warehouse(warehouse, _warehouse_stats(db, company_id))


def deactivate_warehouse(
    db: Session, company_id: int, warehouse_id: int, actor=None, ip: Optional[str] = None
) -> dict:
    warehouse = _get_warehouse(db, company_id, warehouse_id)
    lines = db.execute(
        select(func.count(WarehouseStock.id)).where(WarehouseStock.warehouse_id == warehouse.id)
    ).scalar_one()
    if lines:
        raise Conflict('El almacén tiene stock asignado.')

    warehouse.is_active = False
    write_audit(
        db, user=actor, action='warehouse.delete', entity='almacenes', entity_id=warehouse.id,
        ip_address=ip,
    )
    db.commit()
    return _serialize_warehouse(warehouse, _warehouse_stats(db, company_id))


# ---------------------------------------------------------------------- stock almacén


def _serialize_stock_row(
    row: WarehouseStock, warehouse_name: str, product_name: str
) -> dict:
    return {
        'id': row.id,
        'warehouse_id': row.warehouse_id,
        'warehouse_name': warehouse_name,
        'product_id': row.product_id,
        'product_name': product_name,
        'stock': row.stock,
        'min_stock': row.min_stock,
    }


def _get_stock_row(db: Session, company_id: int, stock_id: int) -> WarehouseStock:
    row = db.execute(
        select(WarehouseStock)
        .join(Warehouse, Warehouse.id == WarehouseStock.warehouse_id)
        .where(WarehouseStock.id == stock_id, Warehouse.company_id == company_id)
    ).scalar_one_or_none()
    if row is None:
        raise NotFound('Registro de stock no encontrado.')
    return row


def _stock_names(db: Session, company_id: int, row: WarehouseStock) -> Tuple[str, str]:
    warehouse_name = db.execute(
        select(Warehouse.name).where(
            Warehouse.id == row.warehouse_id, Warehouse.company_id == company_id
        )
    ).scalar_one_or_none()
    product_name = db.execute(
        select(Product.name).where(
            Product.id == row.product_id, Product.company_id == company_id
        )
    ).scalar_one_or_none()
    return warehouse_name or '', product_name or ''


def list_warehouse_stock(
    db: Session,
    company_id: int,
    *,
    warehouse_id: Optional[int] = None,
    q: str = '',
    page: int = 1,
    page_size: int = 20,
) -> dict:
    page, page_size = clamp_page(page, page_size)
    statement = (
        select(WarehouseStock, Warehouse.name, Product.name)
        .join(Warehouse, Warehouse.id == WarehouseStock.warehouse_id)
        .join(Product, Product.id == WarehouseStock.product_id)
        .where(Warehouse.company_id == company_id, Product.company_id == company_id)
    )
    if warehouse_id:
        statement = statement.where(WarehouseStock.warehouse_id == warehouse_id)
    if q:
        term = f'%{q.strip()}%'
        statement = statement.where(or_(Product.name.ilike(term), Product.sku.ilike(term)))

    rows = db.execute(statement.order_by(Warehouse.name, Product.name)).all()
    payload = [
        _serialize_stock_row(row, warehouse_name, product_name)
        for row, warehouse_name, product_name in rows
    ]
    return paginate(payload, page, page_size)


def get_warehouse_stock(db: Session, company_id: int, stock_id: int) -> dict:
    row = _get_stock_row(db, company_id, stock_id)
    warehouse_name, product_name = _stock_names(db, company_id, row)
    return _serialize_stock_row(row, warehouse_name, product_name)


def create_warehouse_stock(
    db: Session,
    company_id: int,
    payload: WarehouseStockCreate,
    actor=None,
    ip: Optional[str] = None,
) -> dict:
    warehouse = _get_warehouse(db, company_id, payload.warehouse_id)
    product = db.execute(
        select(Product).where(Product.id == payload.product_id, Product.company_id == company_id)
    ).scalar_one_or_none()
    if product is None:
        raise NotFound('Producto no encontrado.')

    duplicated = db.execute(
        select(WarehouseStock).where(
            WarehouseStock.warehouse_id == warehouse.id,
            WarehouseStock.product_id == product.id,
        )
    ).scalar_one_or_none()
    if duplicated:
        raise Conflict('El producto ya tiene stock en ese almacén.')

    row = WarehouseStock(
        warehouse_id=warehouse.id,
        product_id=product.id,
        stock=payload.stock,
        min_stock=payload.min_stock,
    )
    db.add(row)
    db.flush()
    write_audit(
        db, user=actor, action='warehouse_stock.create', entity='stock_almacenes',
        entity_id=row.id, detail={'warehouse_id': warehouse.id, 'product_id': product.id},
        ip_address=ip,
    )
    db.commit()
    return _serialize_stock_row(row, warehouse.name, product.name)


def update_warehouse_stock(
    db: Session,
    company_id: int,
    stock_id: int,
    payload: WarehouseStockUpdate,
    actor=None,
    ip: Optional[str] = None,
) -> dict:
    row = _get_stock_row(db, company_id, stock_id)

    for field, value in payload.model_dump(exclude_unset=True).items():
        setattr(row, field, value)

    warehouse_name, product_name = _stock_names(db, company_id, row)
    write_audit(
        db, user=actor, action='warehouse_stock.update', entity='stock_almacenes',
        entity_id=row.id, ip_address=ip,
    )
    db.commit()
    return _serialize_stock_row(row, warehouse_name, product_name)


def delete_warehouse_stock(
    db: Session, company_id: int, stock_id: int, actor=None, ip: Optional[str] = None
) -> dict:
    row = _get_stock_row(db, company_id, stock_id)
    stock_id_saved = row.id

    write_audit(
        db, user=actor, action='warehouse_stock.delete', entity='stock_almacenes',
        entity_id=stock_id_saved, ip_address=ip,
    )
    db.delete(row)
    db.commit()
    return {'id': stock_id_saved, 'deleted': True}


# ------------------------------------------------------------------------ conteos


def _next_count_number(db: Session, company_id: int) -> str:
    year = datetime.now(timezone.utc).year
    count = db.execute(
        select(func.count(StockCount.id)).where(
            StockCount.company_id == company_id,
            StockCount.count_number.like(f'CC-{year}-%'),
        )
    ).scalar_one()
    return f'CC-{year}-{count + 1:04d}'


def _count_item_counts(db: Session, company_id: int) -> Dict[int, int]:
    rows = db.execute(
        select(StockCountDetail.stock_count_id, func.count(StockCountDetail.id))
        .join(StockCount, StockCount.id == StockCountDetail.stock_count_id)
        .where(StockCount.company_id == company_id)
        .group_by(StockCountDetail.stock_count_id)
    ).all()
    return {row[0]: row[1] for row in rows}


def _serialize_count(
    count: StockCount, warehouse_name: str, counted_by_name: str, item_count: int
) -> dict:
    return {
        'id': count.id,
        'count_number': count.count_number,
        'warehouse_id': count.warehouse_id,
        'warehouse_name': warehouse_name,
        'status': count.status,
        'notes': count.notes or '',
        'item_count': item_count,
        'counted_by_name': counted_by_name,
        'created_at': count.created_at,
    }


def _get_count(db: Session, company_id: int, count_id: int) -> StockCount:
    count = db.execute(
        select(StockCount).where(
            StockCount.id == count_id, StockCount.company_id == company_id
        )
    ).scalar_one_or_none()
    if count is None:
        raise NotFound('Conteo no encontrado.')
    return count


def _count_items(db: Session, company_id: int, count_id: int) -> List[dict]:
    rows = db.execute(
        select(StockCountDetail, Product.name)
        .join(Product, Product.id == StockCountDetail.product_id)
        .where(
            StockCountDetail.stock_count_id == count_id, Product.company_id == company_id
        )
        .order_by(Product.name)
    ).all()
    return [
        {
            'id': detail.id,
            'product_id': detail.product_id,
            'product_name': product_name,
            'expected_qty': detail.expected_qty,
            'counted_qty': detail.counted_qty,
            'difference': detail.difference,
        }
        for detail, product_name in rows
    ]


def list_stock_counts(
    db: Session,
    company_id: int,
    *,
    status: str = '',
    warehouse_id: Optional[int] = None,
    page: int = 1,
    page_size: int = 20,
) -> dict:
    page, page_size = clamp_page(page, page_size)
    statement = (
        select(StockCount, Warehouse.name, User.full_name)
        .join(Warehouse, Warehouse.id == StockCount.warehouse_id)
        .outerjoin(
            User, and_(User.id == StockCount.counted_by, User.company_id == company_id)
        )
        .where(StockCount.company_id == company_id)
    )
    if status:
        statement = statement.where(StockCount.status == status)
    if warehouse_id:
        statement = statement.where(StockCount.warehouse_id == warehouse_id)

    rows = db.execute(statement.order_by(StockCount.created_at.desc())).all()
    counts = _count_item_counts(db, company_id)
    payload = [
        _serialize_count(count, warehouse_name, user_name or '', counts.get(count.id, 0))
        for count, warehouse_name, user_name in rows
    ]
    return paginate(payload, page, page_size)


def get_stock_count(db: Session, company_id: int, count_id: int) -> dict:
    count = _get_count(db, company_id, count_id)
    warehouse_name = db.execute(
        select(Warehouse.name).where(
            Warehouse.id == count.warehouse_id, Warehouse.company_id == company_id
        )
    ).scalar_one_or_none()
    counted_by_name = ''
    if count.counted_by:
        counted_by_name = db.execute(
            select(User.full_name).where(
                User.id == count.counted_by, User.company_id == company_id
            )
        ).scalar_one_or_none() or ''
    items = _count_items(db, company_id, count.id)
    data = _serialize_count(count, warehouse_name or '', counted_by_name, len(items))
    data['items'] = items
    return data


def _validate_count_items(
    db: Session, company_id: int, items: List[StockCountItemInput]
) -> List[int]:
    product_ids = [item.product_id for item in items]
    if len(set(product_ids)) != len(product_ids):
        raise Conflict('Hay productos repetidos en el conteo.')

    existing = set(
        db.execute(
            select(Product.id).where(
                Product.company_id == company_id, Product.id.in_(product_ids)
            )
        ).scalars().all()
    )
    for product_id in product_ids:
        if product_id not in existing:
            raise NotFound(f'Producto {product_id} no encontrado.')
    return product_ids


def _replace_count_items(
    db: Session, company_id: int, count: StockCount, items: List[StockCountItemInput]
) -> None:
    product_ids = _validate_count_items(db, company_id, items)

    stocks = {
        row.product_id: row.stock
        for row in db.execute(
            select(Inventory).where(Inventory.product_id.in_(product_ids))
        ).scalars().all()
    }

    db.execute(
        delete(StockCountDetail).where(StockCountDetail.stock_count_id == count.id)
    )
    for item in items:
        expected = stocks.get(item.product_id, 0)
        db.add(
            StockCountDetail(
                stock_count_id=count.id,
                product_id=item.product_id,
                expected_qty=expected,
                counted_qty=item.counted_qty,
                difference=item.counted_qty - expected,
            )
        )


def create_stock_count(
    db: Session,
    company_id: int,
    payload: StockCountCreate,
    actor=None,
    ip: Optional[str] = None,
) -> dict:
    warehouse = _get_warehouse(db, company_id, payload.warehouse_id)
    _validate_count_items(db, company_id, payload.items)

    count = StockCount(
        company_id=company_id,
        warehouse_id=warehouse.id,
        count_number=_next_count_number(db, company_id),
        status='draft',
        notes=payload.notes,
        counted_by=actor.id if actor else None,
    )
    db.add(count)
    db.flush()
    _replace_count_items(db, company_id, count, payload.items)

    write_audit(
        db, user=actor, action='stock_count.create', entity='conteos_stock',
        entity_id=count.id, detail={'count_number': count.count_number},
        ip_address=ip,
    )
    db.commit()
    return get_stock_count(db, company_id, count.id)


def update_stock_count(
    db: Session,
    company_id: int,
    count_id: int,
    payload: StockCountUpdate,
    actor=None,
    ip: Optional[str] = None,
) -> dict:
    count = _get_count(db, company_id, count_id)
    if count.status != 'draft':
        raise BusinessRuleError('Solo los conteos en borrador se pueden editar.')

    _get_warehouse(db, company_id, payload.warehouse_id)
    _validate_count_items(db, company_id, payload.items)
    data = payload.model_dump(exclude_unset=True)
    count.warehouse_id = payload.warehouse_id
    if 'notes' in data:
        count.notes = data['notes']
    _replace_count_items(db, company_id, count, payload.items)

    write_audit(
        db, user=actor, action='stock_count.update', entity='conteos_stock',
        entity_id=count.id, ip_address=ip,
    )
    db.commit()
    return get_stock_count(db, company_id, count.id)


def confirm_stock_count(
    db: Session, company_id: int, count_id: int, actor=None, ip: Optional[str] = None
) -> dict:
    count = _get_count(db, company_id, count_id)
    if count.status != 'draft':
        raise BusinessRuleError('Solo los conteos en borrador se pueden confirmar.')

    details = db.execute(
        select(StockCountDetail).where(StockCountDetail.stock_count_id == count.id)
    ).scalars().all()

    adjustments = 0
    for detail in details:
        if detail.difference == 0:
            continue
        _, inventory, _ = apply_stock(
            db, company_id, detail.product_id, detail.difference, actor=actor, ip=ip
        )
        db.add(
            InventoryMovement(
                product_id=detail.product_id,
                movement_type='adjustment',
                quantity=abs(detail.difference),
                reason=f'Conteo {count.count_number}',
                resulting_stock=inventory.stock,
                reference_id=count.id,
                created_by=actor.id if actor else None,
            )
        )
        adjustments += 1

    count.status = 'done'
    write_audit(
        db, user=actor, action='stock_count.confirm', entity='conteos_stock',
        entity_id=count.id, detail={'adjustments': adjustments}, ip_address=ip,
    )
    db.commit()
    return get_stock_count(db, company_id, count.id)


def delete_stock_count(
    db: Session, company_id: int, count_id: int, actor=None, ip: Optional[str] = None
) -> dict:
    count = _get_count(db, company_id, count_id)
    if count.status != 'draft':
        raise BusinessRuleError('Solo los conteos en borrador se pueden eliminar.')

    count_id_saved = count.id
    write_audit(
        db, user=actor, action='stock_count.delete', entity='conteos_stock',
        entity_id=count_id_saved, ip_address=ip,
    )
    db.execute(delete(StockCountDetail).where(StockCountDetail.stock_count_id == count_id_saved))
    db.delete(count)
    db.commit()
    return {'id': count_id_saved, 'deleted': True}
