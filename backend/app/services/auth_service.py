"""Autenticación: login, refresh y sesión (RF-01 · RN-30, RN-31, RN-35)."""

from __future__ import annotations

import time
from datetime import datetime, timezone
from typing import Optional

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.api.deps import role_display
from app.core.config import settings
from app.core.exceptions import Forbidden, RateLimited, Unauthenticated, ValidationAppError
from app.core.security import (
    create_access_token,
    create_refresh_token,
    decode_token,
    verify_password,
)
from app.models.user import User
from app.services.audit_service import write_audit

# RN-31: 5 intentos fallidos → bloqueo temporal.
_MAX_ATTEMPTS = 5
_LOCK_SECONDS = 15 * 60
_attempts: dict[str, list[float]] = {}


def _attempt_key(email: str, ip: Optional[str]) -> str:
    return f'{email.lower()}|{ip or "-"}'


def _register_failure(key: str) -> None:
    now = time.monotonic()
    hits = [moment for moment in _attempts.get(key, []) if now - moment < _LOCK_SECONDS]
    hits.append(now)
    _attempts[key] = hits


def _check_locked(key: str) -> None:
    now = time.monotonic()
    hits = [moment for moment in _attempts.get(key, []) if now - moment < _LOCK_SECONDS]
    _attempts[key] = hits
    if len(hits) >= _MAX_ATTEMPTS:
        raise RateLimited(
            'Demasiados intentos fallidos: la cuenta queda bloqueada 15 minutos (RN-31).'
        )


def login(db: Session, email: str, password: str, ip: Optional[str] = None) -> dict:
    key = _attempt_key(email, ip)
    _check_locked(key)

    user: Optional[User] = db.execute(
        select(User).where(User.email == email.lower().strip())
    ).scalar_one_or_none()

    if user is None or not verify_password(password, user.password_hash):
        _register_failure(key)
        raise Unauthenticated('Correo o contraseña incorrectos.')

    if not user.is_active:
        raise Forbidden('El usuario está desactivado (RN-35).')

    _attempts.pop(key, None)
    role = user.role.name
    user.last_login = datetime.now(timezone.utc)
    write_audit(db, user=user, action='auth.login', entity='users', entity_id=user.id, ip_address=ip)
    db.commit()

    return {
        'access_token': create_access_token(
            user_id=user.id, role=role, company_id=user.company_id
        ),
        'refresh_token': create_refresh_token(
            user_id=user.id, role=role, company_id=user.company_id
        ),
        'token_type': 'bearer',
        'expires_in': settings.access_token_expire_minutes * 60,
        'user': {
            'id': user.id,
            'name': user.full_name,
            'email': user.email,
            'role': role_display(role),
        },
    }


def refresh(db: Session, refresh_token: str, ip: Optional[str] = None) -> dict:
    try:
        payload = decode_token(refresh_token)
    except Exception as exc:  # noqa: BLE001 — traducimos a error de dominio
        raise Unauthenticated('Refresh token inválido o expirado.') from exc

    if payload.get('type') != 'refresh':
        raise Unauthenticated('Se requiere un refresh token.')

    user = db.get(User, int(payload['sub']))
    if user is None or not user.is_active:
        raise Forbidden('Usuario inexistente o desactivado.')

    role = user.role.name
    return {
        'access_token': create_access_token(
            user_id=user.id, role=role, company_id=user.company_id
        ),
        'refresh_token': create_refresh_token(
            user_id=user.id, role=role, company_id=user.company_id
        ),
        'token_type': 'bearer',
        'expires_in': settings.access_token_expire_minutes * 60,
        'user': {
            'id': user.id,
            'name': user.full_name,
            'email': user.email,
            'role': role_display(role),
        },
    }


def me(user: User) -> dict:
    return {
        'id': user.id,
        'name': user.full_name,
        'email': user.email,
        'role': role_display(user.role.name),
        'company_id': user.company_id,
    }
