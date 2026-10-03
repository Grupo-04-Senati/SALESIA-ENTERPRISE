"""Clientes: CRUD, historial y métricas de compra (RF-03 · RN-01, RN-02)."""

from __future__ import annotations

from typing import Dict, List, Optional, Tuple

from sqlalchemy import func, or_, select
from sqlalchemy.orm import Session

from app.core.exceptions import Conflict, NotFound
from app.models.customer import Customer
from app.models.sale import Sale
from app.schemas.customer import CustomerCreate, CustomerUpdate
from app.services.audit_service import write_audit
from app.utils.helpers import clamp_page, paginate
from app.utils.validators import valid_email


def _purchase_stats(db: Session, company_id: int) -> Dict[int, Tuple[int, float]]:
    """Compras y monto acumulado por cliente (las anuladas no cuentan, RN-44)."""
    rows = db.execute(
        select(Sale.customer_id, func.count(Sale.id), func.coalesce(func.sum(Sale.total), 0))
        .where(Sale.company_id == company_id, Sale.status != 'cancelled', Sale.customer_id.isnot(None))
        .group_by(Sale.customer_id)
    ).all()
    return {row[0]: (row[1], float(row[2])) for row in rows}


def _serialize(customer: Customer, stats: Dict[int, Tuple[int, float]]) -> dict:
    count, total = stats.get(customer.id, (0, 0.0))
    return {
        'id': customer.id,
        'document_type': customer.document_type,
        'document_number': customer.document_number,
        'name': customer.name,
        'email': customer.email,
        'phone': customer.phone or '',
        'address': customer.address or '',
        'segment': customer.segment,
        'status': 'active' if customer.is_active else 'inactive',
        'created_at': customer.created_at,
        'purchase_count': count,
        'total_purchased': round(total, 2),
    }


def list_customers(
    db: Session,
    company_id: int,
    *,
    q: str = '',
    status: str = '',
    segment: str = '',
    page: int = 1,
    page_size: int = 20,
) -> dict:
    page, page_size = clamp_page(page, page_size)
    statement = select(Customer).where(Customer.company_id == company_id)

    if status == 'active':
        statement = statement.where(Customer.is_active.is_(True))
    elif status == 'inactive':
        statement = statement.where(Customer.is_active.is_(False))
    if segment:
        statement = statement.where(Customer.segment == segment)
    if q:
        term = f'%{q.strip()}%'
        statement = statement.where(
            or_(
                Customer.name.ilike(term),
                Customer.document_number.ilike(term),
                Customer.email.ilike(term),
            )
        )

    customers = db.execute(statement.order_by(Customer.name)).scalars().all()
    stats = _purchase_stats(db, company_id)
    payload = [_serialize(customer, stats) for customer in customers]
    return paginate(payload, page, page_size)


def get_customer(db: Session, company_id: int, customer_id: int) -> dict:
    customer = db.execute(
        select(Customer).where(Customer.id == customer_id, Customer.company_id == company_id)
    ).scalar_one_or_none()
    if customer is None:
        raise NotFound('Cliente no encontrado.')
    return _serialize(customer, _purchase_stats(db, company_id))


def create_customer(
    db: Session, company_id: int, payload: CustomerCreate, actor=None, ip: Optional[str] = None
) -> dict:
    valid_email(payload.email or '')
    duplicated = db.execute(
        select(Customer).where(
            Customer.company_id == company_id,
            Customer.document_number == payload.document_number,
        )
    ).scalar_one_or_none()
    if duplicated:
        raise Conflict('Ya existe un cliente con ese documento (RN-01).')

    customer = Customer(company_id=company_id, **payload.model_dump())
    db.add(customer)
    db.flush()
    write_audit(
        db,
        user=actor,
        action='customer.create',
        entity='customers',
        entity_id=customer.id,
        detail={'document_number': payload.document_number},
        ip_address=ip,
    )
    db.commit()
    return _serialize(customer, {})


def update_customer(
    db: Session,
    company_id: int,
    customer_id: int,
    payload: CustomerUpdate,
    actor=None,
    ip: Optional[str] = None,
) -> dict:
    customer = db.execute(
        select(Customer).where(Customer.id == customer_id, Customer.company_id == company_id)
    ).scalar_one_or_none()
    if customer is None:
        raise NotFound('Cliente no encontrado.')

    valid_email(payload.email or '')
    duplicated = db.execute(
        select(Customer).where(
            Customer.company_id == company_id,
            Customer.document_number == payload.document_number,
            Customer.id != customer_id,
        )
    ).scalar_one_or_none()
    if duplicated:
        raise Conflict('Ya existe un cliente con ese documento (RN-01).')

    for field, value in payload.model_dump().items():
        setattr(customer, field, value)

    write_audit(
        db,
        user=actor,
        action='customer.update',
        entity='customers',
        entity_id=customer.id,
        ip_address=ip,
    )
    db.commit()
    return _serialize(customer, _purchase_stats(db, company_id))


def deactivate_customer(
    db: Session, company_id: int, customer_id: int, actor=None, ip: Optional[str] = None
) -> dict:
    """Baja lógica (RN-02): el historial de compras se conserva."""
    customer = db.execute(
        select(Customer).where(Customer.id == customer_id, Customer.company_id == company_id)
    ).scalar_one_or_none()
    if customer is None:
        raise NotFound('Cliente no encontrado.')

    customer.is_active = False
    write_audit(
        db,
        user=actor,
        action='customer.deactivate',
        entity='customers',
        entity_id=customer.id,
        ip_address=ip,
    )
    db.commit()
    return _serialize(customer, _purchase_stats(db, company_id))


def customer_history(db: Session, company_id: int, customer_id: int) -> dict:
    customer = db.execute(
        select(Customer).where(Customer.id == customer_id, Customer.company_id == company_id)
    ).scalar_one_or_none()
    if customer is None:
        raise NotFound('Cliente no encontrado.')

    sales = db.execute(
        select(Sale)
        .where(Sale.company_id == company_id, Sale.customer_id == customer_id)
        .order_by(Sale.sold_at.desc())
    ).scalars().all()

    history = [
        {
            'sale_number': sale.sale_number,
            'issued_at': sale.sold_at,
            'total': float(sale.total),
            'status': sale.status,
        }
        for sale in sales
    ]
    return {'customer': _serialize(customer, _purchase_stats(db, company_id)), 'history': history}
