"""1. companies — empresa propietaria de los datos (aislamiento multi-tenant)."""

from __future__ import annotations

from typing import Optional

from sqlalchemy import Boolean, String
from sqlalchemy.orm import Mapped, MappedColumn, mapped_column

from app.models.base import IDMixin, UpdatedAtMixin
from app.core.database import Base


class Company(IDMixin, UpdatedAtMixin, Base):
    __tablename__ = 'empresas'

    name: Mapped[str] = mapped_column(String(150))
    ruc: Mapped[Optional[str]] = mapped_column(String(20), unique=True, nullable=True)
    address: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    phone: Mapped[Optional[str]] = mapped_column(String(20), nullable=True)
    email: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)
    status: Mapped[bool] = mapped_column(Boolean, default=True)
