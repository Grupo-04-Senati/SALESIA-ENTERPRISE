"""Storefront de la tienda web: catálogo público, cuenta de cliente y pedidos.

El catálogo y el contacto son públicos; registrar un pedido, ver «Mis pedidos»,
marcar la llegada y reclamar exigen sesión de cliente (JWT tipo ``customer``).
El aislamiento por empresa se resuelve con ``settings.storefront_company_id``
(fallback: la primera empresa registrada).
"""

from __future__ import annotations

import logging
import re
import unicodedata
from typing import Optional

import jwt
from fastapi import APIRouter, Depends, Query, Request, status
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.api.deps import client_ip
from app.core.config import settings
from app.core.database import get_db
from app.core.exceptions import AppError, BusinessRuleError, Conflict, NotFound, Unauthenticated
from app.core.security import create_customer_token, decode_token, hash_password, verify_password
from app.models.company import Company
from app.models.customer import Customer
from app.models.inventory import Inventory
from app.models.product import Product
from app.models.quote import Quote
from app.models.sale import Sale
from app.schemas.customer import CustomerCreate
from app.schemas.quotes import QuoteCreate, QuoteItemInput, QuoteStatusUpdate
from app.schemas.sale import ReceivedUpdate
from app.schemas.storefront import (
    StoreClaimCreate,
    StoreContactCreate,
    StoreLoginInput,
    StoreQuoteCreate,
    StoreRegisterInput,
)
from app.schemas.system import NotificationCreate
from app.services import (
    claim_service,
    customer_service,
    product_service,
    quote_service,
    sale_service,
    system_service,
)
from app.services.event_service import log_app_event

router = APIRouter(prefix='/store', tags=['storefront'])
logger = logging.getLogger(__name__)


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


def _store_token_payload(request: Request) -> Optional[dict]:
    """Payload del JWT de cliente; ``None`` si no hay Authorization."""
    header = request.headers.get('Authorization', '')
    if not header.startswith('Bearer '):
        return None
    token = header[len('Bearer '):].strip()
    try:
        payload = decode_token(token)
    except jwt.PyJWTError:
        raise Unauthenticated('Sesión inválida o expirada. Vuelve a ingresar.')
    if payload.get('type') != 'customer':
        raise Unauthenticated('Sesión inválida.')
    return payload


def _current_store_customer(db: Session, company_id: int, request: Request) -> Customer:
    payload = _store_token_payload(request)
    if payload is None:
        raise Unauthenticated('Inicia sesión para continuar.')
    sub = str(payload.get('sub') or '')
    if not sub.startswith('c'):
        raise Unauthenticated('Sesión inválida.')
    try:
        customer_id = int(sub[1:])
    except ValueError:
        raise Unauthenticated('Sesión inválida.')
    customer = db.get(Customer, customer_id)
    if customer is None or customer.company_id != company_id or not customer.is_active:
        raise Unauthenticated('Sesión inválida.')
    return customer


def _customer_payload(customer: Customer) -> dict:
    return {
        'id': customer.id,
        'name': customer.name,
        'email': customer.email,
        'phone': customer.phone,
        'document_number': customer.document_number,
        'segment': customer.segment,
        'created_at': customer.created_at,
    }


def _auth_response(customer: Customer, company_id: int) -> dict:
    return {
        'access_token': create_customer_token(customer_id=customer.id, company_id=company_id),
        'token_type': 'bearer',
        'customer': _customer_payload(customer),
    }


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

    Solo clientes con sesión pueden comprar (401 sin JWT). Los precios se
    recalculan en servidor con el catálogo vigente (RN-11), ``tax_rate=0`` para
    coincidir con el subtotal mostrado en la tienda y la cotización se convierte
    de inmediato en venta: valida stock (RN-10), lo descuenta con kardex y la
    venta queda en ``ventas`` para estadísticas.
    """
    company_id = _company_id(db)
    ip = client_ip(request)
    customer = _current_store_customer(db, company_id, request)

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

    try:
        system_service.create_notification(
            db,
            company_id,
            NotificationCreate(
                title=f'Nuevo pedido de la tienda · {quote["quote_number"]}',
                message=(
                    f'Venta {converted["sale_number"]} · cliente {quote["customer_name"]} · '
                    f'S/ {float(quote["total"]):.2f} · cotización {quote["quote_number"]} convertida. '
                    'Registrar el pago para dar por atendido el pedido.'
                ),
                level='info',
                module='ventas',
                link=f'/ventas?sale={converted["sale_id"]}',
                detail={
                    'source': 'storefront',
                    'quote_number': quote['quote_number'],
                    'sale_number': converted['sale_number'],
                    'sale_id': converted['sale_id'],
                    'customer': quote['customer_name'],
                    'total': float(quote['total']),
                },
            ),
            actor=None,
            ip=ip,
        )
    except Exception:
        logger.exception(
            'No se pudo crear la notificación del pedido %s', quote['quote_number']
        )

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


@router.post('/auth/register', status_code=status.HTTP_201_CREATED)
def store_register(payload: StoreRegisterInput, request: Request, db: Session = Depends(get_db)):
    """Alta de cuenta de cliente en la tienda (email + contraseña).

    Si el correo ya hizo pedidos como invitado, la contraseña se vincula a
    ese cliente para conservar el historial en «Mis pedidos».
    """
    company_id = _company_id(db)
    ip = client_ip(request)
    email = str(payload.email).lower()
    customer = db.execute(
        select(Customer).where(Customer.company_id == company_id, Customer.email == email)
    ).scalars().first()

    if customer is not None:
        if customer.password_hash:
            raise Conflict('Ya existe una cuenta con este correo.')
        customer.password_hash = hash_password(payload.password)
        if payload.phone and not customer.phone:
            customer.phone = payload.phone
        db.commit()
        db.refresh(customer)
    else:
        created = customer_service.create_customer(
            db,
            company_id,
            CustomerCreate(
                document_number=_next_document(db, company_id),
                name=payload.name,
                email=email,
                phone=payload.phone,
                segment='Tienda Web',
            ),
            actor=None,
            ip=ip,
        )
        customer = db.get(Customer, created['id'])
        customer.password_hash = hash_password(payload.password)
        db.commit()
        db.refresh(customer)

    return _auth_response(customer, company_id)


@router.post('/auth/login')
def store_login(payload: StoreLoginInput, request: Request, db: Session = Depends(get_db)):
    company_id = _company_id(db)
    email = str(payload.email).lower()
    customer = db.execute(
        select(Customer).where(Customer.company_id == company_id, Customer.email == email)
    ).scalars().first()
    if customer is None or not customer.password_hash or not verify_password(
        payload.password, customer.password_hash
    ):
        raise Unauthenticated('Correo o contraseña incorrectos.')
    if not customer.is_active:
        raise Unauthenticated('Cuenta desactivada. Contacta al administrador.')
    return _auth_response(customer, company_id)


@router.get('/auth/me')
def store_me(request: Request, db: Session = Depends(get_db)):
    company_id = _company_id(db)
    return _customer_payload(_current_store_customer(db, company_id, request))


@router.get('/orders')
def store_orders(request: Request, db: Session = Depends(get_db)):
    """Pedidos del cliente autenticado (venta + líneas + pagos + reclamos)."""
    company_id = _company_id(db)
    customer = _current_store_customer(db, company_id, request)
    return sale_service.list_sales(db, company_id, customer_id=customer.id, page=1, page_size=50)


def _owned_sale(db: Session, company_id: int, sale_id: int, customer: Customer) -> Sale:
    sale = db.execute(
        select(Sale).where(
            Sale.id == sale_id,
            Sale.company_id == company_id,
            Sale.customer_id == customer.id,
        )
    ).scalar_one_or_none()
    if sale is None:
        raise NotFound('Pedido no encontrado.')
    return sale


@router.put('/orders/{sale_id}/received')
def store_order_received(
    sale_id: int,
    payload: ReceivedUpdate,
    request: Request,
    db: Session = Depends(get_db),
):
    """El cliente marca (o desmarca) su pedido como recibido."""
    company_id = _company_id(db)
    ip = client_ip(request)
    customer = _current_store_customer(db, company_id, request)
    _owned_sale(db, company_id, sale_id, customer)
    return sale_service.set_sale_received(
        db, company_id, sale_id, payload.received, actor=None, ip=ip
    )


@router.post('/orders/{sale_id}/claims', status_code=status.HTTP_201_CREATED)
def store_order_claim(
    sale_id: int,
    payload: StoreClaimCreate,
    request: Request,
    db: Session = Depends(get_db),
):
    """Reclamo del cliente sobre su pedido (no llegó / tuvo problemas)."""
    company_id = _company_id(db)
    ip = client_ip(request)
    customer = _current_store_customer(db, company_id, request)
    return claim_service.create_claim(
        db, company_id, sale_id, customer, payload.description, ip
    )
