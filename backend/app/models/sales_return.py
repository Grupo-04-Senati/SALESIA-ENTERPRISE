"""Extensión docs/04 §2.4 — devoluciones de ventas."""

from __future__ import annotations

from sqlalchemy import BigInteger, ForeignKey, Numeric, String, Text, UniqueConstraint
from sqlalchemy.orm import Mapped, MappedColumn, mapped_column

from app.core.database import Base
from app.models.base import IDMixin, TimestampMixin


class SalesReturn(IDMixin, TimestampMixin, Base):
    __tablename__ = 'devoluciones'
    __table_args__ = (
        UniqueConstraint('company_id', 'return_number', name='uq_devoluciones_company_number'),
    )

    company_id: Mapped[int] = mapped_column(
        BigInteger, ForeignKey('empresas.id', ondelete='CASCADE'), index=True
    )
    sale_id: Mapped[int] = mapped_column(
        BigInteger, ForeignKey('ventas.id', ondelete='RESTRICT'), index=True
    )
    return_number: Mapped[str] = mapped_column(String(30))
    reason: Mapped[str] = mapped_column(Text)
    status: Mapped[str] = mapped_column(String(20), default='pending')
    total: Mapped[float] = mapped_column(Numeric(12, 2), default=0)
    created_by: Mapped[int | None] = mapped_column(
        BigInteger, ForeignKey('usuarios.id', ondelete='SET NULL'), nullable=True
    )


class SalesReturnDetail(IDMixin, TimestampMixin, Base):
    __tablename__ = 'detalle_devoluciones'

    return_id: Mapped[int] = mapped_column(
        BigInteger, ForeignKey('devoluciones.id', ondelete='CASCADE'), index=True
    )
    product_id: Mapped[int] = mapped_column(
        BigInteger, ForeignKey('productos.id', ondelete='RESTRICT'), index=True
    )
    quantity: Mapped[int] = mapped_column()
    unit_price: Mapped[float] = mapped_column(Numeric(12, 2))
    subtotal: Mapped[float] = mapped_column(Numeric(12, 2))
