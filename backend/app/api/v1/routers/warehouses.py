"""Almacenes de la empresa (docs/04 §2.4)."""

from __future__ import annotations

from fastapi import APIRouter, Depends, Query, Request, status
from sqlalchemy.orm import Session

from app.api.deps import company_id_of, require_role
from app.core.database import get_db
from app.models.user import User
from app.schemas.warehouse import WarehouseCreate, WarehouseUpdate
from app.services import warehouse_service

router = APIRouter(prefix='/warehouses', tags=['warehouses'])

read_roles = ('Admin', 'Gerente', 'Vendedor', 'Analista', 'Almacén')
write_roles = ('Admin', 'Gerente', 'Almacén')


def _ip(request: Request) -> str:
    return request.client.host if request.client else ''


@router.get('')
def list_warehouses(
    db: Session = Depends(get_db),
    user: User = Depends(require_role(*read_roles)),
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=20, ge=1, le=100),
):
    return warehouse_service.list_warehouses(
        db, company_id_of(user), page=page, page_size=page_size
    )


@router.get('/{warehouse_id}')
def get_warehouse(
    warehouse_id: int,
    db: Session = Depends(get_db),
    user: User = Depends(require_role(*read_roles)),
):
    return warehouse_service.get_warehouse(db, company_id_of(user), warehouse_id)


@router.post('', status_code=status.HTTP_201_CREATED)
def create_warehouse(
    payload: WarehouseCreate,
    request: Request,
    db: Session = Depends(get_db),
    actor: User = Depends(require_role(*write_roles)),
):
    return warehouse_service.create_warehouse(
        db, company_id_of(actor), payload, actor=actor, ip=_ip(request)
    )


@router.put('/{warehouse_id}')
def update_warehouse(
    warehouse_id: int,
    payload: WarehouseUpdate,
    request: Request,
    db: Session = Depends(get_db),
    actor: User = Depends(require_role(*write_roles)),
):
    return warehouse_service.update_warehouse(
        db, company_id_of(actor), warehouse_id, payload, actor=actor, ip=_ip(request)
    )


@router.delete('/{warehouse_id}')
def deactivate_warehouse(
    warehouse_id: int,
    request: Request,
    db: Session = Depends(get_db),
    actor: User = Depends(require_role('Admin')),
):
    """Baja lógica; no permite almacenes con stock asignado."""
    return warehouse_service.deactivate_warehouse(
        db, company_id_of(actor), warehouse_id, actor=actor, ip=_ip(request)
    )
