"""Cotizaciones: estados y conversión en venta (BE-1)."""

from __future__ import annotations

from typing import Optional

from fastapi import APIRouter, Depends, Query, Request, status
from sqlalchemy.orm import Session

from app.api.deps import company_id_of, require_role
from app.core.database import get_db
from app.models.user import User
from app.schemas.quotes import QuoteCreate, QuoteStatusUpdate, QuoteUpdate
from app.services import quote_service

router = APIRouter(prefix='/quotes', tags=['quotes'])

read_roles = ('Admin', 'Gerente', 'Vendedor', 'Analista')
write_roles = ('Admin', 'Gerente', 'Vendedor')


def _ip(request: Request) -> str:
    return request.client.host if request.client else ''


@router.get('')
def list_quotes(
    db: Session = Depends(get_db),
    user: User = Depends(require_role(*read_roles)),
    q: str = Query(default='', max_length=100),
    status_: str = Query(default='', alias='status'),
    customer_id: Optional[int] = Query(default=None),
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=20, ge=1, le=100),
):
    return quote_service.list_quotes(
        db, company_id_of(user), q=q, status=status_, customer_id=customer_id,
        page=page, page_size=page_size,
    )


@router.get('/{quote_id}')
def get_quote(
    quote_id: int,
    db: Session = Depends(get_db),
    user: User = Depends(require_role(*read_roles)),
):
    return quote_service.get_quote(db, company_id_of(user), quote_id)


@router.post('', status_code=status.HTTP_201_CREATED)
def create_quote(
    payload: QuoteCreate,
    request: Request,
    db: Session = Depends(get_db),
    actor: User = Depends(require_role(*write_roles)),
):
    return quote_service.create_quote(
        db, company_id_of(actor), payload, actor=actor, ip=_ip(request)
    )


@router.put('/{quote_id}')
def update_quote(
    quote_id: int,
    payload: QuoteUpdate,
    request: Request,
    db: Session = Depends(get_db),
    actor: User = Depends(require_role(*write_roles)),
):
    return quote_service.update_quote(
        db, company_id_of(actor), quote_id, payload, actor=actor, ip=_ip(request)
    )


@router.patch('/{quote_id}/status')
def set_quote_status(
    quote_id: int,
    payload: QuoteStatusUpdate,
    request: Request,
    db: Session = Depends(get_db),
    actor: User = Depends(require_role(*write_roles)),
):
    """Las cotizaciones convertidas en venta quedan inmutables."""
    return quote_service.update_quote_status(
        db, company_id_of(actor), quote_id, payload, actor=actor, ip=_ip(request)
    )


@router.post('/{quote_id}/convert', status_code=status.HTTP_201_CREATED)
def convert_quote(
    quote_id: int,
    request: Request,
    db: Session = Depends(get_db),
    actor: User = Depends(require_role(*write_roles)),
):
    """Exige estado approved y crea la venta (create_sale hace su commit)."""
    return quote_service.convert_quote(
        db, company_id_of(actor), quote_id, actor=actor, ip=_ip(request)
    )


@router.delete('/{quote_id}')
def delete_quote(
    quote_id: int,
    request: Request,
    db: Session = Depends(get_db),
    actor: User = Depends(require_role('Admin', 'Gerente')),
):
    """Borrado en cascada: solo cotizaciones en borrador."""
    return quote_service.delete_quote(
        db, company_id_of(actor), quote_id, actor=actor, ip=_ip(request)
    )
