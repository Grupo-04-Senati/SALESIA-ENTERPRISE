"""Insights: conclusiones determinísticas con evidencia (RF-18…RF-20 · RN-47, RN-48)."""

from __future__ import annotations

from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from app.api.deps import company_id_of, require_role
from app.core.database import get_db
from app.models.user import User
from app.services import insight_service

router = APIRouter(prefix='/insights', tags=['insights'])

read_roles = ('Admin', 'Gerente', 'Vendedor', 'Analista', 'Almacén')


@router.get('')
def list_insights(
    db: Session = Depends(get_db),
    user: User = Depends(require_role(*read_roles)),
    severity: str = Query(default=''),
    search: str = Query(default=''),
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=20, ge=1, le=100),
):
    """RF-18: se recalculan con la operación actual (upsert por regla)."""
    return insight_service.list_insights(
        db, company_id_of(user), severity=severity, search=search,
        page=page, page_size=page_size,
    )


@router.get('/rules')
def rules():
    """Reglas determinísticas vigentes con su configuración (RF-19)."""
    return insight_service.list_rules()


@router.get('/{insight_id}')
def get_insight(
    insight_id: int,
    db: Session = Depends(get_db),
    user: User = Depends(require_role(*read_roles)),
):
    return insight_service.get_insight(db, company_id_of(user), insight_id)
