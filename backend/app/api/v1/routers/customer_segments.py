"""Segmentos de clientes (docs/04 §2.4)."""

from __future__ import annotations

from fastapi import APIRouter, Depends, Query, Request, status
from sqlalchemy.orm import Session

from app.api.deps import company_id_of, require_role
from app.core.database import get_db
from app.models.user import User
from app.schemas.crm import CustomerSegmentCreate, CustomerSegmentUpdate
from app.services import crm_service

router = APIRouter(prefix='/customer-segments', tags=['customer-segments'])

read_roles = ('Admin', 'Gerente', 'Vendedor', 'Analista', 'Almacén')
write_roles = ('Admin', 'Gerente', 'Vendedor')


def _ip(request: Request) -> str:
    return request.client.host if request.client else ''


@router.get('')
def list_segments(
    db: Session = Depends(get_db),
    user: User = Depends(require_role(*read_roles)),
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=20, ge=1, le=100),
):
    return crm_service.list_segments(db, company_id_of(user), page=page, page_size=page_size)


@router.get('/{segment_id}')
def get_segment(
    segment_id: int,
    db: Session = Depends(get_db),
    user: User = Depends(require_role(*read_roles)),
):
    return crm_service.get_segment(db, company_id_of(user), segment_id)


@router.post('', status_code=status.HTTP_201_CREATED)
def create_segment(
    payload: CustomerSegmentCreate,
    request: Request,
    db: Session = Depends(get_db),
    actor: User = Depends(require_role(*write_roles)),
):
    return crm_service.create_segment(
        db, company_id_of(actor), payload, actor=actor, ip=_ip(request)
    )


@router.put('/{segment_id}')
def update_segment(
    segment_id: int,
    payload: CustomerSegmentUpdate,
    request: Request,
    db: Session = Depends(get_db),
    actor: User = Depends(require_role(*write_roles)),
):
    return crm_service.update_segment(
        db, company_id_of(actor), segment_id, payload, actor=actor, ip=_ip(request)
    )


@router.delete('/{segment_id}')
def deactivate_segment(
    segment_id: int,
    request: Request,
    db: Session = Depends(get_db),
    actor: User = Depends(require_role('Admin')),
):
    return crm_service.deactivate_segment(
        db, company_id_of(actor), segment_id, actor=actor, ip=_ip(request)
    )
