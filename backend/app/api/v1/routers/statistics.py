"""Motor estadístico: métricas, variables, datasets e historial (RF-10…RF-14, RF-21)."""

from __future__ import annotations

from fastapi import APIRouter, Depends, Query, status
from sqlalchemy.orm import Session

from app.api.deps import company_id_of, require_role
from app.core.database import get_db
from app.models.user import User
from app.schemas.statistics import DatasetCreate, StatInput
from app.services import statistics_service

router = APIRouter(prefix='/statistics', tags=['statistics'])

read_roles = ('Admin', 'Gerente', 'Vendedor', 'Analista', 'Almacén')
write_roles = ('Admin', 'Analista')


@router.post('/mean', status_code=status.HTTP_200_OK)
def mean(
    payload: StatInput,
    db: Session = Depends(get_db),
    actor: User = Depends(require_role(*write_roles)),
):
    """RF-11 · RN-40: menos de 2 observaciones → DATOS_INSUFICIENTES."""
    return statistics_service.compute_metric(db, company_id_of(actor), payload, 'mean', actor=actor)


@router.post('/median', status_code=status.HTTP_200_OK)
def median(
    payload: StatInput,
    db: Session = Depends(get_db),
    actor: User = Depends(require_role(*write_roles)),
):
    return statistics_service.compute_metric(db, company_id_of(actor), payload, 'median', actor=actor)


@router.post('/compare', status_code=status.HTTP_200_OK)
def compare(
    payload: StatInput,
    db: Session = Depends(get_db),
    actor: User = Depends(require_role(*write_roles)),
):
    return statistics_service.compare(db, company_id_of(actor), payload, actor=actor)


@router.post('/variables', status_code=status.HTTP_200_OK)
def variables(
    payload: StatInput,
    db: Session = Depends(get_db),
    actor: User = Depends(require_role(*write_roles)),
):
    """RF-14 · RN-46: la variable debe estar declarada en el dataset."""
    return statistics_service.analyze_variables(db, company_id_of(actor), payload, actor=actor)


@router.get('/analyses')
def list_analyses(
    db: Session = Depends(get_db),
    user: User = Depends(require_role(*read_roles)),
    kind: str = Query(default=''),
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=20, ge=1, le=100),
):
    """RF-21: historial de análisis (nunca se sobrescribe)."""
    return statistics_service.list_analyses(
        db, company_id_of(user), kind=kind, page=page, page_size=page_size
    )


@router.get('/analyses/{analysis_id}')
def get_analysis(
    analysis_id: int,
    db: Session = Depends(get_db),
    user: User = Depends(require_role(*read_roles)),
):
    return statistics_service.get_analysis(db, company_id_of(user), analysis_id)


@router.get('/datasets')
def list_datasets(
    db: Session = Depends(get_db),
    user: User = Depends(require_role(*read_roles)),
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=20, ge=1, le=100),
):
    return statistics_service.list_datasets(db, company_id_of(user), page=page, page_size=page_size)


@router.post('/datasets', status_code=status.HTTP_201_CREATED)
def create_dataset(
    payload: DatasetCreate,
    db: Session = Depends(get_db),
    actor: User = Depends(require_role(*write_roles)),
):
    """RF-10: dataset derivado de la operación (ventas, clientes, productos)."""
    return statistics_service.create_dataset(db, company_id_of(actor), payload, actor=actor)


@router.get('/datasets/{dataset_id}')
def get_dataset(
    dataset_id: int,
    db: Session = Depends(get_db),
    user: User = Depends(require_role(*read_roles)),
):
    return statistics_service.get_dataset(db, company_id_of(user), dataset_id)
