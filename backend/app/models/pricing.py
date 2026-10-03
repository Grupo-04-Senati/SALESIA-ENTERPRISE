"""Extensión docs/04 §2.4 — unidades, listas de precios y promociones."""

from __future__ import annotations

from datetime import datetime
from typing import Optional

from sqlalchemy import (
    BigInteger,
    Boolean,
    DateTime,
    ForeignKey,
    Numeric,
    String,
    UniqueConstraint,
    func,
)
from sqlalchemy.orm import Mapped, MappedColumn, mapped_column

from app.core.database import Base
from app.models.base import IDMixin, TimestampMixin, UpdatedAtMixin


class Unit(IDMixin, UpdatedAtMixin, Base):
    __tablename__ = 'unidades'
    __table_args__ = (UniqueConstraint('company_id', 'name', name='uq_unidades_company_name'),)

    company_id: Mapped[int] = mapped_column(
        BigInteger, ForeignKey('empresas.id', ondelete='CASCADE'), index=True
    )
    name: Mapped[str] = mapped_column(String(30))
    symbol: Mapped[Optional[str]] = mapped_column(String(10), nullable=True)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)


class PriceList(IDMixin, TimestampMixin, Base):
    __tablename__ = 'listas_precios'

    company_id: Mapped[int] = mapped_column(
        BigInteger, ForeignKey('empresas.id', ondelete='CASCADE'), index=True
    )
    name: Mapped[str] = mapped_column(String(120))
    currency: Mapped[str] = mapped_column(String(3), default='PEN')
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)


class PriceListItem(IDMixin, UpdatedAtMixin, Base):
    __tablename__ = 'detalle_listas_precios'
    __table_args__ = (
        UniqueConstraint('price_list_id', 'product_id', name='uq_detalle_listas_precios_list_product'),
    )

    price_list_id: Mapped[int] = mapped_column(
        BigInteger, ForeignKey('listas_precios.id', ondelete='CASCADE'), index=True
    )
    product_id: Mapped[int] = mapped_column(
        BigInteger, ForeignKey('productos.id', ondelete='CASCADE'), index=True
    )
    price: Mapped[float] = mapped_column(Numeric(12, 2))


class Promotion(IDMixin, TimestampMixin, Base):
    __tablename__ = 'promociones'

    company_id: Mapped[int] = mapped_column(
        BigInteger, ForeignKey('empresas.id', ondelete='CASCADE'), index=True
    )
    name: Mapped[str] = mapped_column(String(120))
    kind: Mapped[str] = mapped_column(String(10), default='percent')
    value: Mapped[float] = mapped_column(Numeric(12, 2))
    starts_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    ends_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)


class ProductPromotion(IDMixin, UpdatedAtMixin, Base):
    __tablename__ = 'productos_promociones'
    __table_args__ = (
        UniqueConstraint('promotion_id', 'product_id', name='uq_productos_promociones_promo_product'),
    )

    promotion_id: Mapped[int] = mapped_column(
        BigInteger, ForeignKey('promociones.id', ondelete='CASCADE'), index=True
    )
    product_id: Mapped[int] = mapped_column(
        BigInteger, ForeignKey('productos.id', ondelete='CASCADE'), index=True
    )
