"""Extensión docs/04 §2.4 — proveedores."""

from __future__ import annotations

from typing import Optional

from sqlalchemy import BigInteger, Boolean, ForeignKey, String, UniqueConstraint
from sqlalchemy.orm import Mapped, MappedColumn, mapped_column

from app.core.database import Base
from app.models.base import IDMixin, UpdatedAtMixin


class Supplier(IDMixin, UpdatedAtMixin, Base):
    __tablename__ = 'proveedores'
    __table_args__ = (UniqueConstraint('company_id', 'ruc', name='uq_proveedores_company_ruc'),)

    company_id: Mapped[int] = mapped_column(
        BigInteger, ForeignKey('empresas.id', ondelete='CASCADE'), index=True
    )
    ruc: Mapped[str] = mapped_column(String(15))
    name: Mapped[str] = mapped_column(String(150))
    email: Mapped[Optional[str]] = mapped_column(String(160), nullable=True)
    phone: Mapped[Optional[str]] = mapped_column(String(20), nullable=True)
    address: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
