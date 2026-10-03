"""Autenticación: login, refresh, logout, recuperación de clave y sesión (RF-01)."""

from __future__ import annotations

import logging
from datetime import timedelta

from fastapi import APIRouter, Depends, Request, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.api.deps import get_current_user
from app.core.database import get_db
from app.core.exceptions import Unauthenticated
from app.core.security import create_reset_token, decode_token, hash_password
from app.models.user import User
from app.schemas.auth import (
    ForgotPasswordRequest,
    LoginRequest,
    RefreshRequest,
    ResetPasswordRequest,
)
from app.services import auth_service
from app.services.audit_service import write_audit

router = APIRouter(prefix='/auth', tags=['auth'])
logger = logging.getLogger('salesia.auth')


def _ip(request: Request) -> str:
    return request.client.host if request.client else ''


@router.post('/login', status_code=status.HTTP_200_OK)
def login(payload: LoginRequest, request: Request, db: Session = Depends(get_db)):
    """RF-01 · RN-30 (bcrypt), RN-31 (bloqueo tras 5 intentos)."""
    return auth_service.login(db, payload.email, payload.password, ip=_ip(request))


@router.post('/refresh', status_code=status.HTTP_200_OK)
def refresh(payload: RefreshRequest, request: Request, db: Session = Depends(get_db)):
    return auth_service.refresh(db, payload.refresh_token, ip=_ip(request))


@router.post('/logout', status_code=status.HTTP_200_OK)
def logout(
    request: Request,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """El JWT es stateless: aquí solo queda constancia en la auditoría."""
    write_audit(
        db, user=user, action='auth.logout', entity='users', entity_id=user.id,
        ip_address=_ip(request),
    )
    db.commit()
    return {'detail': 'Sesión cerrada.'}


@router.post('/forgot-password', status_code=status.HTTP_202_ACCEPTED)
def forgot_password(payload: ForgotPasswordRequest, db: Session = Depends(get_db)):
    """Genera un token de recuperación de un solo uso (30 min).

    No se revela si el correo existe (evita enumeración de usuarios).
    """
    user = db.execute(
        select(User).where(User.email == payload.email.lower())
    ).scalar_one_or_none()
    if user is not None:
        token = create_reset_token(user.id)
        # Sin servicio de correo en FASE 05: el token queda en el log del servidor.
        logger.warning('password_reset_token user=%s token=%s', user.id, token)
    return {'detail': 'Si el correo existe, se envió un enlace de recuperación.'}


@router.post('/reset-password', status_code=status.HTTP_200_OK)
def reset_password(payload: ResetPasswordRequest, db: Session = Depends(get_db)):
    try:
        data = decode_token(payload.token)
    except Exception as exc:  # noqa: BLE001
        raise Unauthenticated('Token de recuperación inválido o expirado.') from exc

    if data.get('type') != 'reset':
        raise Unauthenticated('Token de recuperación inválido.')

    user = db.get(User, int(data['sub']))
    if user is None:
        raise Unauthenticated('Token de recuperación inválido.')

    user.password_hash = hash_password(payload.password)
    db.commit()
    return {'detail': 'Contraseña restablecida correctamente.'}


@router.get('/me', status_code=status.HTTP_200_OK)
def me(user: User = Depends(get_current_user)):
    return auth_service.me(user)
