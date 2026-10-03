"""Dashboard ejecutivo: resumen, serie temporal, rankings y alertas (RF-09)."""

from __future__ import annotations

from typing import Optional

from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from app.api.deps import company_id_of, require_role
from app.core.database import get_db
from app.models.user import User
from app.services import dashboard_service

router = APIRouter(prefix='/dashboard', tags=['dashboard'])

read_roles = ('Admin', 'Gerente', 'Vendedor', 'Analista', 'Almacén')


@router.get('/summary')
def summary(
    db: Session = Depends(get_db),
    user: User = Depends(require_role(*read_roles)),
    date_from: Optional[str] = Query(default=None),
    date_to: Optional[str] = Query(default=None),
    seller_id: Optional[int] = Query(default=None),
    category_id: Optional[int] = Query(default=None),
):
    return dashboard_service.summary(
        db, company_id_of(user),
        date_from=date_from, date_to=date_to,
        seller_id=seller_id, category_id=category_id,
    )


@router.get('/timeseries')
def timeseries(
    db: Session = Depends(get_db),
    user: User = Depends(require_role(*read_roles)),
    period: str = Query(default='month', pattern='^(day|month)$'),
    date_from: Optional[str] = Query(default=None),
    date_to: Optional[str] = Query(default=None),
):
    return {
        'items': dashboard_service.timeseries(
            db, company_id_of(user), period=period, date_from=date_from, date_to=date_to
        )
    }


@router.get('/top')
def top(
    db: Session = Depends(get_db),
    user: User = Depends(require_role(*read_roles)),
    entity: str = Query(default='products', pattern='^(products|sellers)$'),
    limit: int = Query(default=5, ge=1, le=20),
    date_from: Optional[str] = Query(default=None),
    date_to: Optional[str] = Query(default=None),
):
    return {
        'items': dashboard_service.top(
            db, company_id_of(user), entity=entity, limit=limit,
            date_from=date_from, date_to=date_to,
        )
    }


@router.get('/stock-alerts')
def stock_alerts(db: Session = Depends(get_db), user: User = Depends(require_role(*read_roles))):
    items = dashboard_service.stock_alerts(db, company_id_of(user))
    return {'items': items, 'total': len(items), 'page': 1, 'page_size': len(items) or 1, 'pages': 1}
