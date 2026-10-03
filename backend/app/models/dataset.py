"""13. datasets — conjuntos de datos derivados de la operación (RF-10)."""

from __future__ import annotations

from datetime import datetime
from typing import TYPE_CHECKING, Any, Optional

from sqlalchemy import BigInteger, DateTime, ForeignKey, Integer, String, Text, func
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, MappedColumn, mapped_column, relationship

from app.models.base import IDMixin, TimestampMixin
from app.core.database import Base

if TYPE_CHECKING:
    from app.models.dataset_variable import DatasetVariable
    from app.models.observation import Observation


class Dataset(IDMixin, TimestampMixin, Base):
    __tablename__ = 'datasets'

    company_id: Mapped[int] = mapped_column(
        BigInteger, ForeignKey('companies.id', ondelete='CASCADE'), index=True
    )
    name: Mapped[str] = mapped_column(String(150))
    description: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    source: Mapped[str] = mapped_column(String(50), default='sales')
    filters: Mapped[dict[str, Any]] = mapped_column(JSONB, default=dict)
    row_count: Mapped[int] = mapped_column(Integer, default=0)
    created_by: Mapped[Optional[int]] = mapped_column(
        BigInteger, ForeignKey('users.id', ondelete='SET NULL'), nullable=True
    )

    variables: Mapped[list['DatasetVariable']] = relationship(
        'DatasetVariable', cascade='all, delete-orphan', lazy='selectin'
    )
    observations: Mapped[list['Observation']] = relationship(
        'Observation', cascade='all, delete-orphan', lazy='selectin'
    )
