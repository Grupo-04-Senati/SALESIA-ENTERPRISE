"""9. sale_details — líneas de venta (RN-13)."""

from __future__ import annotations

from datetime import datetime
from decimal import Decimal
from typing import TYPE_CHECKING

from sqlalchemy import BigInteger, CheckConstraint, DateTime, ForeignKey, Integer, Numeric, func
from sqlalchemy.orm import Mapped, MappedColumn, mapped_column, relationship

from app.models.base import IDMixin
from app.core.database import Base

if TYPE_CHECKING:
    from app.models.product import Product
    from app.models.sale import Sale


class SaleDetail(IDMixin, Base):
    __tablename__ = 'detalle_ventas'
    __table_args__ = (
        CheckConstraint('quantity > 0', name='ck_sale_details_quantity_positive'),
        CheckConstraint('subtotal >= 0', name='ck_sale_details_subtotal_positive'),
    )

    sale_id: Mapped[int] = mapped_column(
        BigInteger, ForeignKey('ventas.id', ondelete='CASCADE'), index=True
    )
    product_id: Mapped[int] = mapped_column(BigInteger, ForeignKey('productos.id'), index=True)
    quantity: Mapped[int] = mapped_column(Integer)
    unit_price: Mapped[Decimal] = mapped_column(Numeric(12, 2))
    discount: Mapped[Decimal] = mapped_column(Numeric(12, 2), default=Decimal('0.00'))
    subtotal: Mapped[Decimal] = mapped_column(Numeric(12, 2))
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), default=func.now()
    )

    sale: Mapped['Sale'] = relationship('Sale', back_populates='items')
    product: Mapped['Product'] = relationship('Product', lazy='joined')
