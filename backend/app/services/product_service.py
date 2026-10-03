"""Productos y categorías (RF-04 · RN-03, RN-04, RN-05, RN-06)."""

from __future__ import annotations

from decimal import Decimal
from typing import Optional

from sqlalchemy import or_, select
from sqlalchemy.orm import Session

from app.core.exceptions import Conflict, NotFound, ValidationAppError
from app.models.category import Category
from app.models.inventory import Inventory
from app.models.product import Product
from app.schemas.product import CategoryCreate, CategoryUpdate, ProductCreate, ProductUpdate
from app.services.audit_service import write_audit
from app.utils.helpers import clamp_page, paginate
from app.utils.validators import valid_email


def _stock_map(db: Session) -> dict[int, Inventory]:
    rows = db.execute(select(Inventory)).scalars().all()
    return {row.product_id: row for row in rows}


def _serialize(product: Product, stock: Optional[Inventory]) -> dict:
    return {
        'id': product.id,
        'sku': product.sku,
        'name': product.name,
        'category': (
            {'id': product.category.id, 'name': product.category.name} if product.category else None
        ),
        'category_id': product.category_id,
        'cost_price': float(product.cost_price),
        'sale_price': float(product.price),
        'min_stock': product.min_stock,
        'current_stock': stock.stock if stock else 0,
        'unit': product.unit,
        'description': product.description,
        'status': 'active' if product.is_active else 'inactive',
        'created_at': product.created_at,
    }


def list_products(
    db: Session,
    company_id: int,
    *,
    q: str = '',
    status: str = '',
    category_id: Optional[int] = None,
    low_stock: bool = False,
    page: int = 1,
    page_size: int = 20,
) -> dict:
    page, page_size = clamp_page(page, page_size)
    statement = select(Product).where(Product.company_id == company_id)

    if status == 'active':
        statement = statement.where(Product.is_active.is_(True))
    elif status == 'inactive':
        statement = statement.where(Product.is_active.is_(False))
    if category_id:
        statement = statement.where(Product.category_id == category_id)
    if q:
        term = f'%{q.strip()}%'
        statement = statement.where(
            or_(Product.name.ilike(term), Product.sku.ilike(term))
        )

    products = db.execute(statement.order_by(Product.name)).scalars().all()
    stock = _stock_map(db)

    payload = []
    for product in products:
        row = stock.get(product.id)
        if low_stock and (row is None or row.stock > product.min_stock):
            continue
        payload.append(_serialize(product, row))

    return paginate(payload, page, page_size)


def get_product(db: Session, company_id: int, product_id: int) -> dict:
    product = db.execute(
        select(Product).where(Product.id == product_id, Product.company_id == company_id)
    ).scalar_one_or_none()
    if product is None:
        raise NotFound('Producto no encontrado.')
    return _serialize(product, _stock_map(db).get(product.id))


def _validate(payload: ProductCreate | ProductUpdate) -> None:
    if payload.sale_price < payload.cost_price:
        raise ValidationAppError('El precio de venta no puede ser menor al costo (RN-05).')


def create_product(
    db: Session, company_id: int, payload: ProductCreate, actor=None, ip: Optional[str] = None
) -> dict:
    _validate(payload)
    duplicated = db.execute(
        select(Product).where(Product.company_id == company_id, Product.sku == payload.sku)
    ).scalar_one_or_none()
    if duplicated:
        raise Conflict('Ya existe un producto con ese SKU (RN-03).')

    data = payload.model_dump()
    product = Product(
        company_id=company_id,
        sku=data.pop('sku'),
        name=data.pop('name'),
        category_id=data.pop('category_id'),
        cost_price=Decimal(str(data.pop('cost_price'))),
        price=Decimal(str(data.pop('sale_price'))),
        min_stock=data.pop('min_stock'),
        unit=data.pop('unit'),
        description=data.pop('description', None),
    )
    db.add(product)
    db.flush()
    db.add(Inventory(product_id=product.id, stock=0, min_stock=product.min_stock))

    write_audit(
        db,
        user=actor,
        action='product.create',
        entity='products',
        entity_id=product.id,
        detail={'sku': product.sku},
        ip_address=ip,
    )
    db.commit()
    return _serialize(product, _stock_map(db).get(product.id))


def update_product(
    db: Session,
    company_id: int,
    product_id: int,
    payload: ProductUpdate,
    actor=None,
    ip: Optional[str] = None,
) -> dict:
    product = db.execute(
        select(Product).where(Product.id == product_id, Product.company_id == company_id)
    ).scalar_one_or_none()
    if product is None:
        raise NotFound('Producto no encontrado.')

    _validate(payload)
    duplicated = db.execute(
        select(Product).where(
            Product.company_id == company_id, Product.sku == payload.sku, Product.id != product_id
        )
    ).scalar_one_or_none()
    if duplicated:
        raise Conflict('Ya existe un producto con ese SKU (RN-03).')

    product.sku = payload.sku
    product.name = payload.name
    product.category_id = payload.category_id
    product.cost_price = Decimal(str(payload.cost_price))
    product.price = Decimal(str(payload.sale_price))
    product.min_stock = payload.min_stock
    product.unit = payload.unit
    product.description = payload.description

    stock = _stock_map(db).get(product.id)
    if stock is not None:
        stock.min_stock = payload.min_stock

    write_audit(
        db, user=actor, action='product.update', entity='products', entity_id=product.id, ip_address=ip
    )
    db.commit()
    return _serialize(product, _stock_map(db).get(product.id))


def set_product_status(
    db: Session,
    company_id: int,
    product_id: int,
    status: str,
    actor=None,
    ip: Optional[str] = None,
) -> dict:
    product = db.execute(
        select(Product).where(Product.id == product_id, Product.company_id == company_id)
    ).scalar_one_or_none()
    if product is None:
        raise NotFound('Producto no encontrado.')

    product.is_active = status == 'active'
    write_audit(
        db,
        user=actor,
        action='product.status',
        entity='products',
        entity_id=product.id,
        detail={'status': status},
        ip_address=ip,
    )
    db.commit()
    return _serialize(product, _stock_map(db).get(product.id))


# ---------------------------------------------------------------- categorías

def list_categories(db: Session, company_id: int) -> dict:
    rows = db.execute(
        select(Category).where(Category.company_id == company_id).order_by(Category.name)
    ).scalars().all()
    items = [
        {'id': row.id, 'name': row.name, 'description': row.description,
         'status': 'active' if row.is_active else 'inactive'}
        for row in rows
    ]
    return paginate(items, 1, max(len(items), 1))


def create_category(db: Session, company_id: int, payload: CategoryCreate) -> dict:
    duplicated = db.execute(
        select(Category).where(Category.company_id == company_id, Category.name == payload.name)
    ).scalar_one_or_none()
    if duplicated:
        raise Conflict('Ya existe una categoría con ese nombre.')

    row = Category(company_id=company_id, **payload.model_dump())
    db.add(row)
    db.commit()
    return {'id': row.id, 'name': row.name, 'description': row.description, 'status': 'active'}


def update_category(db: Session, company_id: int, category_id: int, payload: CategoryUpdate) -> dict:
    row = db.execute(
        select(Category).where(Category.id == category_id, Category.company_id == company_id)
    ).scalar_one_or_none()
    if row is None:
        raise NotFound('Categoría no encontrada.')
    row.name = payload.name
    row.description = payload.description
    db.commit()
    return {'id': row.id, 'name': row.name, 'description': row.description, 'status': 'active'}
