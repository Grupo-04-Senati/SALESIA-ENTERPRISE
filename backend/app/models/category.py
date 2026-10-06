"""5. categories — categorías de productos (RN-06)."""

from __future__ import annotations

from typing import Optional

from sqlalchemy import BigInteger, Boolean, ForeignKey, String, Text, UniqueConstraint
from sqlalchemy.orm import Mapped, MappedColumn, mapped_column

from app.models.base import IDMixin, UpdatedAtMixin
from app.core.database import Base


class Category(IDMixin, UpdatedAtMixin, Base):
    __tablename__ = 'categorias'
    __table_args__ = (UniqueConstraint('company_id', 'name', name='uq_categorias_company_name'),)

    company_id: Mapped[int] = mapped_column(
        BigInteger, ForeignKey('empresas.id', ondelete='CASCADE'), index=True
    )
    name: Mapped[str] = mapped_column(String(100))
    description: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    image_url: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
