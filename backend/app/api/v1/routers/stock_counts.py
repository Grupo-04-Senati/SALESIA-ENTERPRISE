"""Conteos de stock (docs/04 §2.4)."""

from __future__ import annotations

from typing import Optional

from fastapi import APIRouter, Depends, Query, Request, status
from sqlalchemy.orm import Session

from app.api.deps import company_id_of, require_role
from app.core.database import get_db
from app.models.user import User
from app.schemas.warehouse import StockCountCreate, StockCountUpdate
from app.services import warehouse_service

router = APIRouter(prefix='/stock-counts', tags=['stock-counts'])

read_roles = ('Admin', 'Gerente', 'Vendedor', 'Analista', 'Almacén')
write_roles = ('Admin', 'Gerente', 'Almacén')


def _ip(request: Request) -> str:
    return request.client.host if request.client else ''


@router.get('')
def list_stock_counts(
    db: Session = Depends(get_db),
    user: User = Depends(require_role(*read_roles)),
    status_: str = Query(default='', alias='status'),
    warehouse_id: Optional[int] = Query(default=None),
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=20, ge=1, le=100),
):
    return warehouse_service.list_stock_counts(
        db, company_id_of(user), status=status_, warehouse_id=warehouse_id,
        page=page, page_size=page_size,
    )


@router.get('/{count_id}')
def get_stock_count(
    count_id: int,
    db: Session = Depends(get_db),
    user: User = Depends(require_role(*read_roles)),
):
    return warehouse_service.get_stock_count(db, company_id_of(user), count_id)


@router.post('', status_code=status.HTTP_201_CREATED)
def create_stock_count(
    payload: StockCountCreate,
    request: Request,
    db: Session = Depends(get_db),
    actor: User = Depends(require_role(*write_roles)),
):
    return warehouse_service.create_stock_count(
        db, company_id_of(actor), payload, actor=actor, ip=_ip(request)
    )


@router.put('/{count_id}')
def update_stock_count(
    count_id: int,
    payload: StockCountUpdate,
    request: Request,
    db: Session = Depends(get_db),
    actor: User = Depends(require_role(*write_roles)),
):
    return warehouse_service.update_stock_count(
        db, company_id_of(actor), count_id, payload, actor=actor, ip=_ip(request)
    )


@router.post('/{count_id}/confirm')
def confirm_stock_count(
    count_id: int,
    request: Request,
    db: Session = Depends(get_db),
    actor: User = Depends(require_role(*write_roles)),
):
    """Aplica los ajustes de stock de los ítems con diferencia (RN-20)."""
    return warehouse_service.confirm_stock_count(
        db, company_id_of(actor), count_id, actor=actor, ip=_ip(request)
    )


@router.delete('/{count_id}')
def delete_stock_count(
    count_id: int,
    request: Request,
    db: Session = Depends(get_db),
    actor: User = Depends(require_role(*write_roles)),
):
    return warehouse_service.delete_stock_count(
        db, company_id_of(actor), count_id, actor=actor, ip=_ip(request)
    )
