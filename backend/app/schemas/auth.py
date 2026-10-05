"""Schemas de autenticación y usuarios (docs/05 §2.1–2.2)."""

from __future__ import annotations

from typing import Literal, Optional

from pydantic import EmailStr, Field

from app.schemas.base import NormalizedModel

# user_service acepta cualquier rol existente en la BD tras role_key()
# (mayúsculas/minúsculas y acentos): nombre visible y clave de BD.
RoleValue = Literal[
    'Admin', 'Gerente', 'Vendedor', 'Analista', 'Almacén',
    'admin', 'gerente', 'vendedor', 'analista', 'almacen', 'almacén',
]
ActiveStatus = Literal['active', 'inactive']


class LoginRequest(NormalizedModel):
    email: EmailStr
    password: str = Field(min_length=1, max_length=100)


class RefreshRequest(NormalizedModel):
    refresh_token: str = Field(max_length=4000)


class UserOut(NormalizedModel):
    id: int
    name: str
    email: str
    role: str
    avatar: Optional[str] = None


class LoginResponse(NormalizedModel):
    access_token: str
    refresh_token: str
    token_type: str = 'bearer'
    expires_in: int
    user: UserOut


class RoleOut(NormalizedModel):
    id: int
    name: str
    description: Optional[str] = None
    permissions: dict = {}


class UserManagedOut(UserOut):
    status: ActiveStatus = 'active'


class UserCreate(NormalizedModel):
    full_name: str = Field(min_length=2, max_length=150)
    email: EmailStr = Field(max_length=160)
    password: str = Field(min_length=6, max_length=72)
    role: RoleValue
    status: ActiveStatus = 'active'


class UserUpdate(NormalizedModel):
    full_name: Optional[str] = Field(default=None, min_length=2, max_length=150)
    role: Optional[RoleValue] = None
    password: Optional[str] = Field(default=None, min_length=6, max_length=72)
    status: Optional[ActiveStatus] = None


class ProfileUpdate(NormalizedModel):
    """Actualización del propio perfil (cualquier rol): nombre y/o foto."""

    full_name: Optional[str] = Field(default=None, min_length=2, max_length=150)
    avatar: Optional[str] = Field(default=None, max_length=400_000)


class PasswordChange(NormalizedModel):
    """Cambio de la propia contraseña (cualquier rol)."""
    # 72 = límite práctico de bcrypt y toque máximo del formulario (SettingsPage).

    current_password: str = Field(min_length=1, max_length=128)
    new_password: str = Field(min_length=6, max_length=72)


class ForgotPasswordRequest(NormalizedModel):
    email: EmailStr


class ResetPasswordRequest(NormalizedModel):
    token: str = Field(min_length=10, max_length=4000)
    password: str = Field(min_length=6, max_length=72)


class StatusPatch(NormalizedModel):
    status: ActiveStatus
