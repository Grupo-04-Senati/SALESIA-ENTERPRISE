"""Vendedores / empleados y sus métricas comerciales (RF-05 · RN-07)."""

from __future__ import annotations

from fastapi import APIRouter, Depends, Query, Request, status
from sqlalchemy.orm import Session

from app.api.deps import company_id_of, require_role
from app.core.database import get_db
from app.models.user import User
from app.schemas.employee import EmployeeCreate, EmployeeUpdate
from app.services import employee_service

router = APIRouter(prefix='/employees', tags=['employees'])

read_roles = ('Admin', 'Gerente', 'Analista')
admin_only = require_role('Admin')


def _ip(request: Request) -> str:
    return request.client.host if request.client else ''


@router.get('')
def list_employees(
    db: Session = Depends(get_db),
    user: User = Depends(require_role(*read_roles)),
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=20, ge=1, le=100),
    metrics: bool = Query(default=True),
):
    return employee_service.list_employees(
        db, company_id_of(user), page=page, page_size=page_size, with_metrics=metrics
    )


@router.get('/{employee_id}')
def get_employee(
    employee_id: int,
    db: Session = Depends(get_db),
    user: User = Depends(require_role(*read_roles)),
):
    return employee_service.get_employee(db, company_id_of(user), employee_id)


@router.get('/{employee_id}/metrics')
def metrics(
    employee_id: int,
    db: Session = Depends(get_db),
    user: User = Depends(require_role(*read_roles)),
):
    return employee_service.get_employee(db, company_id_of(user), employee_id).get('metrics', {})


@router.post('', status_code=status.HTTP_201_CREATED)
def create_employee(
    payload: EmployeeCreate,
    request: Request,
    db: Session = Depends(get_db),
    actor: User = Depends(admin_only),
):
    return employee_service.create_employee(
        db, company_id_of(actor), payload, actor=actor, ip=_ip(request)
    )


@router.put('/{employee_id}')
def update_employee(
    employee_id: int,
    payload: EmployeeUpdate,
    request: Request,
    db: Session = Depends(get_db),
    actor: User = Depends(admin_only),
):
    return employee_service.update_employee(
        db, company_id_of(actor), employee_id, payload, actor=actor, ip=_ip(request)
    )
