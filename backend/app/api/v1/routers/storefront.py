"""Storefront público de la tienda web: catálogo y cotizaciones sin token.

Endpoints abiertos (sin JWT): el aislamiento por empresa se resuelve con
``settings.storefront_company_id`` (fallback: la primera empresa registrada).
"""

from __future__ import annotations

import re
import unicodedata
from typing import Optional

from fastapi import APIRouter, Depends, Query, Request, status
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.api.deps import client_ip
from app.core.config import settings
from app.core.database import get_db
from app.core.exceptions import AppError, BusinessRuleError, NotFound
from app.models.company import Company
from app.models.customer import Customer
from app.models.inventory import Inventory
from app.models.product import Product
from app.models.quote import Quote
from app.schemas.customer import CustomerCreate
from app.schemas.quotes import QuoteCreate, QuoteItemInput, QuoteStatusUpdate
from app.schemas.storefront import StoreContactCreate, StoreQuoteCreate
from app.schemas.system import NotificationCreate
from app.services import customer_service, product_service, quote_service, system_service
from app.services.event_service import log_app_event

router = APIRouter(prefix='/store', tags=['storefront'])


def _slugify(value: str) -> str:
    normalized = unicodedata.normalize('NFD', value or '')
    stripped = ''.join(ch for ch in normalized if unicodedata.category(ch) != 'Mn')
    slug = re.sub(r'[^a-z0-9]+', '-', stripped.lower()).strip('-')
    return slug or 'categoria'


def _company_id(db: Session) -> int:
    company = db.get(Company, settings.storefront_company_id)
    if company is None:
        company = db.execute(select(Company).order_by(Company.id)).scalars().first()
    if company is None:
        raise NotFound('Empresa no configurada.')
    return company.id


def _store_product(row: dict) -> dict:
    """Versión pública del producto: sin costo y con slug de categoría."""
    category = row.get('category')
    return {
        'id': row['id'],
        'sku': row['sku'],
        'name': row['name'],
        'description': row['description'],
        'category': ({**category, 'slug': _slugify(category['name'])} if category else None),
        'brand': row['brand'],
        'sale_price': row['sale_price'],
        'wholesale_price': row['wholesale_price'],
        'image_url': row['image_url'],
        'is_featured': row['is_featured'],
        'current_stock': row['current_stock'],
        'unit': row['unit'],
        'status': row['status'],
    }


@router.get('/products')
def store_products(
    db: Session = Depends(get_db),
    q: str = Query(default='', max_length=100),
    category: str = Query(default='', max_length=100),
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=50, ge=1, le=100),
):
    company_id = _company_id(db)

    category_id: Optional[int] = None
    if category:
        slug = _slugify(category)
        rows = product_service.list_categories(db, company_id)['items']
        match = next((row for row in rows if _slugify(row['name']) == slug), None)
        if match is None:
            return {'items': [], 'total': 0, 'page': page, 'page_size': page_size, 'pages': 0}
        category_id = match['id']

    result = product_service.list_products(
        db, company_id, q=q, status='active', category_id=category_id,
        page=page, page_size=page_size,
    )
    result['items'] = [_store_product(item) for item in result['items']]
    return result


@router.get('/products/{product_id}')
def store_product(product_id: int, db: Session = Depends(get_db)):
    company_id = _company_id(db)
    row = product_service.get_product(db, company_id, product_id)
    if row['status'] != 'active':
        raise NotFound('Producto no encontrado.')
    return _store_product(row)


@router.get('/categories')
def store_categories(db: Session = Depends(get_db)):
    company_id = _company_id(db)
    result = product_service.list_categories(db, company_id)
    items = [
        {**row, 'slug': _slugify(row['name'])}
        for row in result['items']
        if row['status'] == 'active'
    ]
    return {
        'items': items,
        'total': len(items),
        'page': 1,
        'page_size': max(len(items), 1),
        'pages': 1,
    }


def _next_document(db: Session, company_id: int) -> str:
    """DNI sintético único para los clientes creados desde la tienda."""
    seq = db.execute(
        select(func.count(Customer.id)).where(Customer.company_id == company_id)
    ).scalar_one() + 1
    while True:
        candidate = f'9{seq:09d}'
        taken = db.execute(
            select(Customer.id).where(
                Customer.company_id == company_id,
                Customer.document_number == candidate,
            )
        ).scalar_one_or_none()
        if taken is None:
            return candidate
        seq += 1


def _find_or_create_customer(db: Session, company_id: int, payload: StoreQuoteCreate, ip: str) -> Customer:
    data = payload.customer
    statement = select(Customer).where(Customer.company_id == company_id)
    customer = None
    if data.email:
        customer = db.execute(statement.where(Customer.email == str(data.email))).scalars().first()
    if customer is None and data.phone:
        customer = db.execute(statement.where(Customer.phone == data.phone)).scalars().first()
    if customer is not None:
        changed = False
        if not customer.phone and data.phone:
            customer.phone = data.phone
            changed = True
        if not customer.email and data.email:
            customer.email = str(data.email)
            changed = True
        if changed:
            db.commit()
        return customer

    created = customer_service.create_customer(
        db,
        company_id,
        CustomerCreate(
            document_number=_next_document(db, company_id),
            name=data.name,
            email=data.email,
            phone=data.phone,
            segment='Tienda Web',
        ),
        actor=None,
        ip=ip,
    )
    return db.get(Customer, created['id'])


def _validate_store_stock(db: Session, company_id: int, payload: StoreQuoteCreate, by_id: dict) -> None:
    """RN-10 en la tienda: no se confirma un pedido con menos stock del pedido."""
    stock_rows = db.execute(
        select(Inventory.product_id, Inventory.stock).where(
            Inventory.product_id.in_([item.product_id for item in payload.items])
        )
    ).all()
    available_map = {row[0]: row[1] for row in stock_rows}
    for item in payload.items:
        available = available_map.get(item.product_id, 0)
        if item.quantity > available:
            raise BusinessRuleError(
                f'Stock insuficiente de {by_id[item.product_id].name}: '
                f'pediste {item.quantity} y hay {available} disponibles.'
            )


def _discard_unconverted_quote(db: Session, company_id: int, quote_id: int) -> None:
    """Elimina la cotización si la conversión a venta falló (no dejar huérfanos)."""
    try:
        row = db.get(Quote, quote_id)
        if row is None or row.status == 'converted':
            return
        row.status = 'draft'
        db.commit()
        quote_service.delete_quote(db, company_id, quote_id, actor=None)
    except Exception:  # noqa: BLE001 - la limpieza no debe enmascarar el error original
        db.rollback()


@router.post('/quotes', status_code=status.HTTP_201_CREATED)
def store_quote(payload: StoreQuoteCreate, request: Request, db: Session = Depends(get_db)):
    """Registra el pedido de la tienda: cotización + venta automática en SalesIA.

    Los precios se recalculan en servidor con el catálogo vigente (RN-11),
    ``tax_rate=0`` para coincidir con el subtotal mostrado en la tienda y la
    cotización se convierte de inmediato en venta: valida stock (RN-10),
    lo descuenta con kardex y la venta queda en ``ventas`` para estadísticas.
    """
    company_id = _company_id(db)
    ip = client_ip(request)
    customer = _find_or_create_customer(db, company_id, payload, ip)

    product_ids = [item.product_id for item in payload.items]
    rows = db.execute(
        select(Product).where(
            Product.company_id == company_id,
            Product.id.in_(product_ids),
            Product.is_active.is_(True),
        )
    ).scalars().all()
    by_id = {row.id: row for row in rows}
    missing = [pid for pid in product_ids if pid not in by_id]
    if missing:
        raise NotFound(f'Producto {missing[0]} no encontrado.')

    items = [
        QuoteItemInput(
            product_id=item.product_id,
            quantity=item.quantity,
            unit_price=float(by_id[item.product_id].price),
            discount=0,
        )
        for item in payload.items
    ]

    notes = 'Generado desde la tienda web (precios sin IGV adicional).'
    if payload.notes:
        notes = f'{notes} {payload.notes}'
    quote = quote_service.create_quote(
        db,
        company_id,
        QuoteCreate(customer_id=customer.id, items=items, tax_rate=0.0, notes=notes[:500]),
        actor=None,
        ip=ip,
    )

    try:
        _validate_store_stock(db, company_id, payload, by_id)
        quote_service.update_quote_status(
            db, company_id, quote['id'], QuoteStatusUpdate(status='approved'), actor=None, ip=ip
        )
        converted = quote_service.convert_quote(db, company_id, quote['id'], actor=None, ip=ip)
    except AppError:
        db.rollback()
        _discard_unconverted_quote(db, company_id, quote['id'])
        raise

    return {
        **quote,
        'status': 'converted',
        'sale_id': converted['sale_id'],
        'sale_number': converted['sale_number'],
    }


@router.post('/contact', status_code=status.HTTP_201_CREATED)
def store_contact(payload: StoreContactCreate, request: Request, db: Session = Depends(get_db)):
    """Recibe el formulario de contacto de la tienda y lo registra en SalesIA.

    Crea una notificación para los administradores (campana del sistema) y
    deja el evento en auditoría; la tienda solo muestra éxito si esto responde 201.
    """
    company_id = _company_id(db)
    ip = client_ip(request)
    message = payload.message.strip()
    summary = message if len(message) <= 180 else f'{message[:177]}…'

    system_service.create_notification(
        db,
        company_id,
        NotificationCreate(
            title=f'Mensaje de la tienda · {payload.name.strip()}',
            message=f'{summary} · Correo: {payload.email} · Tel: {payload.phone}',
            level='info',
            module='tienda',
            target_role='Admin',
            detail={
                'source': 'storefront',
                'name': payload.name.strip(),
                'email': payload.email,
                'phone': payload.phone,
                'message': message,
            },
        ),
        actor=None,
        ip=ip,
    )
    log_app_event(
        db,
        event_type='store.contact',
        company_id=company_id,
        entity='contacto',
        entity_id=0,
        payload={'name': payload.name.strip(), 'email': payload.email, 'phone': payload.phone},
    )
    db.commit()
    return {'status': 'ok', 'message': 'Mensaje recibido. Te contactaremos pronto.'}
