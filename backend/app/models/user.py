"""3. users — usuarios del sistema (credenciales, rol, estado)."""

from __future__ import annotations

from datetime import datetime
from typing import TYPE_CHECKING, Optional

from sqlalchemy import BigInteger, Boolean, DateTime, ForeignKey, String
from sqlalchemy.orm import Mapped, MappedColumn, mapped_column, relationship

from app.models.base import IDMixin, UpdatedAtMixin
from app.core.database import Base

if TYPE_CHECKING:
    from app.models.company import Company
    from app.models.role import Role


class User(IDMixin, UpdatedAtMixin, Base):
    __tablename__ = 'users'

    company_id: Mapped[int] = mapped_column(
        BigInteger, ForeignKey('companies.id', ondelete='CASCADE'), index=True
    )
    role_id: Mapped[int] = mapped_column(BigInteger, ForeignKey('roles.id'))
    full_name: Mapped[str] = mapped_column(String(150))
    email: Mapped[str] = mapped_column(String(160), unique=True, index=True)
    password_hash: Mapped[str] = mapped_column(String(255))
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    last_login: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)

    role: Mapped['Role'] = relationship('Role', lazy='joined')
    company: Mapped['Company'] = relationship('Company', lazy='selectin')
