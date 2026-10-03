"""Extensión docs/04 §2.4 — almacenes, stock por almacén, conteos y envíos."""

from __future__ import annotations

from datetime import datetime
from typing import Optional

from sqlalchemy import (
    BigInteger,
    DateTime,
    ForeignKey,
    String,
    Text,
    UniqueConstraint,
    func,
)
from sqlalchemy.orm import Mapped, MappedColumn, mapped_column

from app.core.database import Base
from app.models.base import IDMixin, TimestampMixin, UpdatedAtMixin


class Warehouse(IDMixin, UpdatedAtMixin, Base):
    __tablename__ = 'almacenes'
    __table_args__ = (UniqueConstraint('company_id', 'code', name='uq_almacenes_company_code'),)

    company_id: Mapped[int] = mapped_column(
        BigInteger, ForeignKey('empresas.id', ondelete='CASCADE'), index=True
    )
    code: Mapped[str] = mapped_column(String(20))
    name: Mapped[str] = mapped_column(String(120))
    address: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    is_active: Mapped[bool] = mapped_column(default=True)


class WarehouseStock(IDMixin, UpdatedAtMixin, Base):
    __tablename__ = 'stock_almacenes'
    __table_args__ = (
        UniqueConstraint('warehouse_id', 'product_id', name='uq_stock_almacenes_wh_product'),
    )

    warehouse_id: Mapped[int] = mapped_column(
        BigInteger, ForeignKey('almacenes.id', ondelete='CASCADE'), index=True
    )
    product_id: Mapped[int] = mapped_column(
        BigInteger, ForeignKey('productos.id', ondelete='CASCADE'), index=True
    )
    stock: Mapped[int] = mapped_column(default=0)
    min_stock: Mapped[int] = mapped_column(default=0)


class StockCount(IDMixin, TimestampMixin, Base):
    __tablename__ = 'conteos_stock'
    __table_args__ = (
        UniqueConstraint('company_id', 'count_number', name='uq_conteos_stock_company_number'),
    )

    company_id: Mapped[int] = mapped_column(
        BigInteger, ForeignKey('empresas.id', ondelete='CASCADE'), index=True
    )
    warehouse_id: Mapped[int] = mapped_column(
        BigInteger, ForeignKey('almacenes.id', ondelete='RESTRICT'), index=True
    )
    count_number: Mapped[str] = mapped_column(String(30))
    status: Mapped[str] = mapped_column(String(20), default='draft')
    notes: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    counted_by: Mapped[Optional[int]] = mapped_column(
        BigInteger, ForeignKey('usuarios.id', ondelete='SET NULL'), nullable=True
    )


class StockCountDetail(IDMixin, TimestampMixin, Base):
    __tablename__ = 'detalle_conteos'

    stock_count_id: Mapped[int] = mapped_column(
        BigInteger, ForeignKey('conteos_stock.id', ondelete='CASCADE'), index=True
    )
    product_id: Mapped[int] = mapped_column(
        BigInteger, ForeignKey('productos.id', ondelete='RESTRICT'), index=True
    )
    expected_qty: Mapped[int] = mapped_column(default=0)
    counted_qty: Mapped[int] = mapped_column(default=0)
    difference: Mapped[int] = mapped_column(default=0)


class Shipment(IDMixin, TimestampMixin, Base):
    __tablename__ = 'envios'
    __table_args__ = (UniqueConstraint('company_id', 'tracking_code', name='uq_envios_company_tracking'),)

    company_id: Mapped[int] = mapped_column(
        BigInteger, ForeignKey('empresas.id', ondelete='CASCADE'), index=True
    )
    sale_id: Mapped[int] = mapped_column(
        BigInteger, ForeignKey('ventas.id', ondelete='RESTRICT'), index=True
    )
    carrier: Mapped[Optional[str]] = mapped_column(String(80), nullable=True)
    tracking_code: Mapped[Optional[str]] = mapped_column(String(60), nullable=True)
    status: Mapped[str] = mapped_column(String(20), default='pending')
    shipped_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
