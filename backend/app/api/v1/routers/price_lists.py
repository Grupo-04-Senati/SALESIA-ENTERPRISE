"""Listas de precios y sus ítems (docs/04 §2.4)."""

from __future__ import annotations

from fastapi import APIRouter, Depends, Query, Request, status
from sqlalchemy.orm import Session

from app.api.deps import company_id_of, require_role
from app.core.database import get_db
from app.models.user import User
from app.schemas.pricing import PriceListCreate, PriceListItemsPayload, PriceListUpdate
from app.services import pricing_service

router = APIRouter(prefix='/price-lists', tags=['price-lists'])

read_roles = ('Admin', 'Gerente', 'Vendedor', 'Analista')
write_roles = ('Admin', 'Gerente')


def _ip(request: Request) -> str:
    return request.client.host if request.client else ''


@router.get('')
def list_price_lists(
    db: Session = Depends(get_db),
    user: User = Depends(require_role(*read_roles)),
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=20, ge=1, le=100),
):
    return pricing_service.list_price_lists(
        db, company_id_of(user), page=page, page_size=page_size
    )


@router.get('/{price_list_id}')
def get_price_list(
    price_list_id: int,
    db: Session = Depends(get_db),
    user: User = Depends(require_role(*read_roles)),
):
    return pricing_service.get_price_list(db, company_id_of(user), price_list_id)


@router.post('', status_code=status.HTTP_201_CREATED)
def create_price_list(
    payload: PriceListCreate,
    request: Request,
    db: Session = Depends(get_db),
    actor: User = Depends(require_role(*write_roles)),
):
    return pricing_service.create_price_list(
        db, company_id_of(actor), payload, actor=actor, ip=_ip(request)
    )


@router.put('/{price_list_id}')
def update_price_list(
    price_list_id: int,
    payload: PriceListUpdate,
    request: Request,
    db: Session = Depends(get_db),
    actor: User = Depends(require_role(*write_roles)),
):
    return pricing_service.update_price_list(
        db, company_id_of(actor), price_list_id, payload, actor=actor, ip=_ip(request)
    )


@router.put('/{price_list_id}/items')
def replace_price_list_items(
    price_list_id: int,
    payload: PriceListItemsPayload,
    request: Request,
    db: Session = Depends(get_db),
    actor: User = Depends(require_role(*write_roles)),
):
    """Reemplaza la lista completa de precios (upsert + baja de los retirados)."""
    return pricing_service.replace_price_list_items(
        db, company_id_of(actor), price_list_id, payload, actor=actor, ip=_ip(request)
    )


@router.delete('/{price_list_id}')
def deactivate_price_list(
    price_list_id: int,
    request: Request,
    db: Session = Depends(get_db),
    actor: User = Depends(require_role('Admin')),
):
    return pricing_service.deactivate_price_list(
        db, company_id_of(actor), price_list_id, actor=actor, ip=_ip(request)
    )
