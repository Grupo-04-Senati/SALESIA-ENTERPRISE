"""12. inventory_movements — kardex de entradas y salidas (RF-08, RN-21…RN-23)."""

from __future__ import annotations

from datetime import datetime
from typing import TYPE_CHECKING, Optional

from sqlalchemy import BigInteger, CheckConstraint, DateTime, ForeignKey, Integer, String, func
from sqlalchemy.orm import Mapped, MappedColumn, mapped_column, relationship

from app.models.base import IDMixin, TimestampMixin
from app.core.database import Base

if TYPE_CHECKING:
    from app.models.product import Product
    from app.models.user import User

MOVEMENT_TYPES = ('in', 'out', 'return', 'shrinkage', 'adjustment')


class InventoryMovement(IDMixin, TimestampMixin, Base):
    __tablename__ = 'inventory_movements'
    __table_args__ = (
        CheckConstraint('quantity > 0', name='ck_movements_quantity_positive'),
        CheckConstraint(
            "movement_type IN ('in','out','return','shrinkage','adjustment')",
            name='ck_movements_type',
        ),
    )

    product_id: Mapped[int] = mapped_column(
        BigInteger, ForeignKey('products.id', ondelete='CASCADE'), index=True
    )
    movement_type: Mapped[str] = mapped_column(String(15))
    quantity: Mapped[int] = mapped_column(Integer)
    reason: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    resulting_stock: Mapped[int] = mapped_column(Integer, default=0)
    reference_id: Mapped[Optional[int]] = mapped_column(BigInteger, nullable=True)
    created_by: Mapped[Optional[int]] = mapped_column(
        BigInteger, ForeignKey('users.id', ondelete='SET NULL'), nullable=True
    )

    product: Mapped['Product'] = relationship('Product', lazy='selectin')
    created_by_user: Mapped[Optional['User']] = relationship('User', lazy='selectin')
