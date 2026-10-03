"""Extensión docs/04 §2.4 — cotizaciones para clientes."""

from __future__ import annotations

from datetime import date
from typing import Optional

from sqlalchemy import (
    BigInteger,
    Date,
    ForeignKey,
    Numeric,
    String,
    Text,
    UniqueConstraint,
)
from sqlalchemy.orm import Mapped, MappedColumn, mapped_column

from app.core.database import Base
from app.models.base import IDMixin, TimestampMixin


class Quote(IDMixin, TimestampMixin, Base):
    __tablename__ = 'cotizaciones'
    __table_args__ = (UniqueConstraint('company_id', 'quote_number', name='uq_cotizaciones_company_number'),)

    company_id: Mapped[int] = mapped_column(
        BigInteger, ForeignKey('empresas.id', ondelete='CASCADE'), index=True
    )
    customer_id: Mapped[int] = mapped_column(
        BigInteger, ForeignKey('clientes.id', ondelete='RESTRICT'), index=True
    )
    quote_number: Mapped[str] = mapped_column(String(30))
    status: Mapped[str] = mapped_column(String(20), default='draft')
    valid_until: Mapped[Optional[date]] = mapped_column(Date, nullable=True)
    subtotal: Mapped[float] = mapped_column(Numeric(12, 2), default=0)
    tax: Mapped[float] = mapped_column(Numeric(12, 2), default=0)
    total: Mapped[float] = mapped_column(Numeric(12, 2), default=0)
    notes: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    created_by: Mapped[Optional[int]] = mapped_column(
        BigInteger, ForeignKey('usuarios.id', ondelete='SET NULL'), nullable=True
    )


class QuoteDetail(IDMixin, TimestampMixin, Base):
    __tablename__ = 'detalle_cotizaciones'

    quote_id: Mapped[int] = mapped_column(
        BigInteger, ForeignKey('cotizaciones.id', ondelete='CASCADE'), index=True
    )
    product_id: Mapped[int] = mapped_column(
        BigInteger, ForeignKey('productos.id', ondelete='RESTRICT'), index=True
    )
    quantity: Mapped[int] = mapped_column()
    unit_price: Mapped[float] = mapped_column(Numeric(12, 2))
    discount: Mapped[float] = mapped_column(Numeric(12, 2), default=0)
    subtotal: Mapped[float] = mapped_column(Numeric(12, 2))
