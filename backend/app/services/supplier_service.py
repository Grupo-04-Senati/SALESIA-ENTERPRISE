"""Proveedores: CRUD, RUC único por empresa y baja lógica (BE-1)."""

from __future__ import annotations

from typing import Optional

from sqlalchemy import or_, select
from sqlalchemy.orm import Session

from app.core.exceptions import Conflict, NotFound
from app.models.supplier import Supplier
from app.schemas.suppliers import SupplierCreate, SupplierUpdate
from app.services.audit_service import write_audit
from app.utils.helpers import clamp_page, paginate
from app.utils.validators import valid_email


def _serialize(supplier: Supplier) -> dict:
    return {
        'id': supplier.id,
        'ruc': supplier.ruc,
        'name': supplier.name,
        'email': supplier.email,
        'phone': supplier.phone,
        'address': supplier.address,
        'status': 'active' if supplier.is_active else 'inactive',
    }


def _get(db: Session, company_id: int, supplier_id: int) -> Supplier:
    supplier = db.execute(
        select(Supplier).where(Supplier.id == supplier_id, Supplier.company_id == company_id)
    ).scalar_one_or_none()
    if supplier is None:
        raise NotFound('Proveedor no encontrado.')
    return supplier


def _clean(payload: SupplierCreate | SupplierUpdate) -> dict:
    data = payload.model_dump()
    data['email'] = (data.get('email') or '').strip() or None
    valid_email(data['email'] or '')
    return data


def _duplicated(db: Session, company_id: int, ruc: str, supplier_id: Optional[int] = None) -> bool:
    statement = select(Supplier).where(Supplier.company_id == company_id, Supplier.ruc == ruc)
    if supplier_id:
        statement = statement.where(Supplier.id != supplier_id)
    return db.execute(statement).scalar_one_or_none() is not None


def list_suppliers(
    db: Session,
    company_id: int,
    *,
    q: str = '',
    status: str = '',
    page: int = 1,
    page_size: int = 20,
) -> dict:
    page, page_size = clamp_page(page, page_size)
    statement = select(Supplier).where(Supplier.company_id == company_id)

    if status == 'active':
        statement = statement.where(Supplier.is_active.is_(True))
    elif status == 'inactive':
        statement = statement.where(Supplier.is_active.is_(False))
    if q:
        term = f'%{q.strip()}%'
        statement = statement.where(or_(Supplier.name.ilike(term), Supplier.ruc.ilike(term)))

    suppliers = db.execute(statement.order_by(Supplier.name)).scalars().all()
    return paginate([_serialize(row) for row in suppliers], page, page_size)


def get_supplier(db: Session, company_id: int, supplier_id: int) -> dict:
    return _serialize(_get(db, company_id, supplier_id))


def create_supplier(
    db: Session, company_id: int, payload: SupplierCreate, actor=None, ip: Optional[str] = None
) -> dict:
    data = _clean(payload)
    if _duplicated(db, company_id, data['ruc']):
        raise Conflict('Ya existe un proveedor con ese RUC.')

    supplier = Supplier(company_id=company_id, **data)
    db.add(supplier)
    db.flush()
    write_audit(
        db,
        user=actor,
        action='supplier.create',
        entity='proveedores',
        entity_id=supplier.id,
        detail={'ruc': supplier.ruc, 'name': supplier.name},
        ip_address=ip,
    )
    db.commit()
    return _serialize(supplier)


def update_supplier(
    db: Session,
    company_id: int,
    supplier_id: int,
    payload: SupplierUpdate,
    actor=None,
    ip: Optional[str] = None,
) -> dict:
    supplier = _get(db, company_id, supplier_id)
    data = _clean(payload)
    if _duplicated(db, company_id, data['ruc'], supplier_id):
        raise Conflict('Ya existe un proveedor con ese RUC.')

    for field, value in data.items():
        setattr(supplier, field, value)

    write_audit(
        db,
        user=actor,
        action='supplier.update',
        entity='proveedores',
        entity_id=supplier.id,
        detail={'ruc': supplier.ruc},
        ip_address=ip,
    )
    db.commit()
    return _serialize(supplier)


def deactivate_supplier(
    db: Session, company_id: int, supplier_id: int, actor=None, ip: Optional[str] = None
) -> dict:
    """Baja lógica: las órdenes de compra históricas se conservan."""
    supplier = _get(db, company_id, supplier_id)
    supplier.is_active = False

    write_audit(
        db,
        user=actor,
        action='supplier.deactivate',
        entity='proveedores',
        entity_id=supplier.id,
        detail={'ruc': supplier.ruc},
        ip_address=ip,
    )
    db.commit()
    return _serialize(supplier)
