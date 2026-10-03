"""Reportes de negocio: ventas, estadístico, productos, clientes y vendedores (RF-20).

Cada generación guarda columnas, filas y resumen en `reports` para poder
revisarlos, exportarlos (CSV) e imprimirlos después.
"""

from __future__ import annotations

from datetime import datetime, timezone
from typing import Any, Dict, List, Optional

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.analytics.compare import compare as compare_metrics
from app.core.exceptions import NotFound
from app.models.customer import Customer
from app.models.employee import Employee
from app.models.inventory import Inventory
from app.models.product import Product
from app.models.report import Report
from app.models.sale import Sale
from app.schemas.report import ReportCreate
from app.services.statistics_service import _month_cutoff
from app.utils.helpers import as_float, clamp_page, paginate

DEFAULT_TITLE = {
    'ventas': 'Reporte de ventas',
    'estadistico': 'Reporte estadístico',
    'productos': 'Reporte de productos',
    'clientes': 'Reporte de clientes',
    'vendedores': 'Reporte de vendedores',
}

DESCRIPTION = {
    'ventas': 'Detalle de ventas registradas en el periodo.',
    'estadistico': 'Indicadores descriptivos de los tickets de venta (Semana 07).',
    'productos': 'Catálogo con precios, margen y nivel de stock.',
    'clientes': 'Segmentación y comportamiento de compra por cliente.',
    'vendedores': 'Ingresos, tickets y participación por vendedor.',
}


def _money(value: float) -> str:
    return f'S/ {value:,.2f}'


def _number(value: float) -> str:
    return f'{value:,.0f}' if float(value).is_integer() else f'{value:,.2f}'


def _round2(value: float) -> float:
    return round(value + 1e-9, 2)


def _balance(sale: Sale) -> float:
    paid = sum(as_float(payment.amount) for payment in sale.payments)
    return max(as_float(sale.total) - paid, 0.0)


# ---------------------------------------------------------------- builders

def _ventas(db: Session, company_id: int) -> Dict[str, Any]:
    sales = db.execute(
        select(Sale).where(Sale.company_id == company_id).order_by(Sale.sold_at.desc())
    ).scalars().all()
    rows = [
        {
            'venta': sale.sale_number,
            'fecha': sale.sold_at.strftime('%d/%m/%Y'),
            'cliente': sale.customer.name if sale.customer else '—',
            'vendedor': sale.seller.full_name if sale.seller else '—',
            'estado': sale.status,
            'subtotal': as_float(sale.subtotal),
            'descuento': as_float(sale.discount),
            'impuesto': as_float(sale.tax),
            'total': as_float(sale.total),
            'pagado': sum(as_float(payment.amount) for payment in sale.payments),
            'saldo': _balance(sale),
        }
        for sale in sales
    ]
    valid = [sale for sale in sales if sale.status != 'cancelled']
    revenue = sum(as_float(sale.total) for sale in valid)
    return {
        'columns': [
            {'key': 'venta', 'label': 'Venta'},
            {'key': 'fecha', 'label': 'Fecha'},
            {'key': 'cliente', 'label': 'Cliente'},
            {'key': 'vendedor', 'label': 'Vendedor'},
            {'key': 'estado', 'label': 'Estado'},
            {'key': 'total', 'label': 'Total', 'align': 'right'},
            {'key': 'saldo', 'label': 'Saldo', 'align': 'right'},
        ],
        'rows': rows,
        'summary': [
            {'label': 'Ventas registradas', 'value': _number(len(sales))},
            {'label': 'Ventas válidas', 'value': _number(len(valid))},
            {'label': 'Ingresos totales', 'value': _money(revenue)},
            {'label': 'Saldo por cobrar', 'value': _money(sum(_balance(sale) for sale in sales))},
        ],
    }


def _estadistico(db: Session, company_id: int) -> Dict[str, Any]:
    sales = db.execute(
        select(Sale).where(
            Sale.company_id == company_id,
            Sale.sold_at >= _month_cutoff(12),
            Sale.status != 'cancelled',
        )
    ).scalars().all()
    tickets = [as_float(sale.total) for sale in sales]
    revenue = sum(tickets)
    stats = compare_metrics(tickets) if len(tickets) >= 2 else None

    rows = [
        {'indicador': 'Ingresos del periodo', 'valor': _round2(revenue), 'unidad': 'S/'},
        {'indicador': 'Transacciones', 'valor': len(tickets), 'unidad': 'uds'},
        {'indicador': 'Ticket promedio', 'valor': _round2(revenue / len(tickets)) if tickets else 0, 'unidad': 'S/'},
        {'indicador': 'Media de tickets', 'valor': stats['mean'] if stats else 0, 'unidad': 'S/'},
        {'indicador': 'Mediana de tickets', 'valor': stats['median'] if stats else 0, 'unidad': 'S/'},
        {'indicador': 'Diferencia media − mediana', 'valor': stats['difference'] if stats else 0, 'unidad': 'S/'},
        {'indicador': 'Mínimo del ticket', 'valor': _round2(min(tickets)) if tickets else 0, 'unidad': 'S/'},
        {'indicador': 'Máximo del ticket', 'valor': _round2(max(tickets)) if tickets else 0, 'unidad': 'S/'},
    ]
    return {
        'columns': [
            {'key': 'indicador', 'label': 'Indicador'},
            {'key': 'valor', 'label': 'Valor', 'align': 'right'},
            {'key': 'unidad', 'label': 'Unidad'},
        ],
        'rows': rows,
        'summary': [
            {'label': 'Observaciones analizadas', 'value': _number(len(tickets))},
            {'label': 'Interpretación', 'value': stats['interpretation'] if stats else 'Datos insuficientes (RN-40).'},
            {'label': 'Meses incluidos', 'value': '12'},
        ],
    }


def _productos(db: Session, company_id: int) -> Dict[str, Any]:
    products = db.execute(
        select(Product).where(Product.company_id == company_id).order_by(Product.name)
    ).scalars().all()
    stocks = {row.product_id: row for row in db.execute(select(Inventory)).scalars().all()}
    rows = []
    for product in products:
        stock = stocks.get(product.id)
        current = stock.stock if stock else 0
        price = as_float(product.price)
        cost = as_float(product.cost_price)
        rows.append({
            'sku': product.sku,
            'producto': product.name,
            'categoria': product.category.name if product.category else 'Sin categoría',
            'costo': cost,
            'precio': price,
            'margen': _round2(((price - cost) / max(price, 1)) * 100),
            'stock': current,
            'minimo': product.min_stock,
            'estado': 'active' if product.is_active else 'inactive',
        })
    return {
        'columns': [
            {'key': 'sku', 'label': 'SKU'},
            {'key': 'producto', 'label': 'Producto'},
            {'key': 'categoria', 'label': 'Categoría'},
            {'key': 'precio', 'label': 'Precio', 'align': 'right'},
            {'key': 'margen', 'label': 'Margen (%)', 'align': 'right'},
            {'key': 'stock', 'label': 'Stock', 'align': 'right'},
            {'key': 'estado', 'label': 'Estado'},
        ],
        'rows': rows,
        'summary': [
            {'label': 'Productos activos', 'value': _number(sum(1 for row in rows if row['estado'] == 'active'))},
            {'label': 'Productos en alerta', 'value': _number(sum(1 for row in rows if row['stock'] <= row['minimo']))},
            {
                'label': 'Valor de inventario (costo)',
                'value': _money(sum(row['costo'] * row['stock'] for row in rows)),
            },
        ],
    }


def _clientes(db: Session, company_id: int) -> Dict[str, Any]:
    customers = db.execute(
        select(Customer).where(Customer.company_id == company_id).order_by(Customer.name)
    ).scalars().all()
    stats: Dict[int, tuple] = {}
    for customer_id, count, total in db.execute(
        select(Sale.customer_id, func.count(Sale.id), func.coalesce(func.sum(Sale.total), 0))
        .where(Sale.company_id == company_id, Sale.status != 'cancelled', Sale.customer_id.isnot(None))
        .group_by(Sale.customer_id)
    ).all():
        stats[customer_id] = (count, float(total or 0))

    rows = []
    for customer in customers:
        count, total = stats.get(customer.id, (0, 0.0))
        rows.append({
            'cliente': customer.name,
            'documento': f'{customer.document_type} {customer.document_number}',
            'segmento': customer.segment,
            'compras': count,
            'total_comprado': _round2(total),
            'ticket_promedio': _round2(total / count) if count else 0,
            'estado': 'active' if customer.is_active else 'inactive',
        })
    return {
        'columns': [
            {'key': 'cliente', 'label': 'Cliente'},
            {'key': 'documento', 'label': 'Documento'},
            {'key': 'segmento', 'label': 'Segmento'},
            {'key': 'compras', 'label': 'Compras', 'align': 'right'},
            {'key': 'total_comprado', 'label': 'Total comprado', 'align': 'right'},
            {'key': 'ticket_promedio', 'label': 'Ticket prom.', 'align': 'right'},
            {'key': 'estado', 'label': 'Estado'},
        ],
        'rows': rows,
        'summary': [
            {'label': 'Clientes', 'value': _number(len(rows))},
            {'label': 'Clientes activos', 'value': _number(sum(1 for row in rows if row['estado'] == 'active'))},
            {'label': 'Facturación acumulada', 'value': _money(sum(row['total_comprado'] for row in rows))},
        ],
    }


def _vendedores(db: Session, company_id: int) -> Dict[str, Any]:
    employees = db.execute(
        select(Employee).where(Employee.company_id == company_id)
    ).scalars().all()
    aggregates: Dict[int, tuple] = {}
    for employee_id, count, total in db.execute(
        select(Sale.seller_id, func.count(Sale.id), func.coalesce(func.sum(Sale.total), 0))
        .where(Sale.company_id == company_id, Sale.status != 'cancelled')
        .group_by(Sale.seller_id)
    ).all():
        aggregates[employee_id] = (count, float(total or 0))

    rows = []
    for employee in employees:
        count, total = aggregates.get(employee.id, (0, 0.0))
        rows.append({
            'vendedor': employee.full_name,
            'ventas': count,
            'ingresos': _round2(total),
            'ticket_promedio': _round2(total / count) if count else 0,
            'participación': 0.0,
            'estado': 'Al día' if employee.is_active else 'Inactivo',
        })

    grand_total = sum(row['ingresos'] for row in rows) or 1.0
    for row in rows:
        row['participación'] = _round2((row['ingresos'] / grand_total) * 100)

    return {
        'columns': [
            {'key': 'vendedor', 'label': 'Vendedor'},
            {'key': 'ventas', 'label': 'Ventas', 'align': 'right'},
            {'key': 'ingresos', 'label': 'Ingresos', 'align': 'right'},
            {'key': 'ticket_promedio', 'label': 'Ticket prom.', 'align': 'right'},
            {'key': 'participación', 'label': 'Participación (%)', 'align': 'right'},
            {'key': 'estado', 'label': 'Estado'},
        ],
        'rows': rows,
        'summary': [
            {'label': 'Vendedores', 'value': _number(len(rows))},
            {'label': 'Ingresos atribuidos', 'value': _money(sum(row['ingresos'] for row in rows))},
            {'label': 'Vendedores activos', 'value': _number(sum(1 for row in rows if row['estado'] == 'Al día'))},
        ],
    }


BUILDERS = {
    'ventas': _ventas,
    'estadistico': _estadistico,
    'productos': _productos,
    'clientes': _clientes,
    'vendedores': _vendedores,
}


# ---------------------------------------------------------------- servicio

def generate(db: Session, company_id: int, payload: ReportCreate, actor=None) -> dict:
    builder = BUILDERS.get(payload.report_type)
    if builder is None:
        raise NotFound(f'Tipo de reporte no disponible: {payload.report_type}')

    content = builder(db, company_id)
    report = Report(
        company_id=company_id,
        report_type=payload.report_type,
        title=payload.title or DEFAULT_TITLE[payload.report_type],
        parameters={
            'filters': payload.filters or {},
            'description': DESCRIPTION[payload.report_type],
            'columns': content['columns'],
            'rows': content['rows'],
        },
        summary={'items': content['summary']},
        generated_by=actor.id if actor else None,
    )
    db.add(report)
    db.commit()
    db.refresh(report)
    return _serialize(report)


def list_reports(db: Session, company_id: int, *, page: int = 1, page_size: int = 20) -> dict:
    page, page_size = clamp_page(page, page_size)
    rows = db.execute(
        select(Report).where(Report.company_id == company_id).order_by(Report.created_at.desc())
    ).scalars().all()
    items = [
        {
            'id': row.id,
            'report_type': row.report_type,
            'title': row.title,
            'generated_by': row.generated_by,
            'created_at': row.created_at,
        }
        for row in rows
    ]
    return paginate(items, page, page_size)


def _serialize(report: Report) -> dict:
    parameters = report.parameters or {}
    return {
        'id': report.id,
        'report_type': report.report_type,
        'title': report.title,
        'description': parameters.get('description', ''),
        'filters': parameters.get('filters', {}),
        'columns': parameters.get('columns', []),
        'rows': parameters.get('rows', []),
        'summary': (report.summary or {}).get('items', []),
        'generated_by': report.generated_by,
        'created_at': report.created_at,
    }


def get_report(db: Session, company_id: int, report_id: int) -> dict:
    report = db.execute(
        select(Report).where(Report.id == report_id, Report.company_id == company_id)
    ).scalar_one_or_none()
    if report is None:
        raise NotFound('Reporte no encontrado.')
    return _serialize(report)


def export_csv(report: dict) -> tuple[str, str]:
    """Exportación CSV del reporte (docs/05 §2.10 · /reports/{id}/export?format=csv)."""

    def escape(value: Any) -> str:
        text = str(value)
        return f'"{text.replace(chr(34), chr(34) * 2)}"' if (',' in text or '"' in text) else text

    columns = report['columns']
    header = ','.join(escape(column['label']) for column in columns)
    body = [
        ','.join(escape(row.get(column['key'], '')) for column in columns)
        for row in report['rows']
    ]
    content = '\n'.join([header, *body])
    filename = f'{report["report_type"]}-{datetime.now(timezone.utc).strftime("%Y-%m-%d")}.csv'
    return content, filename
