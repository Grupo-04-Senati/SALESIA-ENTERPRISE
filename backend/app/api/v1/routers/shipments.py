"""Envíos de ventas: seguimiento y estados (BE-1)."""

from __future__ import annotations

from fastapi import APIRouter, Depends, Query, Request, status
from sqlalchemy.orm import Session

from app.api.deps import company_id_of, require_role
from app.core.database import get_db
from app.models.user import User
from app.schemas.shipments import ShipmentCreate, ShipmentStatusUpdate, ShipmentUpdate
from app.services import shipment_service

router = APIRouter(prefix='/shipments', tags=['shipments'])

read_roles = ('Admin', 'Gerente', 'Vendedor', 'Analista')
write_roles = ('Admin', 'Gerente')


def _ip(request: Request) -> str:
    return request.client.host if request.client else ''


@router.get('')
def list_shipments(
    db: Session = Depends(get_db),
    user: User = Depends(require_role(*read_roles)),
    status_: str = Query(default='', alias='status'),
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=20, ge=1, le=100),
):
    return shipment_service.list_shipments(
        db, company_id_of(user), status=status_, page=page, page_size=page_size,
    )


@router.get('/{shipment_id}')
def get_shipment(
    shipment_id: int,
    db: Session = Depends(get_db),
    user: User = Depends(require_role(*read_roles)),
):
    return shipment_service.get_shipment(db, company_id_of(user), shipment_id)


@router.post('', status_code=status.HTTP_201_CREATED)
def create_shipment(
    payload: ShipmentCreate,
    request: Request,
    db: Session = Depends(get_db),
    actor: User = Depends(require_role(*write_roles)),
):
    return shipment_service.create_shipment(
        db, company_id_of(actor), payload, actor=actor, ip=_ip(request)
    )


@router.put('/{shipment_id}')
def update_shipment(
    shipment_id: int,
    payload: ShipmentUpdate,
    request: Request,
    db: Session = Depends(get_db),
    actor: User = Depends(require_role(*write_roles)),
):
    return shipment_service.update_shipment(
        db, company_id_of(actor), shipment_id, payload, actor=actor, ip=_ip(request)
    )


@router.patch('/{shipment_id}/status')
def set_shipment_status(
    shipment_id: int,
    payload: ShipmentStatusUpdate,
    request: Request,
    db: Session = Depends(get_db),
    actor: User = Depends(require_role(*write_roles)),
):
    """Al pasar a 'shipped' se estampa shipped_at si estaba vacío."""
    return shipment_service.update_shipment_status(
        db, company_id_of(actor), shipment_id, payload, actor=actor, ip=_ip(request)
    )


@router.delete('/{shipment_id}')
def delete_shipment(
    shipment_id: int,
    request: Request,
    db: Session = Depends(get_db),
    actor: User = Depends(require_role('Admin')),
):
    return shipment_service.delete_shipment(
        db, company_id_of(actor), shipment_id, actor=actor, ip=_ip(request)
    )
