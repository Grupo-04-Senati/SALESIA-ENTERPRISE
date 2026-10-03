"""Usuarios y roles del sistema (RF-02 · RN-30, RN-33, RN-35)."""

from __future__ import annotations

from typing import Optional

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.api.deps import role_display, role_key
from app.core.exceptions import Conflict, Forbidden, NotFound, ValidationAppError
from app.core.security import hash_password
from app.models.role import Role
from app.models.user import User
from app.schemas.auth import UserCreate, UserUpdate
from app.services.audit_service import write_audit
from app.utils.helpers import clamp_page, paginate
from app.utils.validators import valid_email


def _serialize(user: User) -> dict:
    return {
        'id': user.id,
        'name': user.full_name,
        'email': user.email,
        'role': role_display(user.role.name),
        'status': 'active' if user.is_active else 'inactive',
        'last_login': user.last_login,
    }


def list_users(
    db: Session, company_id: int, *, q: str = '', page: int = 1, page_size: int = 20
) -> dict:
    page, page_size = clamp_page(page, page_size)
    statement = select(User).where(User.company_id == company_id)
    if q:
        term = f'%{q.strip()}%'
        statement = statement.where(User.full_name.ilike(term) | User.email.ilike(term))
    rows = db.execute(statement.order_by(User.full_name)).scalars().all()
    return paginate([_serialize(row) for row in rows], page, page_size)


def list_roles(db: Session) -> dict:
    rows = db.execute(select(Role).order_by(Role.id)).scalars().all()
    items = [
        {
            'id': row.id,
            'name': role_display(row.name),
            'description': row.description,
            'permissions': row.permissions or {},
        }
        for row in rows
    ]
    return paginate(items, 1, max(len(items), 1))


def _resolve_role(db: Session, role: str) -> Role:
    key = role_key(role)
    row = db.execute(select(Role).where(Role.name == key)).scalar_one_or_none()
    if row is None:
        raise ValidationAppError(f'El rol "{role}" no existe.')
    return row


def create_user(db: Session, company_id: int, payload: UserCreate, actor=None) -> dict:
    valid_email(payload.email)
    if db.execute(select(User).where(User.email == payload.email.lower())).scalar_one_or_none():
        raise Conflict('Ya existe un usuario con ese correo.')

    user = User(
        company_id=company_id,
        role_id=_resolve_role(db, payload.role).id,
        full_name=payload.full_name,
        email=payload.email.lower(),
        password_hash=hash_password(payload.password),
        is_active=payload.status != 'inactive',
    )
    db.add(user)
    db.flush()
    write_audit(db, user=actor, action='user.create', entity='users', entity_id=user.id)
    db.commit()
    db.refresh(user)
    return _serialize(user)


def update_user(
    db: Session, company_id: int, user_id: int, payload: UserUpdate, actor=None
) -> dict:
    user = db.execute(
        select(User).where(User.id == user_id, User.company_id == company_id)
    ).scalar_one_or_none()
    if user is None:
        raise NotFound('Usuario no encontrado.')

    # RN-33: nadie modifica su propio rol ni eleva permisos.
    if actor is not None and actor.id == user_id and payload.role:
        if role_key(payload.role) != role_key(user.role.name):
            raise Forbidden('No puedes modificar tu propio rol (RN-33).')

    if payload.full_name:
        user.full_name = payload.full_name
    if payload.role:
        user.role_id = _resolve_role(db, payload.role).id
    if payload.password:
        user.password_hash = hash_password(payload.password)
    if payload.status:
        if actor is not None and actor.id == user_id and payload.status == 'inactive':
            raise Forbidden('No puedes desactivarte a ti mismo (RN-33).')
        user.is_active = payload.status == 'active'

    write_audit(db, user=actor, action='user.update', entity='users', entity_id=user.id)
    db.commit()
    db.refresh(user)
    return _serialize(user)


def set_user_status(
    db: Session, company_id: int, user_id: int, status: str, actor=None
) -> dict:
    user = db.execute(
        select(User).where(User.id == user_id, User.company_id == company_id)
    ).scalar_one_or_none()
    if user is None:
        raise NotFound('Usuario no encontrado.')
    if actor is not None and actor.id == user_id and status == 'inactive':
        raise Forbidden('No puedes desactivarte a ti mismo (RN-33).')

    user.is_active = status == 'active'
    write_audit(
        db, user=actor, action='user.status', entity='users', entity_id=user.id,
        detail={'status': status},
    )
    db.commit()
    db.refresh(user)
    return _serialize(user)


def deactivate_user(db: Session, company_id: int, user_id: int, actor=None) -> dict:
    """DELETE = desactivación lógica (los usuarios nunca se borran, RN-35)."""
    return set_user_status(db, company_id, user_id, 'inactive', actor=actor)
