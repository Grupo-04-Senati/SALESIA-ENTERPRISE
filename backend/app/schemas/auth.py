"""Schemas de autenticación y usuarios (docs/05 §2.1–2.2)."""

from __future__ import annotations

from typing import List, Optional

from pydantic import BaseModel, EmailStr, Field


class LoginRequest(BaseModel):
    email: EmailStr
    password: str = Field(min_length=1)


class RefreshRequest(BaseModel):
    refresh_token: str


class UserOut(BaseModel):
    id: int
    name: str
    email: str
    role: str
    avatar: Optional[str] = None


class LoginResponse(BaseModel):
    access_token: str
    refresh_token: str
    token_type: str = 'bearer'
    expires_in: int
    user: UserOut


class RoleOut(BaseModel):
    id: int
    name: str
    description: Optional[str] = None
    permissions: dict = {}


class UserManagedOut(UserOut):
    status: str = 'active'


class UserCreate(BaseModel):
    full_name: str = Field(min_length=2, max_length=150)
    email: EmailStr
    password: str = Field(min_length=6, max_length=128)
    role: str
    status: str = 'active'


class UserUpdate(BaseModel):
    full_name: Optional[str] = None
    role: Optional[str] = None
    password: Optional[str] = None
    status: Optional[str] = None


class ProfileUpdate(BaseModel):
    """Actualización del propio perfil (cualquier rol): nombre y/o foto."""

    full_name: Optional[str] = Field(default=None, min_length=2, max_length=150)
    avatar: Optional[str] = Field(default=None, max_length=400_000)


class PasswordChange(BaseModel):
    """Cambio de la propia contraseña (cualquier rol)."""

    current_password: str = Field(min_length=1, max_length=128)
    new_password: str = Field(min_length=6, max_length=128)


class ForgotPasswordRequest(BaseModel):
    email: EmailStr


class ResetPasswordRequest(BaseModel):
    token: str = Field(min_length=10)
    password: str = Field(min_length=6, max_length=128)


class StatusPatch(BaseModel):
    status: str
