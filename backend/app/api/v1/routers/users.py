"""Usuarios y roles (RF-02 · solo Admin)."""

from __future__ import annotations

from fastapi import APIRouter, Depends, Query, Request, Response, status
from sqlalchemy.orm import Session

from app.api.deps import company_id_of, require_role
from app.core.database import get_db
from app.models.user import User
from app.schemas.auth import StatusPatch, UserCreate, UserUpdate
from app.services import user_service

router = APIRouter(tags=['users'])
admin_only = require_role('Admin')


@router.get('/users')
def list_users(
    db: Session = Depends(get_db),
    actor: User = Depends(admin_only),
    q: str = Query(default=''),
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=20, ge=1, le=100),
):
    return user_service.list_users(db, company_id_of(actor), q=q, page=page, page_size=page_size)


@router.post('/users', status_code=status.HTTP_201_CREATED)
def create_user(
    payload: UserCreate,
    db: Session = Depends(get_db),
    actor: User = Depends(admin_only),
):
    return user_service.create_user(db, company_id_of(actor), payload, actor=actor)


@router.put('/users/{user_id}')
def update_user(
    user_id: int,
    payload: UserUpdate,
    db: Session = Depends(get_db),
    actor: User = Depends(admin_only),
):
    return user_service.update_user(db, company_id_of(actor), user_id, payload, actor=actor)


@router.patch('/users/{user_id}/status')
def patch_status(
    user_id: int,
    payload: StatusPatch,
    db: Session = Depends(get_db),
    actor: User = Depends(admin_only),
):
    return user_service.set_user_status(
        db, company_id_of(actor), user_id, payload.status, actor=actor
    )


@router.delete('/users/{user_id}')
def delete_user(
    user_id: int,
    db: Session = Depends(get_db),
    actor: User = Depends(admin_only),
):
    """Desactivación lógica (RN-35): los usuarios nunca se borran."""
    return user_service.deactivate_user(db, company_id_of(actor), user_id, actor=actor)


@router.get('/roles')
def list_roles(db: Session = Depends(get_db), _: User = Depends(admin_only)):
    return user_service.list_roles(db)
