"""Variables aleatorias: distribución, valor esperado y varianza (RF-15)."""

from __future__ import annotations

from fastapi import APIRouter, Depends, Query, status
from sqlalchemy.orm import Session

from app.api.deps import company_id_of, require_role
from app.core.database import get_db
from app.models.user import User
from app.schemas.probability import RandomVariableRequest
from app.services import random_variable_service

router = APIRouter(prefix='/random-variables', tags=['random-variables'])

read_roles = ('Admin', 'Gerente', 'Vendedor', 'Analista', 'Almacén')
write_roles = ('Admin', 'Analista')


@router.post('/analyze', status_code=status.HTTP_200_OK)
def analyze(
    payload: RandomVariableRequest,
    db: Session = Depends(get_db),
    actor: User = Depends(require_role(*write_roles)),
):
    return random_variable_service.analyze(db, company_id_of(actor), payload, actor=actor)


@router.get('')
def list_variables(
    db: Session = Depends(get_db),
    user: User = Depends(require_role(*read_roles)),
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=20, ge=1, le=100),
):
    return random_variable_service.list_variables(
        db, company_id_of(user), page=page, page_size=page_size
    )
