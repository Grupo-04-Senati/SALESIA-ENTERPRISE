"""15. observations — filas/observaciones del dataset (jsonb)."""

from __future__ import annotations

from datetime import datetime
from typing import TYPE_CHECKING, Any

from sqlalchemy import BigInteger, DateTime, ForeignKey, Index, func
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, MappedColumn, mapped_column, relationship

from app.models.base import IDMixin
from app.core.database import Base

if TYPE_CHECKING:
    from app.models.dataset import Dataset


class Observation(IDMixin, Base):
    __tablename__ = 'observaciones'
    __table_args__ = (Index('ix_observaciones_data_gin', 'data', postgresql_using='gin'),)

    dataset_id: Mapped[int] = mapped_column(
        BigInteger, ForeignKey('conjuntos_datos.id', ondelete='CASCADE'), index=True
    )
    data: Mapped[dict[str, Any]] = mapped_column(JSONB, default=dict)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), default=func.now()
    )

    dataset: Mapped['Dataset'] = relationship('Dataset', back_populates='observations')
