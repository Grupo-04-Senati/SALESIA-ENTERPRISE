"""10. payments — pagos de una venta (RF-07, RN-16, RN-17)."""

from __future__ import annotations

from datetime import datetime
from decimal import Decimal
from typing import TYPE_CHECKING, Optional

from sqlalchemy import BigInteger, CheckConstraint, DateTime, ForeignKey, Numeric, String, func
from sqlalchemy.orm import Mapped, MappedColumn, mapped_column, relationship

from app.models.base import IDMixin, TimestampMixin
from app.core.database import Base

if TYPE_CHECKING:
    from app.models.sale import Sale

PAYMENT_METHODS = ('cash', 'card', 'transfer', 'yape', 'plin')


class Payment(IDMixin, TimestampMixin, Base):
    __tablename__ = 'pagos'
    __table_args__ = (
        CheckConstraint('amount > 0', name='ck_payments_amount_positive'),
    )

    sale_id: Mapped[int] = mapped_column(BigInteger, ForeignKey('ventas.id', ondelete='CASCADE'), index=True)
    method: Mapped[str] = mapped_column(String(20))
    amount: Mapped[Decimal] = mapped_column(Numeric(12, 2))
    paid_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), default=func.now()
    )
    reference: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)

    sale: Mapped['Sale'] = relationship('Sale', back_populates='payments')
