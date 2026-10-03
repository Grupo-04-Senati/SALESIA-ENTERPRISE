"""Variables aleatorias: análisis de distribuciones (RF-15 · docs/06 §6)."""

from __future__ import annotations

from typing import Optional

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.analytics.random_variables import analyze as analyze_engine
from app.models.random_variable import RandomVariable
from app.schemas.probability import RandomVariableRequest
from app.schemas.statistics import StatInput
from app.services.statistics_service import _save_analysis, resolve_values
from app.utils.helpers import as_float, clamp_page, paginate


def analyze(
    db: Session, company_id: int, payload: RandomVariableRequest, actor=None
) -> dict:
    """Distribución de frecuencias, valor esperado y varianza (RF-15)."""
    values, field, dataset, _period = resolve_values(
        db,
        company_id,
        StatInput(
            values=payload.values,
            dataset_id=payload.dataset_id,
            field=payload.field,
            save_history=payload.save_history,
        ),
    )
    result = analyze_engine(values, payload.distribution)
    result['field'] = field

    if payload.save_history:
        analysis_id = _save_analysis(
            db,
            company_id,
            actor,
            'random',
            {
                'label': f'Variable aleatoria · {field}',
                'result': f'E(X) = {result["expected_value"]} · varianza {result["variance"]}',
                'field': field,
                'distribution': result['distribution'],
            },
            dataset_id=dataset.id if dataset else None,
            metric='expected_value',
            value=result['expected_value'],
            summary={
                'variance': result['variance'],
                'count': result['count'],
                'field': field,
            },
        )
        db.add(
            RandomVariable(
                company_id=company_id,
                analysis_id=analysis_id,
                variable_name=field,
                description=result['summary'],
                distribution=result['distribution'],
                values={
                    'possible_values': result['possible_values'],
                    'probabilities': result['probabilities'],
                },
                expected_value=result['expected_value'],
                variance=result['variance'],
                created_by=actor.id if actor else None,
            )
        )
        result['analysis_id'] = analysis_id
        db.commit()
    return result


def list_variables(
    db: Session, company_id: int, *, page: int = 1, page_size: int = 20
) -> dict:
    page, page_size = clamp_page(page, page_size)
    rows = db.execute(
        select(RandomVariable)
        .where(RandomVariable.company_id == company_id)
        .order_by(RandomVariable.created_at.desc())
    ).scalars().all()
    items = [
        {
            'id': row.id,
            'name': row.variable_name,
            'description': row.description,
            'distribution': row.distribution,
            'expected_value': as_float(row.expected_value),
            'variance': as_float(row.variance),
            'analysis_id': row.analysis_id,
            'created_at': row.created_at,
        }
        for row in rows
    ]
    return paginate(items, page, page_size)
