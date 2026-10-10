"""Reclamaciones de pedidos de la tienda (pedido no recibido o con problemas)."""

from __future__ import annotations

from datetime import datetime
from typing import TYPE_CHECKING, Optional

from sqlalchemy import BigInteger, CheckConstraint, DateTime, ForeignKey, String, Text, func
from sqlalchemy.orm import Mapped, MappedColumn, mapped_column, relationship

from app.models.base import IDMixin, TimestampMixin
from app.core.database import Base

if TYPE_CHECKING:
    from app.models.sale import Sale

CLAIM_STATUSES = ('pendiente', 'atendida')


class Claim(IDMixin, TimestampMixin, Base):
    __tablename__ = 'reclamaciones'
    __table_args__ = (
        CheckConstraint("status IN ('pendiente', 'atendida')", name='ck_reclamaciones_status'),
    )

    company_id: Mapped[int] = mapped_column(
        BigInteger, ForeignKey('empresas.id', ondelete='CASCADE'), index=True
    )
    sale_id: Mapped[int] = mapped_column(
        BigInteger, ForeignKey('ventas.id', ondelete='CASCADE'), index=True
    )
    customer_id: Mapped[Optional[int]] = mapped_column(
        BigInteger, ForeignKey('clientes.id', ondelete='SET NULL'), nullable=True, index=True
    )
    description: Mapped[str] = mapped_column(Text)
    status: Mapped[str] = mapped_column(String(20), default='pendiente', index=True)
    resolved_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)

    sale: Mapped['Sale'] = relationship('Sale', back_populates='claims')
