"""Extensión docs/04 §2.4 — órdenes de compra a proveedores."""

from __future__ import annotations

from typing import Optional

from sqlalchemy import (
    BigInteger,
    DateTime,
    ForeignKey,
    Numeric,
    String,
    Text,
    UniqueConstraint,
    func,
)
from sqlalchemy.orm import Mapped, MappedColumn, mapped_column

from app.core.database import Base
from app.models.base import IDMixin, TimestampMixin


class PurchaseOrder(IDMixin, TimestampMixin, Base):
    __tablename__ = 'ordenes_compra'
    __table_args__ = (
        UniqueConstraint('company_id', 'order_number', name='uq_ordenes_compra_company_number'),
    )

    company_id: Mapped[int] = mapped_column(
        BigInteger, ForeignKey('empresas.id', ondelete='CASCADE'), index=True
    )
    supplier_id: Mapped[int] = mapped_column(
        BigInteger, ForeignKey('proveedores.id', ondelete='RESTRICT'), index=True
    )
    order_number: Mapped[str] = mapped_column(String(30))
    status: Mapped[str] = mapped_column(String(20), default='pending')
    total: Mapped[float] = mapped_column(Numeric(12, 2), default=0)
    notes: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    created_by: Mapped[Optional[int]] = mapped_column(
        BigInteger, ForeignKey('usuarios.id', ondelete='SET NULL'), nullable=True
    )


class PurchaseOrderDetail(IDMixin, TimestampMixin, Base):
    __tablename__ = 'detalle_ordenes_compra'

    purchase_order_id: Mapped[int] = mapped_column(
        BigInteger, ForeignKey('ordenes_compra.id', ondelete='CASCADE'), index=True
    )
    product_id: Mapped[int] = mapped_column(
        BigInteger, ForeignKey('productos.id', ondelete='RESTRICT'), index=True
    )
    quantity: Mapped[int] = mapped_column()
    unit_cost: Mapped[float] = mapped_column(Numeric(12, 2))
    subtotal: Mapped[float] = mapped_column(Numeric(12, 2))
