"""8. sales — cabecera de venta (RF-06, RN-11…RN-19)."""

from __future__ import annotations

from datetime import datetime
from decimal import Decimal
from typing import TYPE_CHECKING, List, Optional

from sqlalchemy import BigInteger, DateTime, ForeignKey, Numeric, String, Text, func
from sqlalchemy.orm import Mapped, MappedColumn, mapped_column, relationship

from app.models.base import IDMixin, UpdatedAtMixin
from app.core.database import Base

if TYPE_CHECKING:
    from app.models.customer import Customer
    from app.models.employee import Employee
    from app.models.payment import Payment
    from app.models.sale_detail import SaleDetail

SALE_STATUSES = ('pending', 'partial', 'paid', 'cancelled')


class Sale(IDMixin, UpdatedAtMixin, Base):
    __tablename__ = 'ventas'

    company_id: Mapped[int] = mapped_column(
        BigInteger, ForeignKey('empresas.id', ondelete='CASCADE'), index=True
    )
    customer_id: Mapped[Optional[int]] = mapped_column(
        BigInteger, ForeignKey('clientes.id', ondelete='SET NULL'), nullable=True, index=True
    )
    seller_id: Mapped[Optional[int]] = mapped_column(
        BigInteger, ForeignKey('empleados.id', ondelete='SET NULL'), nullable=True, index=True
    )
    sale_number: Mapped[str] = mapped_column(String(30), unique=True, index=True)
    sold_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), default=func.now(), index=True
    )
    subtotal: Mapped[Decimal] = mapped_column(Numeric(12, 2), default=Decimal('0.00'))
    discount: Mapped[Decimal] = mapped_column(Numeric(12, 2), default=Decimal('0.00'))
    tax: Mapped[Decimal] = mapped_column(Numeric(12, 2), default=Decimal('0.00'))
    total: Mapped[Decimal] = mapped_column(Numeric(12, 2), default=Decimal('0.00'))
    status: Mapped[str] = mapped_column(String(20), default='pending', index=True)
    notes: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    cancelled_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    cancel_reason: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    received_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)

    customer: Mapped[Optional['Customer']] = relationship('Customer', lazy='joined')
    seller: Mapped[Optional['Employee']] = relationship('Employee', lazy='joined')
    items: Mapped[List['SaleDetail']] = relationship(
        'SaleDetail', cascade='all, delete-orphan', lazy='selectin', order_by='SaleDetail.id'
    )
    payments: Mapped[List['Payment']] = relationship(
        'Payment', cascade='all, delete-orphan', lazy='selectin', order_by='Payment.id'
    )
