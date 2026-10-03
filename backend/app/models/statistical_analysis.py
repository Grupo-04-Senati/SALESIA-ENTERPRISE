"""16. statistical_analyses — historial de análisis (RF-21, RN-45, RN-49)."""

from __future__ import annotations

from datetime import datetime
from typing import TYPE_CHECKING, Any, Optional

from sqlalchemy import BigInteger, CheckConstraint, DateTime, ForeignKey, String, func
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, MappedColumn, mapped_column, relationship

from app.models.base import IDMixin, TimestampMixin
from app.core.database import Base

if TYPE_CHECKING:
    from app.models.dataset import Dataset
    from app.models.statistical_result import StatisticalResult

ANALYSIS_TYPES = ('mean', 'median', 'compare', 'variables', 'random', 'probability', 'bayes')


class StatisticalAnalysis(IDMixin, TimestampMixin, Base):
    """Cada ejecución crea un registro nuevo: nunca se sobrescribe (RF-21)."""

    __tablename__ = 'analisis_estadisticos'
    __table_args__ = (
        CheckConstraint(
            "analysis_type IN ('mean','median','compare','variables','random','probability','bayes')",
            name='ck_analyses_type',
        ),
    )

    company_id: Mapped[int] = mapped_column(BigInteger, index=True)
    dataset_id: Mapped[Optional[int]] = mapped_column(
        BigInteger, ForeignKey('conjuntos_datos.id', ondelete='SET NULL'), nullable=True, index=True
    )
    analysis_type: Mapped[str] = mapped_column(String(30), index=True)
    parameters: Mapped[dict[str, Any]] = mapped_column(JSONB, default=dict)
    status: Mapped[str] = mapped_column(String(20), default='completado')
    executed_by: Mapped[Optional[int]] = mapped_column(
        BigInteger, ForeignKey('usuarios.id', ondelete='SET NULL'), nullable=True
    )

    dataset: Mapped[Optional['Dataset']] = relationship('Dataset', lazy='selectin')
    results: Mapped[list['StatisticalResult']] = relationship(
        'StatisticalResult', cascade='all, delete-orphan', lazy='selectin'
    )
