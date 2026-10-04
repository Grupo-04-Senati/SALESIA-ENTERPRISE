"""Interacciones con clientes (docs/04 §2.4)."""

from __future__ import annotations

from typing import Optional

from fastapi import APIRouter, Depends, Query, Request, status
from sqlalchemy.orm import Session

from app.api.deps import company_id_of, require_role
from app.core.database import get_db
from app.models.user import User
from app.schemas.crm import CustomerInteractionCreate, CustomerInteractionUpdate
from app.services import crm_service

router = APIRouter(prefix='/customer-interactions', tags=['customer-interactions'])

read_roles = ('Admin', 'Gerente', 'Vendedor', 'Analista', 'Almacén')
write_roles = ('Admin', 'Gerente', 'Vendedor')


def _ip(request: Request) -> str:
    return request.client.host if request.client else ''


@router.get('')
def list_interactions(
    db: Session = Depends(get_db),
    user: User = Depends(require_role(*read_roles)),
    customer_id: Optional[int] = Query(default=None),
    kind: str = Query(default=''),
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=20, ge=1, le=100),
):
    return crm_service.list_interactions(
        db, company_id_of(user), customer_id=customer_id, kind=kind,
        page=page, page_size=page_size,
    )


@router.get('/{interaction_id}')
def get_interaction(
    interaction_id: int,
    db: Session = Depends(get_db),
    user: User = Depends(require_role(*read_roles)),
):
    return crm_service.get_interaction(db, company_id_of(user), interaction_id)


@router.post('', status_code=status.HTTP_201_CREATED)
def create_interaction(
    payload: CustomerInteractionCreate,
    request: Request,
    db: Session = Depends(get_db),
    actor: User = Depends(require_role(*write_roles)),
):
    return crm_service.create_interaction(
        db, company_id_of(actor), payload, actor=actor, ip=_ip(request)
    )


@router.put('/{interaction_id}')
def update_interaction(
    interaction_id: int,
    payload: CustomerInteractionUpdate,
    request: Request,
    db: Session = Depends(get_db),
    actor: User = Depends(require_role(*write_roles)),
):
    return crm_service.update_interaction(
        db, company_id_of(actor), interaction_id, payload, actor=actor, ip=_ip(request)
    )


@router.delete('/{interaction_id}')
def delete_interaction(
    interaction_id: int,
    request: Request,
    db: Session = Depends(get_db),
    actor: User = Depends(require_role('Admin', 'Gerente')),
):
    return crm_service.delete_interaction(
        db, company_id_of(actor), interaction_id, actor=actor, ip=_ip(request)
    )
