"""Promociones y sus productos (docs/04 §2.4)."""

from __future__ import annotations

from fastapi import APIRouter, Depends, Query, Request, status
from sqlalchemy.orm import Session

from app.api.deps import company_id_of, require_role
from app.core.database import get_db
from app.models.user import User
from app.schemas.pricing import PromotionCreate, PromotionUpdate
from app.services import pricing_service

router = APIRouter(prefix='/promotions', tags=['promotions'])

read_roles = ('Admin', 'Gerente', 'Vendedor', 'Analista', 'Almacén')
write_roles = ('Admin', 'Gerente')


def _ip(request: Request) -> str:
    return request.client.host if request.client else ''


@router.get('')
def list_promotions(
    db: Session = Depends(get_db),
    user: User = Depends(require_role(*read_roles)),
    status_: str = Query(default='', alias='status'),
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=20, ge=1, le=100),
):
    return pricing_service.list_promotions(
        db, company_id_of(user), status=status_, page=page, page_size=page_size
    )


@router.get('/{promotion_id}')
def get_promotion(
    promotion_id: int,
    db: Session = Depends(get_db),
    user: User = Depends(require_role(*read_roles)),
):
    return pricing_service.get_promotion(db, company_id_of(user), promotion_id)


@router.post('', status_code=status.HTTP_201_CREATED)
def create_promotion(
    payload: PromotionCreate,
    request: Request,
    db: Session = Depends(get_db),
    actor: User = Depends(require_role(*write_roles)),
):
    return pricing_service.create_promotion(
        db, company_id_of(actor), payload, actor=actor, ip=_ip(request)
    )


@router.put('/{promotion_id}')
def update_promotion(
    promotion_id: int,
    payload: PromotionUpdate,
    request: Request,
    db: Session = Depends(get_db),
    actor: User = Depends(require_role(*write_roles)),
):
    return pricing_service.update_promotion(
        db, company_id_of(actor), promotion_id, payload, actor=actor, ip=_ip(request)
    )


@router.delete('/{promotion_id}')
def deactivate_promotion(
    promotion_id: int,
    request: Request,
    db: Session = Depends(get_db),
    actor: User = Depends(require_role('Admin')),
):
    return pricing_service.deactivate_promotion(
        db, company_id_of(actor), promotion_id, actor=actor, ip=_ip(request)
    )
