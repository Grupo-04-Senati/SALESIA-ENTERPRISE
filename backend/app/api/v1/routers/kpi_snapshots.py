"""Instantáneas de KPI: listado, cálculo automático y borrado (BE-3)."""

from __future__ import annotations

from fastapi import APIRouter, Depends, Query, Request, status
from sqlalchemy.orm import Session

from app.api.deps import company_id_of, require_role
from app.core.database import get_db
from app.models.user import User
from app.schemas.system import KpiSnapshotCreate
from app.services import analytics_extra_service

router = APIRouter(prefix='/kpi-snapshots', tags=['kpi-snapshots'])

read_roles = ('Admin', 'Gerente', 'Vendedor', 'Analista', 'Almacén')
write_roles = ('Admin', 'Gerente')


def _ip(request: Request) -> str:
    return request.client.host if request.client else ''


@router.get('')
def list_kpi_snapshots(
    db: Session = Depends(get_db),
    user: User = Depends(require_role(*read_roles)),
    kpi_code: str = Query(default=''),
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=20, ge=1, le=100),
):
    return analytics_extra_service.list_kpi_snapshots(
        db, company_id_of(user), kpi_code=kpi_code, page=page, page_size=page_size
    )


@router.get('/{snapshot_id}')
def get_kpi_snapshot(
    snapshot_id: int,
    db: Session = Depends(get_db),
    user: User = Depends(require_role(*read_roles)),
):
    return analytics_extra_service.get_kpi_snapshot(db, company_id_of(user), snapshot_id)


@router.post('', status_code=status.HTTP_201_CREATED)
def create_kpi_snapshot(
    payload: KpiSnapshotCreate,
    request: Request,
    db: Session = Depends(get_db),
    actor: User = Depends(require_role(*write_roles)),
):
    return analytics_extra_service.create_kpi_snapshot(
        db, company_id_of(actor), payload, actor=actor, ip=_ip(request)
    )


@router.delete('/{snapshot_id}')
def delete_kpi_snapshot(
    snapshot_id: int,
    request: Request,
    db: Session = Depends(get_db),
    actor: User = Depends(require_role(*write_roles)),
):
    return analytics_extra_service.delete_kpi_snapshot(
        db, company_id_of(actor), snapshot_id, actor=actor, ip=_ip(request)
    )
