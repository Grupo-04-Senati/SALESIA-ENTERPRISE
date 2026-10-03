"""11. inventory — existencias actuales por producto (RN-20, RN-23)."""

from __future__ import annotations

from datetime import datetime
from typing import TYPE_CHECKING

from sqlalchemy import BigInteger, CheckConstraint, DateTime, ForeignKey, Integer, String, func
from sqlalchemy.orm import Mapped, MappedColumn, mapped_column, relationship

from app.models.base import IDMixin
from app.core.database import Base

if TYPE_CHECKING:
    from app.models.product import Product


class Inventory(IDMixin, Base):
    __tablename__ = 'inventory'
    __table_args__ = (CheckConstraint('stock >= 0', name='ck_inventory_stock_non_negative'),)

    product_id: Mapped[int] = mapped_column(
        BigInteger, ForeignKey('products.id', ondelete='CASCADE'), unique=True, index=True
    )
    stock: Mapped[int] = mapped_column(Integer, default=0)
    min_stock: Mapped[int] = mapped_column(Integer, default=0)
    max_stock: Mapped[int] = mapped_column(Integer, default=0)
    location: Mapped[str | None] = mapped_column(String(80), nullable=True)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), default=func.now(), onupdate=func.now()
    )

    product: Mapped['Product'] = relationship('Product', lazy='joined')
