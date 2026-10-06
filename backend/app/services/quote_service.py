"""Cotizaciones: creación, estados y conversión en venta (BE-1)."""

from __future__ import annotations

from datetime import datetime, timezone
from typing import Dict, List, Optional

from sqlalchemy import delete, func, or_, select
from sqlalchemy.orm import Session

from app.core.exceptions import BusinessRuleError, NotFound, ValidationAppError
from app.models.customer import Customer
from app.models.employee import Employee
from app.models.product import Product
from app.models.quote import Quote, QuoteDetail
from app.schemas.quotes import QuoteCreate, QuoteItemInput, QuoteStatusUpdate, QuoteUpdate
from app.schemas.sale import SaleCreate, SaleItemInput
from app.services import sale_service
from app.services.audit_service import write_audit
from app.services.event_service import log_app_event
from app.utils.helpers import as_float, clamp_page, paginate

QUOTE_STATUSES = ('draft', 'sent', 'approved', 'rejected', 'expired')
EDITABLE_STATUSES = ('draft', 'sent')


def _tax_rate(quote: Quote) -> float:
    """Sin columna tax_rate: se deriva de tax/subtotal para re-editar (BE-1)."""
    subtotal = as_float(quote.subtotal)
    return as_float(quote.tax) / subtotal if subtotal > 0 else 0.18


def _serialize(quote: Quote, customer_name: str, item_count: int) -> dict:
    return {
        'id': quote.id,
        'quote_number': quote.quote_number,
        'customer_id': quote.customer_id,
        'customer_name': customer_name,
        'status': quote.status,
        'valid_until': quote.valid_until,
        'subtotal': as_float(quote.subtotal),
        'tax': as_float(quote.tax),
        'total': as_float(quote.total),
        'tax_rate': _tax_rate(quote),
        'notes': quote.notes,
        'item_count': item_count,
        'created_at': quote.created_at,
    }


def _line_subtotal(item) -> float:
    return round(item.quantity * item.unit_price - item.discount, 2)


def _compute_totals(items: List[QuoteItemInput], tax_rate: float) -> tuple[float, float, float]:
    """RN-11: los importes se calculan siempre en el servidor."""
    subtotal = round(sum(item.quantity * item.unit_price - item.discount for item in items), 2)
    tax = round(subtotal * tax_rate, 2)
    return subtotal, tax, round(subtotal + tax, 2)


def _get(db: Session, company_id: int, quote_id: int) -> Quote:
    quote = db.execute(
        select(Quote).where(Quote.id == quote_id, Quote.company_id == company_id)
    ).scalar_one_or_none()
    if quote is None:
        raise NotFound('Cotización no encontrada.')
    return quote


def _next_quote_number(db: Session, company_id: int) -> str:
    year = datetime.now(timezone.utc).year
    count = db.execute(
        select(func.count(Quote.id)).where(
            Quote.company_id == company_id, Quote.quote_number.like(f'COT-{year}-%')
        )
    ).scalar_one()
    return f'COT-{year}-{count + 1:04d}'


def _item_counts(db: Session, quote_ids: List[int]) -> Dict[int, int]:
    if not quote_ids:
        return {}
    rows = db.execute(
        select(QuoteDetail.quote_id, func.count(QuoteDetail.id))
        .where(QuoteDetail.quote_id.in_(quote_ids))
        .group_by(QuoteDetail.quote_id)
    ).all()
    return {row[0]: row[1] for row in rows}


def _validate_customer(db: Session, company_id: int, customer_id: int) -> None:
    customer = db.execute(
        select(Customer).where(Customer.id == customer_id, Customer.company_id == company_id)
    ).scalar_one_or_none()
    if customer is None:
        raise NotFound('Cliente no encontrado.')


def _validate_products(db: Session, company_id: int, product_ids: List[int]) -> None:
    found = set(
        db.execute(
            select(Product.id).where(Product.company_id == company_id, Product.id.in_(product_ids))
        ).scalars().all()
    )
    for product_id in product_ids:
        if product_id not in found:
            raise NotFound(f'Producto {product_id} no encontrado.')


def _replace_details(db: Session, quote: Quote, items: List[QuoteItemInput]) -> None:
    db.execute(delete(QuoteDetail).where(QuoteDetail.quote_id == quote.id))
    for item in items:
        db.add(
            QuoteDetail(
                quote_id=quote.id,
                product_id=item.product_id,
                quantity=item.quantity,
                unit_price=item.unit_price,
                discount=item.discount,
                subtotal=_line_subtotal(item),
            )
        )


def list_quotes(
    db: Session,
    company_id: int,
    *,
    q: str = '',
    status: str = '',
    customer_id: Optional[int] = None,
    page: int = 1,
    page_size: int = 20,
) -> dict:
    page, page_size = clamp_page(page, page_size)
    statement = (
        select(Quote, Customer.name)
        .join(Customer, Customer.id == Quote.customer_id)
        .where(Quote.company_id == company_id)
    )
    if status:
        statement = statement.where(Quote.status == status)
    if customer_id:
        statement = statement.where(Quote.customer_id == customer_id)
    if q:
        term = f'%{q.strip()}%'
        statement = statement.where(
            or_(Quote.quote_number.ilike(term), Customer.name.ilike(term))
        )

    rows = db.execute(statement.order_by(Quote.id.desc())).all()
    counts = _item_counts(db, [row[0].id for row in rows])
    payload = [_serialize(row[0], row[1], counts.get(row[0].id, 0)) for row in rows]
    return paginate(payload, page, page_size)


def get_quote(db: Session, company_id: int, quote_id: int) -> dict:
    quote = _get(db, company_id, quote_id)
    customer = db.get(Customer, quote.customer_id)
    rows = db.execute(
        select(QuoteDetail, Product.name)
        .join(Product, Product.id == QuoteDetail.product_id)
        .where(QuoteDetail.quote_id == quote.id)
        .order_by(QuoteDetail.id)
    ).all()

    payload = _serialize(quote, customer.name if customer else '', len(rows))
    payload['items'] = [
        {
            'id': row[0].id,
            'product_id': row[0].product_id,
            'product_name': row[1],
            'quantity': row[0].quantity,
            'unit_price': as_float(row[0].unit_price),
            'discount': as_float(row[0].discount),
            'subtotal': as_float(row[0].subtotal),
        }
        for row in rows
    ]
    return payload


def create_quote(
    db: Session, company_id: int, payload: QuoteCreate, actor=None, ip: Optional[str] = None
) -> dict:
    _validate_customer(db, company_id, payload.customer_id)
    _validate_products(db, company_id, [item.product_id for item in payload.items])
    subtotal, tax, total = _compute_totals(payload.items, payload.tax_rate)

    quote = Quote(
        company_id=company_id,
        customer_id=payload.customer_id,
        quote_number=_next_quote_number(db, company_id),
        status='draft',
        valid_until=payload.valid_until,
        subtotal=subtotal,
        tax=tax,
        total=total,
        notes=payload.notes,
        created_by=actor.id if actor else None,
    )
    db.add(quote)
    db.flush()
    _replace_details(db, quote, payload.items)

    write_audit(
        db,
        user=actor,
        action='quote.create',
        entity='cotizaciones',
        entity_id=quote.id,
        detail={'quote_number': quote.quote_number, 'total': total},
        ip_address=ip,
    )
    db.commit()
    return get_quote(db, company_id, quote.id)


def update_quote(
    db: Session,
    company_id: int,
    quote_id: int,
    payload: QuoteUpdate,
    actor=None,
    ip: Optional[str] = None,
) -> dict:
    quote = _get(db, company_id, quote_id)
    if quote.status not in EDITABLE_STATUSES:
        raise BusinessRuleError('Solo las cotizaciones borrador o enviadas se pueden editar.')

    _validate_customer(db, company_id, payload.customer_id)
    _validate_products(db, company_id, [item.product_id for item in payload.items])
    subtotal, tax, total = _compute_totals(payload.items, payload.tax_rate)

    quote.customer_id = payload.customer_id
    quote.valid_until = payload.valid_until
    quote.notes = payload.notes
    quote.subtotal = subtotal
    quote.tax = tax
    quote.total = total
    _replace_details(db, quote, payload.items)

    write_audit(
        db,
        user=actor,
        action='quote.update',
        entity='cotizaciones',
        entity_id=quote.id,
        detail={'quote_number': quote.quote_number, 'total': total},
        ip_address=ip,
    )
    db.commit()
    return get_quote(db, company_id, quote.id)


def update_quote_status(
    db: Session,
    company_id: int,
    quote_id: int,
    payload: QuoteStatusUpdate,
    actor=None,
    ip: Optional[str] = None,
) -> dict:
    if payload.status not in QUOTE_STATUSES:
        raise ValidationAppError(
            'Estado no válido: use draft, sent, approved, rejected o expired.'
        )

    quote = _get(db, company_id, quote_id)
    if quote.status == 'converted':
        raise BusinessRuleError('La cotización convertida en venta no puede cambiar de estado.')

    quote.status = payload.status
    write_audit(
        db,
        user=actor,
        action='quote.status',
        entity='cotizaciones',
        entity_id=quote.id,
        detail={'quote_number': quote.quote_number, 'status': quote.status},
        ip_address=ip,
    )
    db.commit()
    return get_quote(db, company_id, quote.id)


def convert_quote(
    db: Session, company_id: int, quote_id: int, actor=None, ip: Optional[str] = None
) -> dict:
    """Aprueba la salida a venta: create_sale hace su propio commit (BE-1)."""
    quote = _get(db, company_id, quote_id)
    if quote.status != 'approved':
        raise BusinessRuleError('La cotización debe estar aprobada para convertirla en venta.')

    details = db.execute(
        select(QuoteDetail).where(QuoteDetail.quote_id == quote.id).order_by(QuoteDetail.id)
    ).scalars().all()

    # RN-07: el vendedor del usuario actual (empleados.user_id) o el primero activo.
    actor_user_id = actor.id if actor else None
    seller = None
    if actor_user_id is not None:
        seller = db.execute(
            select(Employee).where(
                Employee.company_id == company_id,
                Employee.user_id == actor_user_id,
            )
        ).scalar_one_or_none()
    if seller is None:
        seller = db.execute(
            select(Employee)
            .where(Employee.company_id == company_id, Employee.is_active.is_(True))
            .order_by(Employee.id)
        ).scalars().first()
    if seller is None:
        raise ValidationAppError('No hay vendedores registrados para convertir la cotización.')

    payload = SaleCreate(
        customer_id=quote.customer_id,
        seller_id=seller.id,
        items=[
            SaleItemInput(
                product_id=detail.product_id,
                quantity=detail.quantity,
                unit_price=as_float(detail.unit_price),
                discount=as_float(detail.discount),
            )
            for detail in details
        ],
        payment=None,
        tax_rate=_tax_rate(quote),
        notes=quote.notes,
    )
    sale = sale_service.create_sale(db, company_id, payload, actor=actor, ip=ip)

    quote.status = 'converted'
    log_app_event(
        db,
        event_type='quote.converted',
        company_id=company_id,
        entity='cotizaciones',
        entity_id=quote.id,
        payload={'quote_number': quote.quote_number, 'sale_number': sale['sale_number']},
    )
    write_audit(
        db,
        user=actor,
        action='quote.convert',
        entity='cotizaciones',
        entity_id=quote.id,
        detail={'quote_number': quote.quote_number, 'sale_number': sale['sale_number']},
        ip_address=ip,
    )
    db.commit()
    return {
        'quote_number': quote.quote_number,
        'sale_id': sale['id'],
        'sale_number': sale['sale_number'],
    }


def delete_quote(
    db: Session, company_id: int, quote_id: int, actor=None, ip: Optional[str] = None
) -> dict:
    quote = _get(db, company_id, quote_id)
    if quote.status != 'draft':
        raise BusinessRuleError('Solo las cotizaciones en borrador se pueden eliminar.')

    quote_number = quote.quote_number
    write_audit(
        db,
        user=actor,
        action='quote.delete',
        entity='cotizaciones',
        entity_id=quote.id,
        detail={'quote_number': quote_number},
        ip_address=ip,
    )
    db.execute(delete(QuoteDetail).where(QuoteDetail.quote_id == quote.id))
    db.delete(quote)
    db.commit()
    return {'id': quote_id, 'deleted': True}
