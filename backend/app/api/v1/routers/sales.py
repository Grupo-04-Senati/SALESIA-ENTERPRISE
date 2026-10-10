"""Ventas, pagos e inventario (RF-06…RF-08 · RN-07…RN-24)."""

from __future__ import annotations

from typing import Optional

from fastapi import APIRouter, Depends, Query, Request, status
from sqlalchemy.orm import Session

from app.api.deps import company_id_of, require_role
from app.core.database import get_db
from app.models.user import User
from app.schemas.sale import CancelRequest, PaymentCreate, ReceivedUpdate, SaleCreate, StatusUpdate
from app.services import sale_service

router = APIRouter(tags=['sales'])

read_roles = ('Admin', 'Gerente', 'Vendedor', 'Analista', 'Almacén')
sell_roles = ('Admin', 'Gerente', 'Vendedor')
manage_roles = ('Admin', 'Gerente')
pay_roles = ('Admin', 'Gerente', 'Vendedor')


def _ip(request: Request) -> str:
    return request.client.host if request.client else ''


@router.post('/sales', status_code=status.HTTP_201_CREATED)
def create_sale(
    payload: SaleCreate,
    request: Request,
    db: Session = Depends(get_db),
    actor: User = Depends(require_role(*sell_roles)),
):
    """Registro transaccional: detalle + pago + stock (RN-10, RN-11, RN-20)."""
    return sale_service.create_sale(
        db, company_id_of(actor), payload, actor=actor, ip=_ip(request)
    )


@router.get('/sales')
def list_sales(
    db: Session = Depends(get_db),
    user: User = Depends(require_role(*read_roles)),
    q: str = Query(default='', max_length=100),
    status_: str = Query(default='', alias='status'),
    customer_id: Optional[int] = Query(default=None),
    seller_id: Optional[int] = Query(default=None),
    date_from: Optional[str] = Query(default=None),
    date_to: Optional[str] = Query(default=None),
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=20, ge=1, le=100),
):
    from app.services.statistics_service import _parse_date

    return sale_service.list_sales(
        db,
        company_id_of(user),
        q=q,
        status=status_,
        customer_id=customer_id,
        seller_id=seller_id,
        date_from=_parse_date(date_from) if date_from else None,
        date_to=_parse_date(date_to, end=True) if date_to else None,
        page=page,
        page_size=page_size,
    )


@router.get('/sales/{sale_id}')
def get_sale(
    sale_id: int,
    db: Session = Depends(get_db),
    user: User = Depends(require_role(*read_roles)),
):
    return sale_service.get_sale(db, company_id_of(user), sale_id)


@router.put('/sales/{sale_id}/status')
def update_status(
    sale_id: int,
    payload: StatusUpdate,
    request: Request,
    db: Session = Depends(get_db),
    actor: User = Depends(require_role(*manage_roles)),
):
    """RN-17/RN-18: cambio manual de estado (Admin/Gerente)."""
    return sale_service.update_sale_status(
        db, company_id_of(actor), sale_id, payload.status, payload.reason,
        actor=actor, ip=_ip(request),
    )


@router.put('/sales/{sale_id}/received')
def update_received(
    sale_id: int,
    payload: ReceivedUpdate,
    request: Request,
    db: Session = Depends(get_db),
    actor: User = Depends(require_role(*manage_roles)),
):
    """Marca o desmarca la entrega del pedido (visible en la tienda)."""
    return sale_service.set_sale_received(
        db, company_id_of(actor), sale_id, payload.received, actor=actor, ip=_ip(request)
    )


@router.post('/sales/{sale_id}/cancel')
def cancel_sale(
    sale_id: int,
    payload: CancelRequest,
    request: Request,
    db: Session = Depends(get_db),
    actor: User = Depends(require_role(*manage_roles)),
):
    """RN-14/RN-15: anula, exige motivo ≥ 10 caracteres y devuelve el stock."""
    return sale_service.cancel_sale(
        db, company_id_of(actor), sale_id, payload.reason, actor=actor, ip=_ip(request)
    )


@router.get('/sales/{sale_id}/payments')
def list_payments(
    sale_id: int,
    db: Session = Depends(get_db),
    user: User = Depends(require_role(*read_roles)),
):
    sale = sale_service.get_sale(db, company_id_of(user), sale_id)
    return {'items': sale['payments'], 'total': len(sale['payments']),
            'page': 1, 'page_size': len(sale['payments']) or 1, 'pages': 1}


@router.post('/sales/{sale_id}/payments', status_code=status.HTTP_201_CREATED)
def add_payment(
    sale_id: int,
    payload: PaymentCreate,
    request: Request,
    db: Session = Depends(get_db),
    actor: User = Depends(require_role(*pay_roles)),
):
    """RN-16: el pago no supera el saldo · RN-17: el estado se recalcula."""
    return sale_service.add_payment(
        db, company_id_of(actor), sale_id, payload, actor=actor, ip=_ip(request)
    )
