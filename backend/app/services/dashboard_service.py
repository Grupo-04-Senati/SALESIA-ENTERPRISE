"""Dashboard ejecutivo: resumen, serie temporal, rankings y alertas (RF-09)."""

from __future__ import annotations

from datetime import datetime, timedelta, timezone
from typing import Dict, List, Optional

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.models.customer import Customer
from app.models.inventory import Inventory
from app.models.product import Product
from app.models.sale import Sale
from app.models.sale_detail import SaleDetail
from app.utils.helpers import as_float


def _parse(value: Optional[str], end: bool = False) -> datetime:
    if not value:
        return datetime(1970, 1, 1, tzinfo=timezone.utc)
    day = datetime.strptime(value[:10], '%Y-%m-%d').replace(tzinfo=timezone.utc)
    return day.replace(hour=23, minute=59, second=59) if end else day


def _window(date_from: Optional[str], date_to: Optional[str]) -> tuple[datetime, datetime]:
    start = _parse(date_from)
    end = _parse(date_to, end=True) if date_to else datetime.now(timezone.utc)
    return start, end


def _base(
    db: Session,
    company_id: int,
    start: datetime,
    end: datetime,
    *,
    seller_id: Optional[int] = None,
    category_id: Optional[int] = None,
):
    statement = select(Sale).where(
        Sale.company_id == company_id, Sale.sold_at >= start, Sale.sold_at <= end
    )
    if seller_id:
        statement = statement.where(Sale.seller_id == seller_id)
    sales = db.execute(statement).scalars().all()

    if category_id:
        product_ids = {
            row.id
            for row in db.execute(
                select(Product).where(Product.company_id == company_id, Product.category_id == category_id)
            ).scalars().all()
        }
        filtered = []
        for sale in sales:
            detail = db.execute(
                select(SaleDetail.product_id).where(SaleDetail.sale_id == sale.id)
            ).scalars().all()
            if product_ids.intersection(detail):
                filtered.append(sale)
        sales = filtered
    return sales


def summary(
    db: Session,
    company_id: int,
    *,
    date_from: Optional[str] = None,
    date_to: Optional[str] = None,
    seller_id: Optional[int] = None,
    category_id: Optional[int] = None,
) -> dict:
    start, end = _window(date_from, date_to)
    sales = _base(db, company_id, start, end, seller_id=seller_id, category_id=category_id)

    valid = [sale for sale in sales if sale.status != 'cancelled']
    revenue = sum(as_float(sale.total) for sale in valid)
    transactions = len(valid)
    tickets = sorted(as_float(sale.total) for sale in valid)

    new_customers = db.execute(
        select(func.count(Customer.id)).where(
            Customer.company_id == company_id, Customer.created_at >= start, Customer.created_at <= end
        )
    ).scalar_one()

    low_stock = 0
    for product in db.execute(select(Product).where(Product.company_id == company_id)).scalars().all():
        stock = db.execute(select(Inventory).where(Inventory.product_id == product.id)).scalar_one_or_none()
        current = stock.stock if stock else 0
        if current <= product.min_stock:
            low_stock += 1

    previous_end = start - timedelta(microseconds=1)
    previous_start = previous_end - (end - start)
    previous = _base(db, company_id, previous_start, previous_end, seller_id=seller_id, category_id=category_id)
    previous_valid = [sale for sale in previous if sale.status != 'cancelled']
    previous_revenue = sum(as_float(sale.total) for sale in previous_valid)

    def pct(current: float, before: float) -> float:
        return round(((current - before) / before) * 100, 2) if before else 0.0

    return {
        'period': {'from': start.strftime('%Y-%m-%d'), 'to': end.strftime('%Y-%m-%d')},
        'sales': transactions,
        'revenue': round(revenue, 2),
        'transactions': transactions,
        'new_customers': new_customers,
        'average_ticket': round(revenue / transactions, 2) if transactions else 0.0,
        'mean_sale': round(revenue / transactions, 2) if transactions else 0.0,
        'median_sale': round(_median(tickets), 2) if tickets else 0.0,
        'low_stock_products': low_stock,
        'cancellations': sum(1 for sale in sales if sale.status == 'cancelled'),
        'vs_previous_period': {
            'revenue_pct': pct(revenue, previous_revenue),
            'sales_pct': pct(transactions, len(previous_valid)),
        },
    }


def _median(values: List[float]) -> float:
    middle = len(values) // 2
    if len(values) % 2:
        return values[middle]
    return (values[middle - 1] + values[middle]) / 2


def timeseries(
    db: Session,
    company_id: int,
    *,
    period: str = 'month',
    date_from: Optional[str] = None,
    date_to: Optional[str] = None,
) -> List[dict]:
    start, end = _window(date_from, date_to)
    sales = [
        sale
        for sale in _base(db, company_id, start, end)
        if sale.status != 'cancelled'
    ]

    buckets: Dict[str, dict] = {}
    for sale in sales:
        if period == 'day':
            key = sale.sold_at.strftime('%Y-%m-%d')
        else:
            key = sale.sold_at.strftime('%Y-%m')
        row = buckets.setdefault(key, {'label': key, 'revenue': 0.0, 'transactions': 0})
        row['revenue'] += as_float(sale.total)
        row['transactions'] += 1

    return [
        {'label': key, 'revenue': round(row['revenue'], 2), 'transactions': row['transactions']}
        for key, row in sorted(buckets.items())
    ]


def top(
    db: Session,
    company_id: int,
    *,
    entity: str = 'products',
    limit: int = 5,
    date_from: Optional[str] = None,
    date_to: Optional[str] = None,
) -> List[dict]:
    start, end = _window(date_from, date_to)
    sales = [sale for sale in _base(db, company_id, start, end) if sale.status != 'cancelled']
    sale_ids = [sale.id for sale in sales]
    if not sale_ids:
        return []

    rows = db.execute(
        select(SaleDetail).where(SaleDetail.sale_id.in_(sale_ids))
    ).scalars().all()

    totals: Dict[int, dict] = {}
    for detail in rows:
        if entity == 'sellers':
            sale = next((item for item in sales if item.id == detail.sale_id), None)
            key = sale.seller_id if sale else None
            if key is None:
                continue
            name = sale.seller.full_name if sale and sale.seller else ''
        else:
            key = detail.product_id
            name = detail.product.name if detail.product else ''

        row = totals.setdefault(key, {'name': name, 'revenue': 0.0, 'units': 0, 'transactions': 0})
        row['revenue'] += as_float(detail.subtotal)
        row['units'] += detail.quantity
        row['transactions'] += 1

    ranked = sorted(totals.values(), key=lambda row: row['revenue'], reverse=True)[:limit]
    for row in ranked:
        row['revenue'] = round(row['revenue'], 2)
    return ranked


def stock_alerts(db: Session, company_id: int) -> List[dict]:
    products = db.execute(select(Product).where(Product.company_id == company_id)).scalars().all()
    stocks = {row.product_id: row for row in db.execute(select(Inventory)).scalars().all()}

    items = []
    for product in products:
        stock = stocks.get(product.id)
        current = stock.stock if stock else 0
        if current <= product.min_stock:
            items.append(
                {
                    'product_id': product.id,
                    'sku': product.sku,
                    'name': product.name,
                    'current_stock': current,
                    'min_stock': product.min_stock,
                    'unit': product.unit,
                }
            )
    return sorted(items, key=lambda row: row['current_stock'])
