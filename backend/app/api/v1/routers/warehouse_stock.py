"""Stock por almacén (docs/04 §2.4)."""

from __future__ import annotations

from typing import Optional

from fastapi import APIRouter, Depends, Query, Request, status
from sqlalchemy.orm import Session

from app.api.deps import company_id_of, require_role
from app.core.database import get_db
from app.models.user import User
from app.schemas.warehouse import WarehouseStockCreate, WarehouseStockUpdate
from app.services import warehouse_service

router = APIRouter(prefix='/warehouse-stock', tags=['warehouse-stock'])

read_roles = ('Admin', 'Gerente', 'Vendedor', 'Analista', 'Almacén')
write_roles = ('Admin', 'Gerente', 'Almacén')


def _ip(request: Request) -> str:
    return request.client.host if request.client else ''


@router.get('')
def list_warehouse_stock(
    db: Session = Depends(get_db),
    user: User = Depends(require_role(*read_roles)),
    warehouse_id: Optional[int] = Query(default=None),
    q: str = Query(default=''),
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=20, ge=1, le=100),
):
    return warehouse_service.list_warehouse_stock(
        db, company_id_of(user), warehouse_id=warehouse_id, q=q,
        page=page, page_size=page_size,
    )


@router.get('/{stock_id}')
def get_warehouse_stock(
    stock_id: int,
    db: Session = Depends(get_db),
    user: User = Depends(require_role(*read_roles)),
):
    return warehouse_service.get_warehouse_stock(db, company_id_of(user), stock_id)


@router.post('', status_code=status.HTTP_201_CREATED)
def create_warehouse_stock(
    payload: WarehouseStockCreate,
    request: Request,
    db: Session = Depends(get_db),
    actor: User = Depends(require_role(*write_roles)),
):
    return warehouse_service.create_warehouse_stock(
        db, company_id_of(actor), payload, actor=actor, ip=_ip(request)
    )


@router.put('/{stock_id}')
def update_warehouse_stock(
    stock_id: int,
    payload: WarehouseStockUpdate,
    request: Request,
    db: Session = Depends(get_db),
    actor: User = Depends(require_role(*write_roles)),
):
    return warehouse_service.update_warehouse_stock(
        db, company_id_of(actor), stock_id, payload, actor=actor, ip=_ip(request)
    )


@router.delete('/{stock_id}')
def delete_warehouse_stock(
    stock_id: int,
    request: Request,
    db: Session = Depends(get_db),
    actor: User = Depends(require_role(*write_roles)),
):
    return warehouse_service.delete_warehouse_stock(
        db, company_id_of(actor), stock_id, actor=actor, ip=_ip(request)
    )
