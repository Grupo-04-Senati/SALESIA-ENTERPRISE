"""Devoluciones de venta: aprobación y reposición de stock (BE-1)."""

from __future__ import annotations

from fastapi import APIRouter, Depends, Query, Request, status
from sqlalchemy.orm import Session

from app.api.deps import company_id_of, require_role
from app.core.database import get_db
from app.models.user import User
from app.schemas.returns import ReturnCreate, ReturnStatusUpdate, ReturnUpdate
from app.services import return_service

router = APIRouter(prefix='/returns', tags=['returns'])

read_roles = ('Admin', 'Gerente', 'Vendedor', 'Analista')
write_roles = ('Admin', 'Gerente', 'Vendedor')


def _ip(request: Request) -> str:
    return request.client.host if request.client else ''


@router.get('')
def list_returns(
    db: Session = Depends(get_db),
    user: User = Depends(require_role(*read_roles)),
    q: str = Query(default='', max_length=100),
    status_: str = Query(default='', alias='status'),
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=20, ge=1, le=100),
):
    return return_service.list_returns(
        db, company_id_of(user), q=q, status=status_, page=page, page_size=page_size,
    )


@router.get('/{return_id}')
def get_return(
    return_id: int,
    db: Session = Depends(get_db),
    user: User = Depends(require_role(*read_roles)),
):
    return return_service.get_return(db, company_id_of(user), return_id)


@router.post('', status_code=status.HTTP_201_CREATED)
def create_return(
    payload: ReturnCreate,
    request: Request,
    db: Session = Depends(get_db),
    actor: User = Depends(require_role(*write_roles)),
):
    return return_service.create_return(
        db, company_id_of(actor), payload, actor=actor, ip=_ip(request)
    )


@router.put('/{return_id}')
def update_return(
    return_id: int,
    payload: ReturnUpdate,
    request: Request,
    db: Session = Depends(get_db),
    actor: User = Depends(require_role(*write_roles)),
):
    return return_service.update_return(
        db, company_id_of(actor), return_id, payload, actor=actor, ip=_ip(request)
    )


@router.post('/{return_id}/approve')
def approve_return(
    return_id: int,
    request: Request,
    db: Session = Depends(get_db),
    actor: User = Depends(require_role(*write_roles)),
):
    """Repone el stock y registra el kardex de la devolución."""
    return return_service.approve_return(
        db, company_id_of(actor), return_id, actor=actor, ip=_ip(request)
    )


@router.patch('/{return_id}/status')
def set_return_status(
    return_id: int,
    payload: ReturnStatusUpdate,
    request: Request,
    db: Session = Depends(get_db),
    actor: User = Depends(require_role(*write_roles)),
):
    """Rechazo de una devolución pendiente."""
    return return_service.update_return_status(
        db, company_id_of(actor), return_id, payload, actor=actor, ip=_ip(request)
    )


@router.delete('/{return_id}')
def delete_return(
    return_id: int,
    request: Request,
    db: Session = Depends(get_db),
    actor: User = Depends(require_role('Admin')),
):
    """Borrado en cascada: solo devoluciones pendientes."""
    return return_service.delete_return(
        db, company_id_of(actor), return_id, actor=actor, ip=_ip(request)
    )
