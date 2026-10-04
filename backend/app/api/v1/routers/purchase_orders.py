"""Órdenes de compra: alta, estados y recepción de mercadería (BE-1)."""

from __future__ import annotations

from typing import Optional

from fastapi import APIRouter, Depends, Query, Request, status
from sqlalchemy.orm import Session

from app.api.deps import company_id_of, require_role
from app.core.database import get_db
from app.models.user import User
from app.schemas.purchase_orders import (
    PurchaseOrderCreate,
    PurchaseOrderStatusUpdate,
    PurchaseOrderUpdate,
)
from app.services import purchase_order_service

router = APIRouter(prefix='/purchase-orders', tags=['purchase-orders'])

read_roles = ('Admin', 'Gerente', 'Analista')
write_roles = ('Admin', 'Gerente')


def _ip(request: Request) -> str:
    return request.client.host if request.client else ''


@router.get('')
def list_purchase_orders(
    db: Session = Depends(get_db),
    user: User = Depends(require_role(*read_roles)),
    q: str = Query(default=''),
    status_: str = Query(default='', alias='status'),
    supplier_id: Optional[int] = Query(default=None),
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=20, ge=1, le=100),
):
    return purchase_order_service.list_purchase_orders(
        db, company_id_of(user), q=q, status=status_, supplier_id=supplier_id,
        page=page, page_size=page_size,
    )


@router.get('/{order_id}')
def get_purchase_order(
    order_id: int,
    db: Session = Depends(get_db),
    user: User = Depends(require_role(*read_roles)),
):
    return purchase_order_service.get_purchase_order(db, company_id_of(user), order_id)


@router.post('', status_code=status.HTTP_201_CREATED)
def create_purchase_order(
    payload: PurchaseOrderCreate,
    request: Request,
    db: Session = Depends(get_db),
    actor: User = Depends(require_role(*write_roles)),
):
    return purchase_order_service.create_purchase_order(
        db, company_id_of(actor), payload, actor=actor, ip=_ip(request)
    )


@router.put('/{order_id}')
def update_purchase_order(
    order_id: int,
    payload: PurchaseOrderUpdate,
    request: Request,
    db: Session = Depends(get_db),
    actor: User = Depends(require_role(*write_roles)),
):
    return purchase_order_service.update_purchase_order(
        db, company_id_of(actor), order_id, payload, actor=actor, ip=_ip(request)
    )


@router.patch('/{order_id}/status')
def set_purchase_order_status(
    order_id: int,
    payload: PurchaseOrderStatusUpdate,
    request: Request,
    db: Session = Depends(get_db),
    actor: User = Depends(require_role(*write_roles)),
):
    """Al pasar a 'received' se repone el stock y se registra el kardex."""
    return purchase_order_service.update_purchase_order_status(
        db, company_id_of(actor), order_id, payload, actor=actor, ip=_ip(request)
    )


@router.delete('/{order_id}')
def delete_purchase_order(
    order_id: int,
    request: Request,
    db: Session = Depends(get_db),
    actor: User = Depends(require_role('Admin')),
):
    """Borrado real en cascada: solo órdenes pendientes."""
    return purchase_order_service.delete_purchase_order(
        db, company_id_of(actor), order_id, actor=actor, ip=_ip(request)
    )
