"""Inventario: existencias, kardex y alertas (RF-08 · RN-20…RN-24)."""

from __future__ import annotations

from typing import Optional

from fastapi import APIRouter, Depends, Query, Request, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.api.deps import company_id_of, require_role
from app.core.database import get_db
from app.core.exceptions import NotFound
from app.models.inventory import Inventory
from app.models.user import User
from app.schemas.sale import MovementCreate
from app.services import inventory_service

router = APIRouter(prefix='/inventory', tags=['inventory'])

read_roles = ('Admin', 'Gerente', 'Vendedor', 'Analista', 'Almacén')
write_roles = ('Admin', 'Almacén')


def _ip(request: Request) -> str:
    return request.client.host if request.client else ''


@router.get('/movements')
def list_movements(
    db: Session = Depends(get_db),
    user: User = Depends(require_role(*read_roles)),
    product_id: Optional[int] = Query(default=None),
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=20, ge=1, le=100),
):
    return inventory_service.list_movements(
        db, company_id_of(user), product_id=product_id, page=page, page_size=page_size
    )


@router.post('/movements', status_code=status.HTTP_201_CREATED)
def create_movement(
    payload: MovementCreate,
    request: Request,
    db: Session = Depends(get_db),
    actor: User = Depends(require_role(*write_roles)),
):
    """Entrada / salida / merma / ajuste (RN-20, RN-21, RN-23)."""
    return inventory_service.create_movement(
        db, company_id_of(actor), payload, actor=actor, ip=_ip(request)
    )


@router.get('/alerts')
def alerts(db: Session = Depends(get_db), user: User = Depends(require_role(*read_roles))):
    """RN-24: productos con stock ≤ stock mínimo."""
    return inventory_service.list_alerts(db, company_id_of(user))


@router.get('')
def list_stock(db: Session = Depends(get_db), user: User = Depends(require_role(*read_roles))):
    return inventory_service.list_stock(db, company_id_of(user))


@router.get('/{product_id}')
def stock_of(
    product_id: int,
    db: Session = Depends(get_db),
    user: User = Depends(require_role(*read_roles)),
):
    row = db.execute(select(Inventory).where(Inventory.product_id == product_id)).scalar_one_or_none()
    if row is None:
        raise NotFound('Producto sin registro de inventario.')
    return {
        'product_id': row.product_id,
        'sku': row.product.sku if row.product else '',
        'name': row.product.name if row.product else '',
        'current_stock': row.stock,
        'min_stock': row.min_stock,
        'unit': row.product.unit if row.product else 'UND',
    }


@router.get('/{product_id}/movements')
def product_movements(
    product_id: int,
    db: Session = Depends(get_db),
    user: User = Depends(require_role(*read_roles)),
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=20, ge=1, le=100),
):
    return inventory_service.list_movements(
        db, company_id_of(user), product_id=product_id, page=page, page_size=page_size
    )
