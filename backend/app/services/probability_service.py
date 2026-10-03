"""Probabilidad: Bayes, probabilidad básica y eventos (RF-16, RF-17 · RN-43)."""

from __future__ import annotations

from datetime import datetime, timezone
from typing import List, Optional

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.analytics.bayes import bayes as bayes_engine
from app.analytics.probability import basic as basic_engine
from app.core.exceptions import NotFound
from app.models.dataset import Dataset
from app.models.statistical_analysis import StatisticalAnalysis
from app.schemas.probability import BayesRequest, BasicProbabilityRequest, EventCreate
from app.services.statistics_service import _save_analysis, resolve_values
from app.schemas.statistics import StatInput
from app.utils.helpers import clamp_page, paginate, round4


def compute_bayes(
    db: Session, company_id: int, payload: BayesRequest, actor=None
) -> dict:
    """Teorema de Bayes (RF-17). RN-43: P(B) = 0 → BAYES_POR_CERO 422."""
    result = bayes_engine(payload.p_a, payload.p_b_given_a, payload.p_b)

    if payload.save_history:
        label = payload.label or 'Teorema de Bayes'
        result['analysis_id'] = _save_bayes(
            db, company_id, actor, label=label, response=result
        )
        db.commit()
    return result


def _save_bayes(
    db: Session,
    company_id: int,
    actor,
    *,
    label: str,
    response: dict,
    dataset_id: Optional[int] = None,
) -> int:
    from app.models.bayes_analysis import BayesAnalysis

    db.add(
        BayesAnalysis(
            company_id=company_id,
            label=label,
            p_a=response['p_a'],
            p_b_given_a=response['p_b_given_a'],
            p_b=response['p_b'],
            p_a_given_b=response['p_a_given_b'],
            explanation=response['explanation'],
            created_by=actor.id if actor else None,
        )
    )
    return _save_analysis(
        db,
        company_id,
        actor,
        'bayes',
        {
            'label': f'Bayes · {label}',
            'result': f'P(A|B) = {response["p_a_given_b"]:.4f}',
            'p_a': response['p_a'],
            'p_b_given_a': response['p_b_given_a'],
            'p_b': response['p_b'],
            'p_a_given_b': response['p_a_given_b'],
        },
        dataset_id=dataset_id,
        metric='p_a_given_b',
        value=response['p_a_given_b'],
        summary={
            'p_a': response['p_a'],
            'p_b_given_a': response['p_b_given_a'],
            'p_b': response['p_b'],
            'formula': response['formula'],
        },
    )


def compute_basic(
    db: Session, company_id: int, payload: BasicProbabilityRequest, actor=None
) -> dict:
    """Probabilidad simple, conjunta, complementaria y condicional (RF-16)."""
    result = basic_engine(payload.p_a, payload.p_b, payload.p_intersection)

    if payload.save_history:
        analysis_id = _save_analysis(
            db,
            company_id,
            actor,
            'probability',
            {
                'label': 'Probabilidad básica',
                'result': result['summary'],
                **{key: value for key, value in result.items() if isinstance(value, (int, float))},
            },
            metric='p_b_given_a',
            value=result['p_b_given_a'],
            summary=result,
        )
        result['analysis_id'] = analysis_id
        db.commit()
    return result


# ---------------------------------------------------------------- eventos (RF-16)

def create_event(
    db: Session, company_id: int, payload: EventCreate, actor=None
) -> dict:
    """Define un evento con su probabilidad sobre un dataset opcional."""
    if payload.dataset_id:
        dataset = db.execute(
            select(Dataset).where(Dataset.id == payload.dataset_id, Dataset.company_id == company_id)
        ).scalar_one_or_none()
        if dataset is None:
            raise NotFound('Dataset no encontrado.')

    analysis_id = _save_analysis(
        db,
        company_id,
        actor,
        'probability',
        {
            'event': payload.name,
            'description': payload.description or '',
            'probability': payload.probability,
            'dataset_id': payload.dataset_id,
            'label': f'Evento · {payload.name}',
            'result': f'P = {round(payload.probability, 4)}',
        },
        dataset_id=payload.dataset_id,
        metric='p',
        value=payload.probability,
        summary={'event': payload.name, 'probability': payload.probability},
    )
    db.commit()
    return {
        'id': analysis_id,
        'name': payload.name,
        'description': payload.description or '',
        'probability': payload.probability,
        'dataset_id': payload.dataset_id,
        'created_at': datetime.now(timezone.utc),
    }


def list_events(
    db: Session, company_id: int, *, page: int = 1, page_size: int = 20
) -> dict:
    page, page_size = clamp_page(page, page_size)
    rows = (
        db.execute(
            select(StatisticalAnalysis)
            .where(
                StatisticalAnalysis.company_id == company_id,
                StatisticalAnalysis.analysis_type == 'probability',
                StatisticalAnalysis.parameters['event'].astext.isnot(None),
            )
            .order_by(StatisticalAnalysis.created_at.desc())
        )
        .scalars()
        .all()
    )
    items = [
        {
            'id': row.id,
            'name': (row.parameters or {}).get('event', ''),
            'description': (row.parameters or {}).get('description', ''),
            'probability': (row.parameters or {}).get('probability', 0.0),
            'dataset_id': (row.parameters or {}).get('dataset_id'),
            'created_at': row.created_at,
        }
        for row in rows
    ]
    return paginate(items, page, page_size)
