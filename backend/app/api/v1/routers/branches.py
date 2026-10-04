"""Sucursales de la empresa (docs/04 §2.4)."""

from __future__ import annotations

from fastapi import APIRouter, Depends, Query, Request, status
from sqlalchemy.orm import Session

from app.api.deps import company_id_of, require_role
from app.core.database import get_db
from app.models.user import User
from app.schemas.warehouse import BranchCreate, BranchUpdate
from app.services import warehouse_service

router = APIRouter(prefix='/branches', tags=['branches'])

read_roles = ('Admin', 'Gerente', 'Vendedor', 'Analista', 'Almacén')
write_roles = ('Admin', 'Gerente')


def _ip(request: Request) -> str:
    return request.client.host if request.client else ''


@router.get('')
def list_branches(
    db: Session = Depends(get_db),
    user: User = Depends(require_role(*read_roles)),
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=20, ge=1, le=100),
):
    return warehouse_service.list_branches(
        db, company_id_of(user), page=page, page_size=page_size
    )


@router.get('/{branch_id}')
def get_branch(
    branch_id: int,
    db: Session = Depends(get_db),
    user: User = Depends(require_role(*read_roles)),
):
    return warehouse_service.get_branch(db, company_id_of(user), branch_id)


@router.post('', status_code=status.HTTP_201_CREATED)
def create_branch(
    payload: BranchCreate,
    request: Request,
    db: Session = Depends(get_db),
    actor: User = Depends(require_role(*write_roles)),
):
    return warehouse_service.create_branch(
        db, company_id_of(actor), payload, actor=actor, ip=_ip(request)
    )


@router.put('/{branch_id}')
def update_branch(
    branch_id: int,
    payload: BranchUpdate,
    request: Request,
    db: Session = Depends(get_db),
    actor: User = Depends(require_role(*write_roles)),
):
    return warehouse_service.update_branch(
        db, company_id_of(actor), branch_id, payload, actor=actor, ip=_ip(request)
    )


@router.delete('/{branch_id}')
def deactivate_branch(
    branch_id: int,
    request: Request,
    db: Session = Depends(get_db),
    actor: User = Depends(require_role('Admin')),
):
    return warehouse_service.deactivate_branch(
        db, company_id_of(actor), branch_id, actor=actor, ip=_ip(request)
    )
