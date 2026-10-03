"""Autenticación JWT + hash bcrypt (RN-30, RN-32, docs/02 §8.1)."""

from __future__ import annotations

import hashlib
from datetime import datetime, timedelta, timezone
from typing import Any, Dict

import bcrypt
import jwt

from app.core.config import settings

# bcrypt trunca a 72 bytes; se valida antes para no fallar en silencio.
_MAX_PASSWORD_BYTES = 72


def hash_password(password: str) -> str:
    raw = password.encode('utf-8')[:_MAX_PASSWORD_BYTES]
    return bcrypt.hashpw(raw, bcrypt.gensalt(rounds=12)).decode('utf-8')


def verify_password(password: str, password_hash: str) -> bool:
    if not password_hash:
        return False
    raw = password.encode('utf-8')[:_MAX_PASSWORD_BYTES]
    try:
        return bcrypt.checkpw(raw, password_hash.encode('utf-8'))
    except ValueError:
        return False


def _encode(payload: Dict[str, Any], expires_delta: timedelta) -> str:
    body = dict(payload)
    body['exp'] = datetime.now(timezone.utc) + expires_delta
    body['iat'] = datetime.now(timezone.utc)
    return jwt.encode(body, settings.secret_key, algorithm=settings.algorithm)


def create_access_token(*, user_id: int, role: str, company_id: int) -> str:
    """JWT con `sub`, `role` y `company_id` (aislamiento multiempresa)."""
    return _encode(
        {'sub': str(user_id), 'role': role, 'company_id': str(company_id), 'type': 'access'},
        timedelta(minutes=settings.access_token_expire_minutes),
    )


def create_refresh_token(*, user_id: int, role: str, company_id: int) -> str:
    return _encode(
        {'sub': str(user_id), 'role': role, 'company_id': str(company_id), 'type': 'refresh'},
        timedelta(days=settings.refresh_token_expire_days),
    )


def create_reset_token(user_id: int) -> str:
    """Token de un solo uso para restablecer la contraseña (30 min)."""
    return _encode({'sub': str(user_id), 'type': 'reset'}, timedelta(minutes=30))


def decode_token(token: str) -> Dict[str, Any]:
    """Decodifica y valida; lanza `jwt.PyJWTError` si es inválido o expiró."""
    return jwt.decode(token, settings.secret_key, algorithms=[settings.algorithm])


def hash_token(token: str) -> str:
    """Hash SHA-256 de un token para poder almacenarlo sin revelarlo."""
    return hashlib.sha256(token.encode('utf-8')).hexdigest()
