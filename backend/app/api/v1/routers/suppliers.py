"""Proveedores: CRUD y baja lógica (BE-1)."""

from __future__ import annotations

from fastapi import APIRouter, Depends, Query, Request, status
from sqlalchemy.orm import Session

from app.api.deps import company_id_of, require_role
from app.core.database import get_db
from app.models.user import User
from app.schemas.suppliers import SupplierCreate, SupplierUpdate
from app.services import supplier_service

router = APIRouter(prefix='/suppliers', tags=['suppliers'])

read_roles = ('Admin', 'Gerente', 'Vendedor', 'Analista')
write_roles = ('Admin', 'Gerente')


def _ip(request: Request) -> str:
    return request.client.host if request.client else ''


@router.get('')
def list_suppliers(
    db: Session = Depends(get_db),
    user: User = Depends(require_role(*read_roles)),
    q: str = Query(default='', max_length=100),
    status_: str = Query(default='', alias='status'),
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=20, ge=1, le=100),
):
    return supplier_service.list_suppliers(
        db, company_id_of(user), q=q, status=status_, page=page, page_size=page_size,
    )


@router.get('/{supplier_id}')
def get_supplier(
    supplier_id: int,
    db: Session = Depends(get_db),
    user: User = Depends(require_role(*read_roles)),
):
    return supplier_service.get_supplier(db, company_id_of(user), supplier_id)


@router.post('', status_code=status.HTTP_201_CREATED)
def create_supplier(
    payload: SupplierCreate,
    request: Request,
    db: Session = Depends(get_db),
    actor: User = Depends(require_role(*write_roles)),
):
    return supplier_service.create_supplier(
        db, company_id_of(actor), payload, actor=actor, ip=_ip(request)
    )


@router.put('/{supplier_id}')
def update_supplier(
    supplier_id: int,
    payload: SupplierUpdate,
    request: Request,
    db: Session = Depends(get_db),
    actor: User = Depends(require_role(*write_roles)),
):
    return supplier_service.update_supplier(
        db, company_id_of(actor), supplier_id, payload, actor=actor, ip=_ip(request)
    )


@router.delete('/{supplier_id}')
def deactivate_supplier(
    supplier_id: int,
    request: Request,
    db: Session = Depends(get_db),
    actor: User = Depends(require_role('Admin')),
):
    """Baja lógica: las órdenes de compra se conservan."""
    return supplier_service.deactivate_supplier(
        db, company_id_of(actor), supplier_id, actor=actor, ip=_ip(request)
    )
