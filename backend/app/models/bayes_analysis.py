"""18. bayes_analyses — resultados del Teorema de Bayes (RF-17, RN-43)."""

from __future__ import annotations

from datetime import datetime
from decimal import Decimal
from typing import TYPE_CHECKING, Optional

from sqlalchemy import BigInteger, CheckConstraint, DateTime, ForeignKey, Numeric, String, Text, func
from sqlalchemy.orm import Mapped, MappedColumn, mapped_column

from app.models.base import IDMixin, TimestampMixin
from app.core.database import Base

if TYPE_CHECKING:
    from app.models.user import User


class BayesAnalysis(IDMixin, TimestampMixin, Base):
    __tablename__ = 'bayes_analyses'
    __table_args__ = (
        CheckConstraint('p_a >= 0 AND p_a <= 1', name='ck_bayes_p_a'),
        CheckConstraint('p_b_given_a >= 0 AND p_b_given_a <= 1', name='ck_bayes_p_b_given_a'),
        CheckConstraint('p_b > 0 AND p_b <= 1', name='ck_bayes_p_b'),
        CheckConstraint('p_a_given_b >= 0 AND p_a_given_b <= 1', name='ck_bayes_p_a_given_b'),
    )

    company_id: Mapped[int] = mapped_column(BigInteger, index=True)
    label: Mapped[str] = mapped_column(String(200))
    p_a: Mapped[Decimal] = mapped_column(Numeric(10, 6))
    p_b_given_a: Mapped[Decimal] = mapped_column(Numeric(10, 6))
    p_b: Mapped[Decimal] = mapped_column(Numeric(10, 6))
    p_a_given_b: Mapped[Decimal] = mapped_column(Numeric(10, 6))
    explanation: Mapped[str] = mapped_column(Text)
    created_by: Mapped[Optional[int]] = mapped_column(
        BigInteger, ForeignKey('users.id', ondelete='SET NULL'), nullable=True
    )
