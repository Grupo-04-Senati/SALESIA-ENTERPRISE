"""Extensión docs/04 §2.4 — permisos, tokens y control de acceso."""

from __future__ import annotations

from datetime import datetime
from typing import Optional

from sqlalchemy import BigInteger, Boolean, DateTime, ForeignKey, String, Text, UniqueConstraint, func
from sqlalchemy.orm import Mapped, MappedColumn, mapped_column

from app.core.database import Base
from app.models.base import IDMixin, TimestampMixin


class Permission(IDMixin, Base):
    __tablename__ = 'permisos'

    code: Mapped[str] = mapped_column(String(60), unique=True)
    name: Mapped[str] = mapped_column(String(120))
    description: Mapped[Optional[str]] = mapped_column(Text, nullable=True)


class RolePermission(IDMixin, Base):
    __tablename__ = 'roles_permisos'
    __table_args__ = (
        UniqueConstraint('role_id', 'permission_id', name='uq_roles_permisos_role_permission'),
    )

    role_id: Mapped[int] = mapped_column(
        BigInteger, ForeignKey('roles.id', ondelete='CASCADE'), index=True
    )
    permission_id: Mapped[int] = mapped_column(
        BigInteger, ForeignKey('permisos.id', ondelete='CASCADE'), index=True
    )
    granted: Mapped[bool] = mapped_column(Boolean, default=True)


class RefreshToken(IDMixin, TimestampMixin, Base):
    __tablename__ = 'tokens_refresco'

    user_id: Mapped[int] = mapped_column(
        BigInteger, ForeignKey('usuarios.id', ondelete='CASCADE'), index=True
    )
    token_hash: Mapped[str] = mapped_column(String(128), index=True)
    expires_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    revoked_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)


class LoginAttempt(IDMixin, Base):
    __tablename__ = 'intentos_login'

    user_id: Mapped[Optional[int]] = mapped_column(
        BigInteger, ForeignKey('usuarios.id', ondelete='SET NULL'), nullable=True, index=True
    )
    email: Mapped[str] = mapped_column(String(160))
    success: Mapped[bool] = mapped_column(Boolean, default=False)
    ip: Mapped[Optional[str]] = mapped_column(String(45), nullable=True)
    attempted_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), index=True
    )


class PasswordReset(IDMixin, TimestampMixin, Base):
    __tablename__ = 'recuperaciones_password'

    user_id: Mapped[int] = mapped_column(
        BigInteger, ForeignKey('usuarios.id', ondelete='CASCADE'), index=True
    )
    token_hash: Mapped[str] = mapped_column(String(128), index=True)
    expires_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    used_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
