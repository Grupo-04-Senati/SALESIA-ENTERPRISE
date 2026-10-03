"""Extensión docs/04 §2.4 — segmentos e interacciones con clientes."""

from __future__ import annotations

from datetime import datetime
from typing import Optional

from sqlalchemy import BigInteger, DateTime, ForeignKey, Numeric, String, Text, UniqueConstraint, func
from sqlalchemy.orm import Mapped, MappedColumn, mapped_column

from app.core.database import Base
from app.models.base import IDMixin, TimestampMixin


class CustomerSegment(IDMixin, TimestampMixin, Base):
    __tablename__ = 'segmentos_clientes'
    __table_args__ = (
        UniqueConstraint('company_id', 'name', name='uq_segmentos_clientes_company_name'),
    )

    company_id: Mapped[int] = mapped_column(
        BigInteger, ForeignKey('empresas.id', ondelete='CASCADE'), index=True
    )
    name: Mapped[str] = mapped_column(String(60))
    description: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    min_purchases: Mapped[int] = mapped_column(default=0)
    min_total: Mapped[float] = mapped_column(Numeric(12, 2), default=0)
    is_active: Mapped[bool] = mapped_column(default=True)


class CustomerInteraction(IDMixin, TimestampMixin, Base):
    __tablename__ = 'interacciones_clientes'

    company_id: Mapped[int] = mapped_column(
        BigInteger, ForeignKey('empresas.id', ondelete='CASCADE'), index=True
    )
    customer_id: Mapped[int] = mapped_column(
        BigInteger, ForeignKey('clientes.id', ondelete='CASCADE'), index=True
    )
    kind: Mapped[str] = mapped_column(String(20), default='note')
    subject: Mapped[str] = mapped_column(String(150))
    notes: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    performed_by: Mapped[Optional[int]] = mapped_column(
        BigInteger, ForeignKey('usuarios.id', ondelete='SET NULL'), nullable=True
    )
    occurred_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )
