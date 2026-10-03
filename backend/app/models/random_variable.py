"""19. random_variables — configuración de variables aleatorias (RF-15)."""

from __future__ import annotations

from datetime import datetime
from decimal import Decimal
from typing import TYPE_CHECKING, Any, Optional

from sqlalchemy import BigInteger, CheckConstraint, DateTime, ForeignKey, Numeric, String, Text, func
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, MappedColumn, mapped_column

from app.models.base import IDMixin, TimestampMixin
from app.core.database import Base

if TYPE_CHECKING:
    from app.models.user import User


class RandomVariable(IDMixin, TimestampMixin, Base):
    __tablename__ = 'random_variables'
    __table_args__ = (CheckConstraint("distribution IN ('discrete','continuous')", name='ck_rv_distribution'),)

    company_id: Mapped[int] = mapped_column(BigInteger, index=True)
    analysis_id: Mapped[Optional[int]] = mapped_column(
        BigInteger, ForeignKey('statistical_analyses.id', ondelete='CASCADE'), nullable=True, index=True
    )
    variable_name: Mapped[str] = mapped_column(String(120))
    description: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    distribution: Mapped[str] = mapped_column(String(20), default='discrete')
    values: Mapped[dict[str, Any]] = mapped_column(JSONB, default=dict)
    expected_value: Mapped[Optional[Decimal]] = mapped_column(Numeric(14, 4), nullable=True)
    variance: Mapped[Optional[Decimal]] = mapped_column(Numeric(14, 4), nullable=True)
    created_by: Mapped[Optional[int]] = mapped_column(
        BigInteger, ForeignKey('users.id', ondelete='SET NULL'), nullable=True
    )
