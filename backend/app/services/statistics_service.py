"""Motor estadístico: métricas, comparación, variables y datasets (RF-10…RF-14, RF-21).

Fuente de verdad: las operaciones reales de la empresa. Los valores directos
también se admiten para pruebas académicas. RN-40: mínimo 2 observaciones.
"""

from __future__ import annotations

from datetime import date, datetime, timedelta, timezone
from typing import Any, Dict, List, Optional, Tuple

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.analytics.compare import compare as compare_metrics
from app.analytics.mean import describe, mean
from app.analytics.median import median
from app.analytics.variables import classify_variable
from app.core.exceptions import NotFound, ValidationAppError
from app.models.customer import Customer
from app.models.dataset import Dataset
from app.models.dataset_variable import DatasetVariable
from app.models.employee import Employee
from app.models.observation import Observation
from app.models.product import Product
from app.models.sale import Sale
from app.models.sale_detail import SaleDetail
from app.models.statistical_analysis import StatisticalAnalysis
from app.models.statistical_result import StatisticalResult
from app.schemas.statistics import DatasetCreate, StatInput
from app.utils.helpers import as_float, clamp_page, paginate, round4

# Aliases que el contrato y el frontend usan para la misma columna.
FIELD_ALIASES = {
    'total': 'total',
    'sale_total': 'total',
    'subtotal': 'subtotal',
    'tax': 'tax',
    'impuesto': 'tax',
    'quantity': 'quantity',
    'unit_price': 'unit_price',
    'line_subtotal': 'line_subtotal',
    'discount': 'discount',
    'segment': 'customer_segment',
    'customer_segment': 'customer_segment',
    'seller': 'seller_name',
    'seller_name': 'seller_name',
    'category': 'category',
    'status': 'status',
}

ANALYSIS_KIND = {
    'mean': 'media',
    'median': 'mediana',
    'compare': 'comparacion',
    'bayes': 'bayes',
    'probability': 'bayes',
    'variables': 'variable',
    'random': 'variable',
}


# ---------------------------------------------------------------- rows / datasets

def _month_cutoff(months: int) -> datetime:
    today = datetime.now(timezone.utc).replace(day=1, hour=0, minute=0, second=0, microsecond=0)
    if months > 1:
        month_index = today.month - 1 - (months - 1)
        year = today.year + month_index // 12
        month = month_index % 12 + 1
        return today.replace(year=year, month=month)
    return today


def _sales_rows(db: Session, company_id: int, filters: Optional[dict] = None) -> List[dict]:
    """Filas denormalizadas: una por línea de venta (para analítica)."""
    filters = filters or {}
    statement = (
        select(Sale, SaleDetail, Product)
        .join(SaleDetail, SaleDetail.sale_id == Sale.id)
        .outerjoin(Product, Product.id == SaleDetail.product_id)
        .where(Sale.company_id == company_id)
    )
    if filters.get('date_from'):
        statement = statement.where(Sale.sold_at >= _parse_date(filters['date_from']))
    if filters.get('date_to'):
        statement = statement.where(Sale.sold_at <= _parse_date(filters['date_to'], end=True))
    if filters.get('months'):
        statement = statement.where(Sale.sold_at >= _month_cutoff(int(filters['months'])))
    if filters.get('status'):
        statement = statement.where(Sale.status == filters['status'])

    rows: List[dict] = []
    for sale, item, product in db.execute(statement.order_by(Sale.sold_at)).all():
        rows.append(
            {
                'sale_number': sale.sale_number,
                'issued_at': sale.sold_at.isoformat(),
                'status': sale.status,
                'total': as_float(sale.total),
                'subtotal': as_float(sale.subtotal),
                'discount': as_float(sale.discount),
                'tax': as_float(sale.tax),
                'customer_id': sale.customer_id,
                'seller_id': sale.seller_id,
                'quantity': item.quantity,
                'unit_price': as_float(item.unit_price),
                'line_subtotal': as_float(item.subtotal),
                'product_id': item.product_id,
                'category': product.category.name if product and product.category else 'Sin categoría',
                'product_sku': product.sku if product else '',
                'product_name': product.name if product else '',
            }
        )

    if filters.get('seller'):
        rows = [row for row in rows if str(row['seller_id']) == str(filters['seller']) or _seller_name(db, row['seller_id']) == filters['seller']]
    if filters.get('category'):
        rows = [row for row in rows if row['category'] == filters['category']]
    return rows


def _seller_name(db: Session, seller_id: Optional[int]) -> str:
    if not seller_id:
        return ''
    employee = db.get(Employee, seller_id)
    return employee.full_name if employee else ''


def _customer_rows(db: Session, company_id: int) -> List[dict]:
    customers = db.execute(
        select(Customer).where(Customer.company_id == company_id)
    ).scalars().all()
    return [
        {
            'document_number': customer.document_number,
            'name': customer.name,
            'segment': customer.segment,
            'status': 'active' if customer.is_active else 'inactive',
            'email': customer.email or '',
        }
        for customer in customers
    ]


def _product_rows(db: Session, company_id: int) -> List[dict]:
    products = db.execute(
        select(Product).where(Product.company_id == company_id)
    ).scalars().all()
    return [
        {
            'sku': product.sku,
            'name': product.name,
            'category': product.category.name if product.category else 'Sin categoría',
            'cost_price': as_float(product.cost_price),
            'sale_price': as_float(product.price),
            'min_stock': product.min_stock,
            'status': 'active' if product.is_active else 'inactive',
        }
        for product in products
    ]


def _parse_date(value: str, end: bool = False) -> datetime:
    day = datetime.strptime(value[:10], '%Y-%m-%d').replace(tzinfo=timezone.utc)
    return day.replace(hour=23, minute=59, second=59) if end else day


def build_rows(source: str, db: Session, company_id: int, filters: dict) -> List[dict]:
    if source == 'customers':
        return _customer_rows(db, company_id)
    if source == 'products':
        return _product_rows(db, company_id)
    if source == 'custom':
        return []
    return _sales_rows(db, company_id, filters)


# ---------------------------------------------------------------- resolución de datos

def resolve_values(
    db: Session, company_id: int, payload: StatInput
) -> Tuple[List[float], str, Optional[Dataset], Optional[dict]]:
    """Devuelve (valores, campo, dataset, periodo) desde valores, dataset u operación."""
    if payload.values:
        values = [float(value) for value in payload.values]
        return values, payload.field or 'valores', None, None

    field = payload.field or 'total'
    column = FIELD_ALIASES.get(field, field)

    if payload.dataset_id:
        dataset = db.execute(
            select(Dataset).where(Dataset.id == payload.dataset_id, Dataset.company_id == company_id)
        ).scalar_one_or_none()
        if dataset is None:
            raise NotFound('Dataset no encontrado.')
        observations = db.execute(
            select(Observation).where(Observation.dataset_id == dataset.id)
        ).scalars().all()
        rows = [observation.data for observation in observations]
        if rows and column not in rows[0]:
            raise ValidationAppError(
                f'La variable "{field}" no está declarada en el dataset (RN-46).'
            )
        values = [float(row[column]) for row in rows if row.get(column) is not None]
        return values, column, dataset, _period_from(rows)

    # Sin dataset: se derivan de la operación real (tickets no anulados).
    rows = _sales_rows(db, company_id, {'months': 12})
    column = FIELD_ALIASES.get(field, field)
    if rows and column not in rows[0]:
        raise ValidationAppError(f'La variable "{field}" no existe en la operación (RN-46).')
    rows = [row for row in rows if row['status'] != 'cancelled']
    values = [float(row[column]) for row in rows if row.get(column) is not None]
    return values, column, None, _period_from(rows)


def _period_from(rows: List[dict]) -> Optional[dict]:
    stamps = [row.get('issued_at') for row in rows if row.get('issued_at')]
    if not stamps:
        return None
    return {'from': min(stamps)[:10], 'to': max(stamps)[:10]}


# ---------------------------------------------------------------- métricas

def _save_analysis(
    db: Session,
    company_id: int,
    actor,
    analysis_type: str,
    parameters: dict,
    *,
    dataset_id: Optional[int] = None,
    metric: str = '',
    value: float = 0.0,
    summary: Optional[dict] = None,
) -> int:
    """RF-21: cada ejecución crea un registro nuevo; nunca se sobrescribe."""
    analysis = StatisticalAnalysis(
        company_id=company_id,
        dataset_id=dataset_id,
        analysis_type=analysis_type,
        parameters=parameters,
        executed_by=actor.id if actor else None,
    )
    db.add(analysis)
    db.flush()
    db.add(
        StatisticalResult(
            analysis_id=analysis.id,
            metric=metric or analysis_type,
            value=round4(value),
            summary=summary or {},
        )
    )
    return analysis.id


def _result_label(kind: str, values: List[float], value: float, field: str) -> str:
    if kind == 'media':
        return f'Media · {field} · S/ {value:.2f}'
    if kind == 'mediana':
        return f'Mediana · {field} · S/ {value:.2f}'
    if kind == 'comparacion':
        return f'Media vs. mediana · {field}'
    if kind == 'bayes':
        return f'Bayes · P(A|B) = {value:.4f}'
    if kind == 'variable':
        return f'Variable · {field} ({len(values)} valores)'
    return field


def compute_metric(
    db: Session, company_id: int, payload: StatInput, metric: str, actor=None
) -> dict:
    values, field, dataset, period = resolve_values(db, company_id, payload)
    stats = describe(values)  # RN-40 si hay menos de 2 observaciones
    value = stats['mean'] if metric == 'mean' else stats['median']
    result: Dict[str, Any] = {
        'metric': metric,
        'value': round(value, 4),
        'count': int(stats['count']),
        'min': stats['min'],
        'max': stats['max'],
        'period': period,
        'calculated_at': datetime.now(timezone.utc),
    }

    if payload.save_history:
        analysis_id = _save_analysis(
            db,
            company_id,
            actor,
            metric,
            {
                'field': field,
                'label': _result_label('media' if metric == 'mean' else 'mediana', values, value, field),
                'result': f'S/ {value:.2f}',
                'count': len(values),
            },
            dataset_id=dataset.id if dataset else None,
            metric=metric,
            value=value,
            summary={'count': len(values), 'min': stats['min'], 'max': stats['max'], 'field': field},
        )
        result['analysis_id'] = analysis_id
        db.commit()
    return result


def compare(db: Session, company_id: int, payload: StatInput, actor=None) -> dict:
    values, field, dataset, _period = resolve_values(db, company_id, payload)
    result = compare_metrics(values)  # RN-42 · RN-40
    result['count'] = len(values)

    if payload.save_history:
        analysis_id = _save_analysis(
            db,
            company_id,
            actor,
            'compare',
            {
                'field': field,
                'label': f'Media vs. mediana · {field}',
                'result': (
                    f'Diferencia S/ {result["difference"]:.2f} ({result["difference_pct"]}%)'
                ),
            },
            dataset_id=dataset.id if dataset else None,
            metric='compare',
            value=result['difference'],
            summary={**result, 'field': field, 'count': len(values)},
        )
        result['analysis_id'] = analysis_id
        db.commit()
    return result


def analyze_variables(db: Session, company_id: int, payload: StatInput, actor=None) -> dict:
    """Clasifica una o varias variables (RF-14 · RN-46)."""
    rows: List[dict] = []
    dataset: Optional[Dataset] = None

    if payload.dataset_id:
        dataset = db.execute(
            select(Dataset).where(Dataset.id == payload.dataset_id, Dataset.company_id == company_id)
        ).scalar_one_or_none()
        if dataset is None:
            raise NotFound('Dataset no encontrado.')
        rows = [obs.data for obs in db.execute(
            select(Observation).where(Observation.dataset_id == dataset.id)
        ).scalars().all()]
    elif payload.field:
        values, field, dataset, _ = resolve_values(db, company_id, payload)
        rows = [{field: value} for value in values]
    else:
        rows = _sales_rows(db, company_id, {'months': 12})

    columns = payload.field and [payload.field] or _default_columns(rows)
    variables = [
        classify_variable(column, [row.get(column) for row in rows])
        for column in columns
        if any(row.get(column) is not None for row in rows)
    ]
    if not variables:
        raise ValidationAppError('No hay variables por analizar (RN-46).')

    result: Dict[str, Any] = {'variables': variables}
    if payload.save_history:
        analysis_id = _save_analysis(
            db,
            company_id,
            actor,
            'variables',
            {
                'label': f'Variable · {variables[0]["name"]}',
                'result': (
                    f'{variables[0]["type"].title()} {variables[0]["subtype"]} '
                    f'({variables[0]["count"]} valores)'
                ),
                'columns': columns,
            },
            dataset_id=dataset.id if dataset else None,
            metric='variables',
            value=float(len(variables)),
            summary={'variables': variables},
        )
        result['analysis_id'] = analysis_id
        db.commit()
    return result


def _default_columns(rows: List[dict]) -> List[str]:
    preferred = [
        'total', 'subtotal', 'tax', 'quantity', 'unit_price', 'line_subtotal',
        'discount', 'category', 'seller_name', 'status', 'customer_segment', 'segment',
    ]
    available = rows[0].keys() if rows else []
    columns = [name for name in preferred if name in available]
    return columns or list(available)


# ---------------------------------------------------------------- datasets (RF-10)

def list_datasets(db: Session, company_id: int, *, page: int = 1, page_size: int = 20) -> dict:
    page, page_size = clamp_page(page, page_size)
    rows = db.execute(
        select(Dataset).where(Dataset.company_id == company_id).order_by(Dataset.created_at.desc())
    ).scalars().all()
    items = [_serialize_dataset(row) for row in rows]
    return paginate(items, page, page_size)


def _serialize_dataset(dataset: Dataset, with_variables: bool = True) -> dict:
    return {
        'id': dataset.id,
        'name': dataset.name,
        'description': dataset.description,
        'source': dataset.source,
        'filters': dataset.filters or {},
        'row_count': dataset.row_count,
        'created_at': dataset.created_at,
        'variables': [
            {
                'name': variable.name,
                'label': variable.label,
                'stat_type': variable.stat_type,
                'scale': variable.scale,
                'unit': variable.unit,
                'is_random_variable': variable.is_random_variable,
            }
            for variable in dataset.variables
        ]
        if with_variables
        else [],
    }


def create_dataset(
    db: Session, company_id: int, payload: DatasetCreate, actor=None
) -> dict:
    rows = build_rows(payload.source, db, company_id, payload.filters or {})

    dataset = Dataset(
        company_id=company_id,
        name=payload.name,
        description=payload.description,
        source=payload.source,
        filters=payload.filters or {},
        row_count=len(rows),
        created_by=actor.id if actor else None,
    )
    db.add(dataset)
    db.flush()

    specs = payload.fields or []
    if specs:
        for spec in specs:
            db.add(
                DatasetVariable(
                    dataset_id=dataset.id,
                    name=spec.name,
                    label=spec.label,
                    stat_type=spec.stat_type,
                    scale=spec.scale,
                    unit=spec.unit,
                    is_random_variable=spec.is_random_variable,
                )
            )
    elif rows:
        for column in list(rows[0].keys())[:12]:
            sample = [row.get(column) for row in rows[:200]]
            numeric = all(isinstance(value, (int, float)) for value in sample if value is not None)
            db.add(
                DatasetVariable(
                    dataset_id=dataset.id,
                    name=column,
                    stat_type='quantitative' if numeric else 'qualitative',
                    scale='continuous' if numeric else 'nominal',
                )
            )

    db.add_all([Observation(dataset_id=dataset.id, data=row) for row in rows[:20000]])
    db.commit()
    db.refresh(dataset)
    return _serialize_dataset(dataset)


def get_dataset(db: Session, company_id: int, dataset_id: int) -> dict:
    dataset = db.execute(
        select(Dataset).where(Dataset.id == dataset_id, Dataset.company_id == company_id)
    ).scalar_one_or_none()
    if dataset is None:
        raise NotFound('Dataset no encontrado.')

    payload = _serialize_dataset(dataset)
    observations = db.execute(
        select(Observation).where(Observation.dataset_id == dataset.id).limit(200)
    ).scalars().all()
    payload['observations'] = [observation.data for observation in observations]
    return payload


# ---------------------------------------------------------------- historial (RF-21)

def list_analyses(
    db: Session, company_id: int, *, kind: str = '', page: int = 1, page_size: int = 20
) -> dict:
    page, page_size = clamp_page(page, page_size)
    statement = select(StatisticalAnalysis).where(StatisticalAnalysis.company_id == company_id)
    if kind:
        statement = statement.where(StatisticalAnalysis.analysis_type.in_(_kinds_for(kind)))
    rows = (
        db.execute(statement.order_by(StatisticalAnalysis.created_at.desc())).scalars().all()
    )
    items = [_serialize_analysis(row) for row in rows]
    return paginate(items, page, page_size)


def _kinds_for(kind: str) -> List[str]:
    return [key for key, value in ANALYSIS_KIND.items() if value == kind] or [kind]


def _serialize_analysis(analysis: StatisticalAnalysis) -> dict:
    parameters = analysis.parameters or {}
    result = parameters.get('result') or _derive_result(analysis)
    return {
        'id': analysis.id,
        'kind': ANALYSIS_KIND.get(analysis.analysis_type, analysis.analysis_type),
        'label': parameters.get('label') or analysis.analysis_type,
        'result': result,
        'analysis_type': analysis.analysis_type,
        'parameters': parameters,
        'created_at': analysis.created_at,
    }


def _derive_result(analysis: StatisticalAnalysis) -> str:
    if not analysis.results:
        return ''
    summary = analysis.results[0].summary or {}
    if analysis.analysis_type in ('mean', 'median'):
        return f'S/ {as_float(analysis.results[0].value):.2f}'
    if analysis.analysis_type == 'compare':
        return f'Diferencia S/ {as_float(analysis.results[0].value):.2f} ({summary.get("difference_pct", 0)}%)'
    return str(as_float(analysis.results[0].value))


def get_analysis(db: Session, company_id: int, analysis_id: int) -> dict:
    analysis = db.execute(
        select(StatisticalAnalysis).where(
            StatisticalAnalysis.id == analysis_id,
            StatisticalAnalysis.company_id == company_id,
        )
    ).scalar_one_or_none()
    if analysis is None:
        raise NotFound('Análisis no encontrado.')

    payload = _serialize_analysis(analysis)
    payload['results'] = [
        {
            'metric': result.metric,
            'value': as_float(result.value),
            'summary': result.summary or {},
        }
        for result in analysis.results
    ]
    return payload
