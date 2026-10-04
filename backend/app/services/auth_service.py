"""Autenticación: login, refresh y sesión (RF-01 · RN-30, RN-31, RN-35)."""

from __future__ import annotations

from datetime import datetime, timedelta, timezone
from typing import Optional

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.api.deps import role_display
from app.core.config import settings
from app.core.exceptions import Forbidden, RateLimited, Unauthenticated, ValidationAppError
from app.core.security import (
    create_access_token,
    create_refresh_token,
    decode_token,
    hash_password,
    verify_password,
)
from app.models.security import LoginAttempt
from app.models.user import User
from app.services.audit_service import write_audit

# RN-31: 5 intentos fallidos → bloqueo temporal. Los intentos se persisten en
# `intentos_login` (no en memoria): sobreviven reinicios y funcionan con
# varias instancias detrás del proxy de Railway.
_MAX_ATTEMPTS = 5
_LOCK_SECONDS = 15 * 60


def _register_failure(db: Session, email: str, ip: Optional[str]) -> None:
    db.add(LoginAttempt(email=email.lower().strip(), success=False, ip=ip))


def _check_locked(db: Session, email: str) -> None:
    since = datetime.now(timezone.utc) - timedelta(seconds=_LOCK_SECONDS)
    failures = db.execute(
        select(func.count(LoginAttempt.id)).where(
            LoginAttempt.email == email.lower().strip(),
            LoginAttempt.success.is_(False),
            LoginAttempt.attempted_at >= since,
        )
    ).scalar_one()
    if failures >= _MAX_ATTEMPTS:
        raise RateLimited(
            'Demasiados intentos fallidos: la cuenta queda bloqueada 15 minutos (RN-31).'
        )


def login(db: Session, email: str, password: str, ip: Optional[str] = None) -> dict:
    _check_locked(db, email)

    user: Optional[User] = db.execute(
        select(User).where(User.email == email.lower().strip())
    ).scalar_one_or_none()

    if user is None or not verify_password(password, user.password_hash):
        _register_failure(db, email, ip)
        db.commit()
        raise Unauthenticated('Correo o contraseña incorrectos.')

    if not user.is_active:
        raise Forbidden('El usuario está desactivado (RN-35).')

    role = user.role.name
    user.last_login = datetime.now(timezone.utc)
    db.add(LoginAttempt(user_id=user.id, email=user.email, success=True, ip=ip))
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
            'avatar': user.avatar,
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
            'avatar': user.avatar,
        },
    }


def me(user: User) -> dict:
    return {
        'id': user.id,
        'name': user.full_name,
        'email': user.email,
        'role': role_display(user.role.name),
        'company_id': user.company_id,
        'avatar': user.avatar,
    }


def update_profile(db: Session, user: User, payload) -> dict:
    """Actualiza nombre y/o foto del propio perfil (cualquier rol)."""
    changed: dict = {}
    if payload.full_name is not None:
        user.full_name = payload.full_name.strip()
        changed['full_name'] = user.full_name
    if payload.avatar is not None:
        user.avatar = payload.avatar or None
        changed['avatar'] = 'updated' if user.avatar else 'removed'
    if not changed:
        raise ValidationAppError('No hay cambios para guardar.')

    write_audit(
        db, user=user, action='user.profile_update', entity='users', entity_id=user.id,
        detail=changed,
    )
    db.commit()
    db.refresh(user)
    return me(user)


def change_password(db: Session, user: User, payload, ip: Optional[str] = None) -> dict:
    """Cambia la propia contraseña validando la actual (cualquier rol)."""
    if not verify_password(payload.current_password, user.password_hash):
        raise Unauthenticated('La contraseña actual es incorrecta.')
    if payload.current_password == payload.new_password:
        raise ValidationAppError('La contraseña nueva debe ser distinta a la actual.')

    user.password_hash = hash_password(payload.new_password)
    write_audit(
        db, user=user, action='auth.password_change', entity='users', entity_id=user.id,
        ip_address=ip,
    )
    db.commit()
    return {'detail': 'Contraseña actualizada correctamente.'}
