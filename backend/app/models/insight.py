"""20. insights — conclusiones determinísticas con evidencia (RF-19, RN-47, RN-48)."""

from __future__ import annotations

from datetime import datetime
from typing import TYPE_CHECKING, Any, Optional

from sqlalchemy import BigInteger, Boolean, CheckConstraint, DateTime, ForeignKey, String, Text, func
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, MappedColumn, mapped_column

from app.models.base import IDMixin, TimestampMixin
from app.core.database import Base

if TYPE_CHECKING:
    from app.models.user import User

SEVERITIES = ('info', 'success', 'warning', 'critical')


class Insight(IDMixin, TimestampMixin, Base):
    __tablename__ = 'insights'
    __table_args__ = (
        CheckConstraint("severity IN ('info','success','warning','critical')", name='ck_insights_severity'),
    )

    company_id: Mapped[int] = mapped_column(BigInteger, index=True)
    analysis_id: Mapped[Optional[int]] = mapped_column(
        BigInteger, ForeignKey('statistical_analyses.id', ondelete='SET NULL'), nullable=True, index=True
    )
    dataset_id: Mapped[Optional[int]] = mapped_column(
        BigInteger, ForeignKey('datasets.id', ondelete='SET NULL'), nullable=True
    )
    rule_code: Mapped[str] = mapped_column(String(50), index=True)
    severity: Mapped[str] = mapped_column(String(20), default='info', index=True)
    title: Mapped[str] = mapped_column(String(200))
    message: Mapped[str] = mapped_column(Text)
    evidence: Mapped[dict[str, Any]] = mapped_column(JSONB, default=dict)
    is_read: Mapped[bool] = mapped_column(Boolean, default=False)
