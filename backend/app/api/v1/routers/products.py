"""Productos y categorÃ­as (RF-04 Â· RN-03â€¦RN-06)."""

from __future__ import annotations

from typing import Optional

from fastapi import APIRouter, Depends, File, Query, Request, UploadFile, status
from sqlalchemy.orm import Session

from app.api.deps import client_ip, company_id_of, require_role
from app.core.database import get_db
from app.models.user import User
from app.schemas.product import (
    CategoryCreate,
    CategoryUpdate,
    ProductCreate,
    ProductStatusPatch,
    ProductUpdate,
)
from app.services import product_service, storage_service

router = APIRouter(tags=['products'])

read_roles = ('Admin', 'Gerente', 'Vendedor', 'Analista', 'AlmacÃ©n')
admin_only = require_role('Admin')


@router.get('/products')
def list_products(
    db: Session = Depends(get_db),
    user: User = Depends(require_role(*read_roles)),
    q: str = Query(default='', max_length=100),
    status_: str = Query(default='', alias='status'),
    category_id: Optional[int] = Query(default=None),
    low_stock: bool = Query(default=False),
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=20, ge=1, le=100),
):
    return product_service.list_products(
        db, company_id_of(user), q=q, status=status_, category_id=category_id,
        low_stock=low_stock, page=page, page_size=page_size,
    )


@router.get('/products/{product_id}')
def get_product(
    product_id: int,
    db: Session = Depends(get_db),
    user: User = Depends(require_role(*read_roles)),
):
    return product_service.get_product(db, company_id_of(user), product_id)


@router.post('/products', status_code=status.HTTP_201_CREATED)
def create_product(
    payload: ProductCreate,
    request: Request,
    db: Session = Depends(get_db),
    actor: User = Depends(admin_only),
):
    return product_service.create_product(
        db, company_id_of(actor), payload, actor=actor, ip=client_ip(request)
    )


@router.put('/products/{product_id}')
def update_product(
    product_id: int,
    payload: ProductUpdate,
    request: Request,
    db: Session = Depends(get_db),
    actor: User = Depends(admin_only),
):
    return product_service.update_product(
        db, company_id_of(actor), product_id, payload, actor=actor, ip=client_ip(request)
    )


@router.patch('/products/{product_id}/status')
def patch_status(
    product_id: int,
    payload: ProductStatusPatch,
    request: Request,
    db: Session = Depends(get_db),
    actor: User = Depends(admin_only),
):
    return product_service.set_product_status(
        db, company_id_of(actor), product_id, payload.status,
        actor=actor, ip=client_ip(request),
    )


@router.delete('/products/{product_id}')
def delete_product(
    product_id: int,
    request: Request,
    db: Session = Depends(get_db),
    actor: User = Depends(admin_only),
):
    """Baja lÃ³gica del producto (los productos con ventas nunca se borran)."""
    return product_service.set_product_status(
        db, company_id_of(actor), product_id, 'inactive', actor=actor, ip=client_ip(request)
    )


@router.post('/products/image', status_code=status.HTTP_201_CREATED)
async def upload_product_image(
    file: UploadFile = File(...),
    actor: User = Depends(admin_only),
):
    """Sube una imagen de producto a Supabase Storage y devuelve su URL pública."""
    import uuid as _uuid
    from pathlib import Path as _Path

    stem = _Path(file.filename or '').stem or 'imagen'
    url = storage_service.upload_image(
        await file.read(),
        folder='products',
        name=f'{stem}-{_uuid.uuid4().hex[:8]}',
        content_type=file.content_type or '',
    )
    return {'url': url}


# ---------------------------------------------------------------- categorÃ­as

@router.get('/categories')
def list_categories(
    db: Session = Depends(get_db),
    user: User = Depends(require_role(*read_roles)),
):
    return product_service.list_categories(db, company_id_of(user))


@router.post('/categories', status_code=status.HTTP_201_CREATED)
def create_category(
    payload: CategoryCreate,
    request: Request,
    db: Session = Depends(get_db),
    actor: User = Depends(admin_only),
):
    return product_service.create_category(
        db, company_id_of(actor), payload, actor=actor, ip=client_ip(request)
    )


@router.put('/categories/{category_id}')
def update_category(
    category_id: int,
    payload: CategoryUpdate,
    request: Request,
    db: Session = Depends(get_db),
    actor: User = Depends(admin_only),
):
    return product_service.update_category(
        db, company_id_of(actor), category_id, payload, actor=actor, ip=client_ip(request)
    )


@router.delete('/categories/{category_id}')
def delete_category(
    category_id: int,
    request: Request,
    db: Session = Depends(get_db),
    actor: User = Depends(admin_only),
):
    """Elimina la categorÃ­a si ningÃºn producto la referencia."""
    return product_service.delete_category(
        db, company_id_of(actor), category_id, actor=actor, ip=client_ip(request)
    )
