"""14. dataset_variables — variables estadísticas declaradas (RF-14, RN-46)."""

from __future__ import annotations

from datetime import datetime
from typing import TYPE_CHECKING, Optional

from sqlalchemy import BigInteger, Boolean, CheckConstraint, DateTime, ForeignKey, String, Text, UniqueConstraint, func
from sqlalchemy.orm import Mapped, MappedColumn, mapped_column, relationship

from app.models.base import IDMixin
from app.core.database import Base

if TYPE_CHECKING:
    from app.models.dataset import Dataset


class DatasetVariable(IDMixin, Base):
    __tablename__ = 'dataset_variables'
    __table_args__ = (
        UniqueConstraint('dataset_id', 'name', name='uq_dataset_variables_dataset_name'),
        CheckConstraint("stat_type IN ('qualitative','quantitative')", name='ck_variables_stat_type'),
        CheckConstraint(
            "scale IN ('nominal','ordinal','discrete','continuous')", name='ck_variables_scale'
        ),
    )

    dataset_id: Mapped[int] = mapped_column(
        BigInteger, ForeignKey('datasets.id', ondelete='CASCADE'), index=True
    )
    name: Mapped[str] = mapped_column(String(100))
    label: Mapped[Optional[str]] = mapped_column(String(150), nullable=True)
    stat_type: Mapped[str] = mapped_column(String(20))
    scale: Mapped[str] = mapped_column(String(20))
    unit: Mapped[Optional[str]] = mapped_column(String(30), nullable=True)
    is_random_variable: Mapped[bool] = mapped_column(Boolean, default=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), default=func.now()
    )

    dataset: Mapped['Dataset'] = relationship('Dataset', back_populates='variables')
