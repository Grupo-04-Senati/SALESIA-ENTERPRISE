"""Probabilidad: Bayes, probabilidad básica y eventos (RF-16, RF-17 · RN-43)."""

from __future__ import annotations

from fastapi import APIRouter, Depends, Query, status
from sqlalchemy.orm import Session

from app.api.deps import company_id_of, require_role
from app.core.database import get_db
from app.models.user import User
from app.schemas.probability import BayesRequest, BasicProbabilityRequest, EventCreate
from app.services import probability_service

router = APIRouter(prefix='/probability', tags=['probability'])

read_roles = ('Admin', 'Gerente', 'Vendedor', 'Analista', 'Almacén')
write_roles = ('Admin', 'Analista')


@router.post('/bayes', status_code=status.HTTP_200_OK)
def bayes(
    payload: BayesRequest,
    db: Session = Depends(get_db),
    actor: User = Depends(require_role(*write_roles)),
):
    """RF-17 · RN-43: P(B) = 0 → BAYES_POR_CERO 422."""
    return probability_service.compute_bayes(db, company_id_of(actor), payload, actor=actor)


@router.post('/basic', status_code=status.HTTP_200_OK)
def basic(
    payload: BasicProbabilityRequest,
    db: Session = Depends(get_db),
    actor: User = Depends(require_role(*write_roles)),
):
    """RF-16: probabilidad simple, complementaria, conjunta y condicional."""
    return probability_service.compute_basic(db, company_id_of(actor), payload, actor=actor)


@router.get('/events')
def list_events(
    db: Session = Depends(get_db),
    user: User = Depends(require_role(*read_roles)),
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=20, ge=1, le=100),
):
    return probability_service.list_events(db, company_id_of(user), page=page, page_size=page_size)


@router.post('/events', status_code=status.HTTP_201_CREATED)
def create_event(
    payload: EventCreate,
    db: Session = Depends(get_db),
    actor: User = Depends(require_role(*write_roles)),
):
    return probability_service.create_event(db, company_id_of(actor), payload, actor=actor)
