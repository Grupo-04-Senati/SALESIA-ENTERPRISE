"""Clientes: CRUD, historial de compras y baja lógica (RF-03 · RN-01, RN-02)."""

from __future__ import annotations

from fastapi import APIRouter, Depends, Query, Request, status
from sqlalchemy.orm import Session

from app.api.deps import company_id_of, get_current_user, require_role
from app.core.database import get_db
from app.models.user import User
from app.schemas.customer import CustomerCreate, CustomerUpdate
from app.services import customer_service

router = APIRouter(prefix='/customers', tags=['customers'])

read_roles = ('Admin', 'Gerente', 'Vendedor', 'Analista')
write_roles = ('Admin', 'Vendedor')


def _ip(request: Request) -> str:
    return request.client.host if request.client else ''


@router.get('')
def list_customers(
    db: Session = Depends(get_db),
    user: User = Depends(require_role(*read_roles)),
    q: str = Query(default=''),
    status_: str = Query(default='', alias='status'),
    segment: str = Query(default=''),
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=20, ge=1, le=100),
):
    return customer_service.list_customers(
        db, company_id_of(user), q=q, status=status_, segment=segment,
        page=page, page_size=page_size,
    )


@router.get('/{customer_id}')
def get_customer(
    customer_id: int,
    db: Session = Depends(get_db),
    user: User = Depends(require_role(*read_roles)),
):
    return customer_service.get_customer(db, company_id_of(user), customer_id)


@router.get('/{customer_id}/history')
def customer_history(
    customer_id: int,
    db: Session = Depends(get_db),
    user: User = Depends(require_role(*read_roles)),
):
    return customer_service.customer_history(db, company_id_of(user), customer_id)


@router.post('', status_code=status.HTTP_201_CREATED)
def create_customer(
    payload: CustomerCreate,
    request: Request,
    db: Session = Depends(get_db),
    actor: User = Depends(require_role(*write_roles)),
):
    return customer_service.create_customer(
        db, company_id_of(actor), payload, actor=actor, ip=_ip(request)
    )


@router.put('/{customer_id}')
def update_customer(
    customer_id: int,
    payload: CustomerUpdate,
    request: Request,
    db: Session = Depends(get_db),
    actor: User = Depends(require_role(*write_roles)),
):
    return customer_service.update_customer(
        db, company_id_of(actor), customer_id, payload, actor=actor, ip=_ip(request)
    )


@router.delete('/{customer_id}')
def deactivate_customer(
    customer_id: int,
    request: Request,
    db: Session = Depends(get_db),
    actor: User = Depends(require_role('Admin')),
):
    """Baja lógica (RN-02): el historial de compras se conserva."""
    return customer_service.deactivate_customer(
        db, company_id_of(actor), customer_id, actor=actor, ip=_ip(request)
    )
