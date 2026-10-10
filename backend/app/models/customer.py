"""6. customers — clientes y su comportamiento comercial (RF-03, RN-01)."""

from __future__ import annotations

from typing import TYPE_CHECKING, Optional

from sqlalchemy import BigInteger, Boolean, ForeignKey, String, UniqueConstraint
from sqlalchemy.orm import Mapped, MappedColumn, mapped_column, relationship

from app.models.base import IDMixin, UpdatedAtMixin
from app.core.database import Base

if TYPE_CHECKING:
    from app.models.company import Company
    from app.models.employee import Employee


class Customer(IDMixin, UpdatedAtMixin, Base):
    __tablename__ = 'clientes'
    __table_args__ = (
        UniqueConstraint('company_id', 'document_number', name='uq_clientes_company_document'),
    )

    company_id: Mapped[int] = mapped_column(
        BigInteger, ForeignKey('empresas.id', ondelete='CASCADE'), index=True
    )
    name: Mapped[str] = mapped_column(String(150))
    document_type: Mapped[str] = mapped_column(String(10), default='DNI')
    document_number: Mapped[str] = mapped_column(String(20), index=True)
    email: Mapped[Optional[str]] = mapped_column(String(160), nullable=True)
    phone: Mapped[Optional[str]] = mapped_column(String(20), nullable=True)
    address: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    segment: Mapped[str] = mapped_column(String(30), default='Nuevo')
    seller_id: Mapped[Optional[int]] = mapped_column(
        BigInteger, ForeignKey('empleados.id', ondelete='SET NULL'), nullable=True
    )
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    password_hash: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)

    seller: Mapped[Optional['Employee']] = relationship('Employee', lazy='selectin')
    company: Mapped['Company'] = relationship('Company', lazy='selectin')
