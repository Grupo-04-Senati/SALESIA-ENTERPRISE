"""7. products — catálogo de productos (RF-04, RN-03…RN-06)."""

from __future__ import annotations

from decimal import Decimal
from typing import TYPE_CHECKING, Optional

from sqlalchemy import BigInteger, Boolean, ForeignKey, Integer, Numeric, String, Text, UniqueConstraint
from sqlalchemy.orm import Mapped, MappedColumn, mapped_column, relationship

from app.models.base import IDMixin, UpdatedAtMixin
from app.core.database import Base

if TYPE_CHECKING:
    from app.models.category import Category
    from app.models.company import Company


class Product(IDMixin, UpdatedAtMixin, Base):
    __tablename__ = 'productos'
    __table_args__ = (UniqueConstraint('company_id', 'sku', name='uq_productos_company_sku'),)

    company_id: Mapped[int] = mapped_column(
        BigInteger, ForeignKey('empresas.id', ondelete='CASCADE'), index=True
    )
    category_id: Mapped[Optional[int]] = mapped_column(
        BigInteger, ForeignKey('categorias.id', ondelete='SET NULL'), nullable=True, index=True
    )
    sku: Mapped[str] = mapped_column(String(50), index=True)
    name: Mapped[str] = mapped_column(String(150))
    description: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    price: Mapped[Decimal] = mapped_column(Numeric(12, 2), default=Decimal('0.00'))
    cost_price: Mapped[Decimal] = mapped_column(Numeric(12, 2), default=Decimal('0.00'))
    wholesale_price: Mapped[Optional[Decimal]] = mapped_column(Numeric(12, 2), nullable=True)
    brand: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)
    image_url: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    unit: Mapped[str] = mapped_column(String(20), default='UND')
    min_stock: Mapped[int] = mapped_column(Integer, default=0)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    is_featured: Mapped[bool] = mapped_column(Boolean, default=False)

    category: Mapped[Optional['Category']] = relationship('Category', lazy='joined')
    company: Mapped['Company'] = relationship('Company', lazy='selectin')
