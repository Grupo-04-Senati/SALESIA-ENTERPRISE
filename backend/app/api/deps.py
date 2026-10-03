"""Dependencias FastAPI: sesión, usuario actual y control por rol (docs/02 §8)."""

from __future__ import annotations

from typing import Iterable, Optional

import jwt
from fastapi import Depends, Request
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.exceptions import Forbidden, Unauthenticated
from app.core.security import decode_token
from app.models.user import User

# La BD guarda los roles en minúsculas; el API/los DTOs usan el nombre visible.
ROLE_DISPLAY: dict[str, str] = {
    'admin': 'Admin',
    'gerente': 'Gerente',
    'vendedor': 'Vendedor',
    'analista': 'Analista',
    'almacen': 'Almacén',
}
DISPLAY_TO_KEY = {display.lower(): key for key, display in ROLE_DISPLAY.items()}


def role_key(role: str) -> str:
    """Normaliza 'Almacén' / 'almacen' / 'Admin' → clave de la BD."""
    normalized = role.strip().lower()
    return DISPLAY_TO_KEY.get(normalized, normalized)


def role_display(role: str) -> str:
    """Clave de BD → nombre visible ('almacen' → 'Almacén')."""
    return ROLE_DISPLAY.get(role.strip().lower(), role)


def get_token_from_request(request: Request) -> Optional[str]:
    authorization = request.headers.get('Authorization', '')
    if authorization.lower().startswith('bearer '):
        return authorization[7:].strip()
    return None


def get_current_user(
    request: Request,
    db: Session = Depends(get_db),
) -> User:
    """Resuelve el usuario activo del token Bearer (RN-32, RN-35)."""
    token = get_token_from_request(request)
    if not token:
        raise Unauthenticated('Token de autenticación ausente.')

    try:
        payload = decode_token(token)
    except jwt.ExpiredSignatureError as exc:
        raise Unauthenticated('El token ha expirado.') from exc
    except jwt.PyJWTError as exc:
        raise Unauthenticated('Token inválido.') from exc

    if payload.get('type') != 'access':
        raise Unauthenticated('Se requiere un access token.')

    user = db.get(User, int(payload['sub']))
    if user is None:
        raise Unauthenticated('Usuario no encontrado.')
    if not user.is_active:
        raise Forbidden('El usuario está desactivado (RN-35).')
    return user


def require_role(*roles: str):
    """Autorización RBAC: los roles aceptados pueden darse visibles o en clave."""

    allowed = {role_key(role) for role in roles}

    def dependency(user: User = Depends(get_current_user)) -> User:
        if role_key(user.role.name) not in allowed:
            raise Forbidden(f'Rol sin permiso: se requiere {", ".join(sorted(allowed))}.')
        return user

    return dependency


def company_id_of(user: User) -> int:
    """Aislamiento multiempresa (CA5-08): toda query filtra por company_id."""
    return user.company_id
