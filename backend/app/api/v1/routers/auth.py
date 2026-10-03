"""AutenticaciÃ³n: login, refresh, logout, recuperaciÃ³n de clave y sesiÃ³n (RF-01)."""

from __future__ import annotations

import logging
from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, Depends, Request, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.api.deps import client_ip, get_current_user
from app.core.database import get_db
from app.core.exceptions import Unauthenticated
from app.core.security import create_reset_token, decode_token, hash_password, hash_token
from app.models.security import PasswordReset
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


@router.post('/login', status_code=status.HTTP_200_OK)
def login(payload: LoginRequest, request: Request, db: Session = Depends(get_db)):
    """RF-01 Â· RN-30 (bcrypt), RN-31 (bloqueo tras 5 intentos)."""
    return auth_service.login(db, payload.email, payload.password, ip=client_ip(request))


@router.post('/refresh', status_code=status.HTTP_200_OK)
def refresh(payload: RefreshRequest, request: Request, db: Session = Depends(get_db)):
    return auth_service.refresh(db, payload.refresh_token, ip=client_ip(request))


@router.post('/logout', status_code=status.HTTP_200_OK)
def logout(
    request: Request,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """El JWT es stateless: aquÃ­ solo queda constancia en la auditorÃ­a."""
    write_audit(
        db, user=user, action='auth.logout', entity='users', entity_id=user.id,
        ip_address=client_ip(request),
    )
    db.commit()
    return {'detail': 'SesiÃ³n cerrada.'}


@router.post('/forgot-password', status_code=status.HTTP_202_ACCEPTED)
def forgot_password(payload: ForgotPasswordRequest, db: Session = Depends(get_db)):
    """Genera un token de recuperaciÃ³n de un solo uso (30 min).

    No se revela si el correo existe (evita enumeraciÃ³n de usuarios) y el
    token nunca se registra en los logs: solo se guarda su hash.
    """
    user = db.execute(
        select(User).where(User.email == payload.email.lower())
    ).scalar_one_or_none()
    if user is not None:
        token = create_reset_token(user.id)
        db.add(PasswordReset(
            user_id=user.id,
            token_hash=hash_token(token),
            expires_at=datetime.now(timezone.utc) + timedelta(minutes=30),
        ))
        db.commit()
        logger.warning(
            'password_reset solicitado user=%s (servicio de correo no configurado: '
            'el token no se envÃ­a por email)', user.id,
        )
    return {'detail': 'Si el correo existe, se enviÃ³ un enlace de recuperaciÃ³n.'}


@router.post('/reset-password', status_code=status.HTTP_200_OK)
def reset_password(payload: ResetPasswordRequest, request: Request, db: Session = Depends(get_db)):
    try:
        data = decode_token(payload.token)
    except Exception as exc:  # noqa: BLE001
        raise Unauthenticated('Token de recuperaciÃ³n invÃ¡lido o expirado.') from exc

    if data.get('type') != 'reset':
        raise Unauthenticated('Token de recuperaciÃ³n invÃ¡lido.')

    user = db.get(User, int(data['sub']))
    if user is None:
        raise Unauthenticated('Token de recuperaciÃ³n invÃ¡lido.')

    record = db.execute(
        select(PasswordReset).where(PasswordReset.token_hash == hash_token(payload.token))
    ).scalar_one_or_none()
    if record is None or record.used_at is not None:
        raise Unauthenticated('Token de recuperaciÃ³n invÃ¡lido o ya utilizado.')
    if record.expires_at < datetime.now(timezone.utc):
        raise Unauthenticated('Token de recuperaciÃ³n expirado.')

    user.password_hash = hash_password(payload.password)
    record.used_at = datetime.now(timezone.utc)
    write_audit(
        db, user=user, action='auth.password_reset', entity='users', entity_id=user.id,
        ip_address=client_ip(request),
    )
    db.commit()
    return {'detail': 'ContraseÃ±a restablecida correctamente.'}


@router.get('/me', status_code=status.HTTP_200_OK)
def me(user: User = Depends(get_current_user)):
    return auth_service.me(user)
