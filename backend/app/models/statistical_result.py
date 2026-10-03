"""17. statistical_results — resultados calculados (media, mediana, comparación)."""

from __future__ import annotations

from datetime import datetime
from decimal import Decimal
from typing import TYPE_CHECKING, Any

from sqlalchemy import BigInteger, DateTime, ForeignKey, Numeric, String, func
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, MappedColumn, mapped_column, relationship

from app.models.base import IDMixin
from app.core.database import Base

if TYPE_CHECKING:
    from app.models.statistical_analysis import StatisticalAnalysis


class StatisticalResult(IDMixin, Base):
    __tablename__ = 'resultados_estadisticos'

    analysis_id: Mapped[int] = mapped_column(
        BigInteger, ForeignKey('analisis_estadisticos.id', ondelete='CASCADE'), index=True
    )
    metric: Mapped[str] = mapped_column(String(40))
    value: Mapped[Decimal] = mapped_column(Numeric(14, 4))
    summary: Mapped[dict[str, Any]] = mapped_column(JSONB, default=dict)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), default=func.now()
    )

    analysis: Mapped['StatisticalAnalysis'] = relationship('StatisticalAnalysis', back_populates='results')
