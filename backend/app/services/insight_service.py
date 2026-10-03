"""Motor de insights determinísticos (RF-18…RF-20 · RN-47, RN-48).

Reglas fijas: la misma operación produce siempre el mismo insight, con su
evidencia numérica. Se persisten con upsert por regla para que la lista sea
estable (ids fijos, no se duplican) y el estado de lectura se conserve.
"""

from __future__ import annotations

from datetime import datetime, timezone
from typing import Any, Dict, List, Optional

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.analytics.compare import compare as compare_metrics
from app.core.exceptions import NotFound
from app.models.category import Category
from app.models.insight import Insight
from app.models.inventory import Inventory
from app.models.product import Product
from app.models.sale import Sale
from app.models.sale_detail import SaleDetail
from app.services.statistics_service import _month_cutoff
from app.utils.helpers import clamp_page, paginate

MONTH_NAMES = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic']

RULES: List[Dict[str, Any]] = [
    {'code': 'REG-01_TENDENCIA_INGRESOS', 'description': 'Compara los ingresos del último mes con el anterior.', 'severity': 'INFO', 'automation_code': 'REG-01_TENDENCIA'},
    {'code': 'REG-02_TICKET_PROMEDIO', 'description': 'Calcula el ticket promedio del periodo filtrado.', 'severity': 'INFO', 'automation_code': ''},
    {'code': 'REG-03_CONCENTRACION_VENDEDOR', 'description': 'Detecta concentración de ingresos por vendedor.', 'severity': 'WARNING', 'automation_code': 'REG-03_CONCENTRACION'},
    {'code': 'REG-04_CONCENTRACION_CATEGORIA', 'description': 'Identifica la categoría con mayor participación.', 'severity': 'INFO', 'automation_code': ''},
    {'code': 'REG-05_ASIMETRIA_DISTRIBUCION', 'description': 'Compara media y mediana para detectar colas asimétricas.', 'severity': 'WARNING', 'automation_code': ''},
    {'code': 'REG-06_COBRANZA_PENDIENTE', 'description': 'Suma el saldo de ventas pendientes o parciales.', 'severity': 'WARNING', 'automation_code': ''},
    {'code': 'REG-07_STOCK_BAJO', 'description': 'Detecta productos en o por debajo del umbral de stock.', 'severity': 'CRITICAL', 'automation_code': 'REG-07_STOCK_INSIGHT'},
    {'code': 'REG-08_PRODUCTO_ESTRELLA', 'description': 'Rankea el producto con mayor facturación.', 'severity': 'SUCCESS', 'automation_code': ''},
]


def _round2(value: float) -> float:
    return round(value + 1e-9, 2)


def _label(month_offset: int = 0) -> str:
    today = datetime.now(timezone.utc)
    month = today.month - 1 - month_offset
    year = today.year + month // 12
    month = month % 12 + 1
    return f'{MONTH_NAMES[month - 1]} {str(year)[2:]}'


def _monthly(db: Session, company_id: int) -> List[Dict[str, Any]]:
    """Ingresos y transacciones de los últimos 12 meses (excluye anuladas)."""
    since = _month_cutoff(12)
    sales = db.execute(
        select(Sale).where(
            Sale.company_id == company_id, Sale.sold_at >= since, Sale.status != 'cancelled'
        )
    ).scalars().all()

    buckets: Dict[str, Dict[str, Any]] = {}
    for offset in range(11, -1, -1):
        today = datetime.now(timezone.utc)
        month = today.month - 1 - offset
        year = today.year + month // 12
        month = month % 12 + 1
        buckets[f'{year}-{month:02d}'] = {'label': _label(offset), 'revenue': 0.0, 'transactions': 0}

    for sale in sales:
        key = sale.sold_at.strftime('%Y-%m')
        if key in buckets:
            buckets[key]['revenue'] += float(sale.total)
            buckets[key]['transactions'] += 1
    return list(buckets.values())


def evaluate(db: Session, company_id: int, filters: Optional[dict] = None) -> List[dict]:
    """Evalúa todas las reglas sobre la operación actual (RN-47: con evidencia)."""
    filters = filters or {}
    months = int(filters.get('months') or 12)
    since = _month_cutoff(months)

    sales = db.execute(
        select(Sale).where(Sale.company_id == company_id, Sale.sold_at >= since)
    ).scalars().all()
    valid_sales = [sale for sale in sales if sale.status != 'cancelled']
    revenue = sum(float(sale.total) for sale in valid_sales)
    transactions = len(valid_sales)
    ticket = revenue / transactions if transactions else 0.0

    monthly = _monthly(db, company_id)
    last, previous = (monthly[-1] if monthly else None), (monthly[-2] if len(monthly) > 1 else None)
    by_category = _by_category(db, company_id, valid_sales)
    by_product = _by_product(db, company_id, valid_sales)
    by_seller = _by_seller(db, company_id, valid_sales)
    pending = [sale for sale in sales if sale.status in ('pending', 'partial')]
    pending_amount = sum(_balance(sale) for sale in pending)
    stock_alerts, out_of_stock = _stock_alerts(db, company_id)

    insights: List[Dict[str, Any]] = []

    # REG-01 · tendencia de ingresos
    if last and previous and previous['revenue'] > 0:
        change = _round2(((last['revenue'] - previous['revenue']) / previous['revenue']) * 100)
        insights.append(_build(
            'REG-01_TENDENCIA_INGRESOS',
            'Crecimiento de ingresos en el último mes' if change >= 0 else 'Caída de ingresos en el último mes',
            'SUCCESS' if change >= 10 else 'INFO' if change >= 0 else 'WARNING' if change >= -10 else 'CRITICAL',
            f'Los ingresos de {last["label"]} fueron {"mayores" if change >= 0 else "menores"} en '
            f'{abs(change)}% frente a {previous["label"]} (S/ {_round2(last["revenue"])} vs. '
            f'S/ {_round2(previous["revenue"])}). Umbral de alerta: ±10%.',
            {'mes_actual': last['label'], 'ingresos_actual': _round2(last['revenue']),
             'mes_anterior': previous['label'], 'ingresos_anterior': _round2(previous['revenue']),
             'variacion_pct': change, 'umbral_pct': 10},
        ))

    # REG-02 · ticket promedio
    insights.append(_build(
        'REG-02_TICKET_PROMEDIO', 'Ticket promedio del periodo', 'INFO',
        f'El ticket promedio es S/ {_round2(ticket)} sobre {transactions} transacciones, '
        f'con ingresos de S/ {_round2(revenue)}.',
        {'ticket_promedio': _round2(ticket), 'transacciones': transactions, 'ingresos': _round2(revenue)},
    ))

    # REG-03 · concentración por vendedor
    if by_seller:
        total_seller = sum(row['revenue'] for row in by_seller)
        top = by_seller[0]
        if total_seller > 0:
            share = _round2((top['revenue'] / total_seller) * 100)
            insights.append(_build(
                'REG-03_CONCENTRACION_VENDEDOR', f'Concentración de ventas en {top["name"]}',
                'WARNING' if share >= 40 else 'INFO',
                f'{top["name"]} concentra el {share}% de los ingresos del periodo'
                f'{", por encima del umbral configurado del 40%" if share >= 40 else ", por debajo del umbral configurado del 40%"}.',
                {'vendedor': top['name'], 'ingresos': _round2(top['revenue']), 'participacion_pct': share, 'umbral_pct': 40},
            ))

    # REG-04 · concentración por categoría
    if by_category:
        total_category = sum(row['revenue'] for row in by_category)
        top = by_category[0]
        if total_category > 0:
            share = _round2((top['revenue'] / total_category) * 100)
            insights.append(_build(
                'REG-04_CONCENTRACION_CATEGORIA', f'Categoría líder: {top["name"]}', 'INFO',
                f'{top["name"]} aporta el {share}% de los ingresos del periodo.',
                {'categoria': top['name'], 'ingresos': _round2(top['revenue']), 'participacion_pct': share},
            ))

    # REG-05 · asimetría media vs. mediana
    if transactions >= 2:
        stats = compare_metrics([float(sale.total) for sale in valid_sales])
        insights.append(_build(
            'REG-05_ASIMETRIA_DISTRIBUCION',
            'Distribución simétrica de tickets' if abs(stats['difference_pct']) < 5
            else 'Cola derecha: pocas ventas elevan el promedio' if stats['difference'] > 0
            else 'Cola izquierda: muchas ventas pequeñas bajan el promedio',
            'INFO' if abs(stats['difference_pct']) < 5 else 'WARNING',
            f'{stats["interpretation"]} Media S/ {stats["mean"]} vs. mediana S/ {stats["median"]} '
            f'({stats["difference_pct"]}%).',
            {'media': stats['mean'], 'mediana': stats['median'], 'diferencia': stats['difference'],
             'diferencia_pct': stats['difference_pct']},
        ))

    # REG-06 · cobranza pendiente
    insights.append(_build(
        'REG-06_COBRANZA_PENDIENTE',
        'Sin ventas pendientes de cobro' if not pending else f'{len(pending)} venta(s) con saldo pendiente',
        'SUCCESS' if not pending else 'WARNING' if pending_amount > 200 else 'INFO',
        'Todas las ventas registradas están pagadas.' if not pending
        else f'El saldo por cobrar suma S/ {_round2(pending_amount)} en {len(pending)} venta(s).',
        {'ventas_pendientes': len(pending), 'saldo_por_cobrar': _round2(pending_amount)},
    ))

    # REG-07 · stock bajo
    insights.append(_build(
        'REG-07_STOCK_BAJO',
        'Productos sin stock' if out_of_stock else 'Alertas de stock bajo' if stock_alerts else 'Stock en niveles adecuados',
        'CRITICAL' if out_of_stock else 'WARNING' if stock_alerts else 'SUCCESS',
        'Todos los productos están por encima del umbral de alerta configurado.' if not stock_alerts
        else f'{len(stock_alerts)} producto(s) en alerta de stock, de los cuales {len(out_of_stock)} están agotados.',
        {'productos_en_alerta': len(stock_alerts), 'productos_sin_stock': len(out_of_stock),
         'skus': ', '.join(row['sku'] for row in stock_alerts[:5])},
    ))

    # REG-08 · producto estrella
    if by_product:
        top = by_product[0]
        insights.append(_build(
            'REG-08_PRODUCTO_ESTRELLA', f'Producto estrella: {top["name"]}', 'SUCCESS',
            f'{top["name"]} lidera la facturación con S/ {_round2(top["revenue"])} ({top["units"]} unidades).',
            {'producto': top['name'], 'ingresos': _round2(top['revenue']), 'unidades': top['units']},
        ))

    return insights


def _build(rule: str, title: str, severity: str, message: str, evidence: dict) -> dict:
    return {'rule': rule, 'title': title, 'severity': severity, 'message': message, 'evidence': evidence}


def _balance(sale) -> float:
    paid = sum(float(payment.amount) for payment in sale.payments)
    return max(float(sale.total) - paid, 0.0)


def _by_seller(db: Session, company_id: int, sales: List[Sale]) -> List[dict]:
    totals: Dict[int, dict] = {}
    for sale in sales:
        if not sale.seller_id:
            continue
        row = totals.setdefault(sale.seller_id, {'name': sale.seller.full_name if sale.seller else '', 'revenue': 0.0, 'count': 0})
        row['revenue'] += float(sale.total)
        row['count'] += 1
    return sorted(totals.values(), key=lambda row: row['revenue'], reverse=True)


def _by_category(db: Session, company_id: int, sales: List[Sale]) -> List[dict]:
    sale_ids = [sale.id for sale in sales]
    if not sale_ids:
        return []
    rows = db.execute(
        select(Category.name, func.sum(SaleDetail.subtotal))
        .join(Product, Product.category_id == Category.id)
        .join(SaleDetail, SaleDetail.product_id == Product.id)
        .where(SaleDetail.sale_id.in_(sale_ids))
        .group_by(Category.name)
    ).all()
    return sorted(
        [{'name': name or 'Sin categoría', 'revenue': float(total)} for name, total in rows],
        key=lambda row: row['revenue'],
        reverse=True,
    )


def _by_product(db: Session, company_id: int, sales: List[Sale]) -> List[dict]:
    totals: Dict[int, dict] = {}
    sale_ids = [sale.id for sale in sales]
    if not sale_ids:
        return []
    rows = db.execute(
        select(SaleDetail, Product)
        .join(Product, Product.id == SaleDetail.product_id)
        .where(SaleDetail.sale_id.in_(sale_ids))
    ).all()
    for detail, product in rows:
        row = totals.setdefault(product.id, {'name': product.name, 'revenue': 0.0, 'units': 0})
        row['revenue'] += float(detail.subtotal)
        row['units'] += detail.quantity
    return sorted(totals.values(), key=lambda row: row['revenue'], reverse=True)


def _stock_alerts(db: Session, company_id: int) -> tuple[List[dict], List[dict]]:
    products = db.execute(select(Product).where(Product.company_id == company_id)).scalars().all()
    stocks = {row.product_id: row for row in db.execute(select(Inventory)).scalars().all()}
    alerts, out = [], []
    for product in products:
        stock = stocks.get(product.id)
        current = stock.stock if stock else 0
        if current <= product.min_stock:
            alerts.append({'product_id': product.id, 'sku': product.sku, 'current_stock': current, 'min_stock': product.min_stock})
            if current == 0:
                out.append(product)
    return alerts, out


# ---------------------------------------------------------------- persistencia

def _upsert(db: Session, company_id: int, insight: dict) -> Insight:
    row = db.execute(
        select(Insight).where(Insight.company_id == company_id, Insight.rule_code == insight['rule'])
    ).scalar_one_or_none()
    if row is None:
        row = Insight(company_id=company_id, rule_code=insight['rule'])
        db.add(row)
    row.severity = insight['severity'].lower()
    row.title = insight['title']
    row.message = insight['message']
    row.evidence = insight['evidence']
    return row


def generate(db: Session, company_id: int, filters: Optional[dict] = None) -> List[Insight]:
    """Evalúa las reglas y las persiste (upsert por código de regla)."""
    for insight in evaluate(db, company_id, filters):
        _upsert(db, company_id, insight)
    db.commit()
    return list_insights(db, company_id)['items']


def list_insights(
    db: Session,
    company_id: int,
    *,
    severity: str = '',
    search: str = '',
    page: int = 1,
    page_size: int = 20,
    refresh: bool = True,
) -> dict:
    if refresh:
        for insight in evaluate(db, company_id):
            _upsert(db, company_id, insight)
        db.commit()

    page, page_size = clamp_page(page, page_size)
    statement = select(Insight).where(Insight.company_id == company_id)
    if severity:
        statement = statement.where(Insight.severity == severity.lower())
    rows = db.execute(statement.order_by(Insight.created_at.desc())).scalars().all()

    items = [_serialize(row) for row in rows]
    if search:
        term = search.strip().lower()
        items = [
            item for item in items
            if term in item['title'].lower() or term in item['message'].lower() or term in item['rule'].lower()
        ]
    return paginate(items, page, page_size)


def _serialize(row: Insight) -> dict:
    return {
        'id': row.id,
        'title': row.title,
        'severity': row.severity.upper(),
        'rule': row.rule_code,
        'message': row.message,
        'evidence': row.evidence or {},
        'analysis_id': row.analysis_id,
        'dataset_id': row.dataset_id,
        'created_at': row.created_at,
        'read': row.is_read,
    }


def get_insight(db: Session, company_id: int, insight_id: int) -> dict:
    row = db.execute(
        select(Insight).where(Insight.id == insight_id, Insight.company_id == company_id)
    ).scalar_one_or_none()
    if row is None:
        raise NotFound('Insight no encontrado.')
    return _serialize(row)


def list_rules() -> dict:
    items = [
        {
            'code': rule['code'],
            'description': rule['description'],
            'severity': rule['severity'],
            'enabled': True,
            'automationCode': rule['automation_code'],
        }
        for rule in RULES
    ]
    return paginate(items, 1, max(len(items), 1))
