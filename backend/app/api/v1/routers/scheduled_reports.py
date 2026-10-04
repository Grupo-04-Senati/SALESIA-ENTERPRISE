"""Reportes programados: CRUD con baja lógica (BE-3)."""

from __future__ import annotations

from fastapi import APIRouter, Depends, Query, Request, status
from sqlalchemy.orm import Session

from app.api.deps import company_id_of, require_role
from app.core.database import get_db
from app.models.user import User
from app.schemas.system import ScheduledReportCreate, ScheduledReportUpdate
from app.services import analytics_extra_service

router = APIRouter(prefix='/scheduled-reports', tags=['scheduled-reports'])

read_roles = ('Admin', 'Gerente', 'Vendedor', 'Analista', 'Almacén')
write_roles = ('Admin', 'Gerente')


def _ip(request: Request) -> str:
    return request.client.host if request.client else ''


@router.get('')
def list_scheduled_reports(
    db: Session = Depends(get_db),
    user: User = Depends(require_role(*read_roles)),
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=20, ge=1, le=100),
):
    return analytics_extra_service.list_scheduled_reports(
        db, company_id_of(user), page=page, page_size=page_size
    )


@router.get('/{report_id}')
def get_scheduled_report(
    report_id: int,
    db: Session = Depends(get_db),
    user: User = Depends(require_role(*read_roles)),
):
    return analytics_extra_service.get_scheduled_report(db, company_id_of(user), report_id)


@router.post('', status_code=status.HTTP_201_CREATED)
def create_scheduled_report(
    payload: ScheduledReportCreate,
    request: Request,
    db: Session = Depends(get_db),
    actor: User = Depends(require_role(*write_roles)),
):
    return analytics_extra_service.create_scheduled_report(
        db, company_id_of(actor), payload, actor=actor, ip=_ip(request)
    )


@router.put('/{report_id}')
def update_scheduled_report(
    report_id: int,
    payload: ScheduledReportUpdate,
    request: Request,
    db: Session = Depends(get_db),
    actor: User = Depends(require_role(*write_roles)),
):
    return analytics_extra_service.update_scheduled_report(
        db, company_id_of(actor), report_id, payload, actor=actor, ip=_ip(request)
    )


@router.delete('/{report_id}')
def delete_scheduled_report(
    report_id: int,
    request: Request,
    db: Session = Depends(get_db),
    actor: User = Depends(require_role('Admin')),
):
    """Baja lógica (is_active=False) por Convenciones COMUNES §1."""
    return analytics_extra_service.deactivate_scheduled_report(
        db, company_id_of(actor), report_id, actor=actor, ip=_ip(request)
    )
