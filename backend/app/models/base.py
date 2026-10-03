"""Modelos SQLAlchemy — 54 entidades (docs/04_modelo_er.md)."""

from __future__ import annotations

from datetime import datetime, timezone
from sqlalchemy import BigInteger, DateTime, func
from sqlalchemy.orm import Mapped, MappedColumn, mapped_column

from app.core.database import Base


def utcnow() -> datetime:
    return datetime.now(timezone.utc)


class IDMixin:
    """PK serial/bigint (docs/04 §6) — coincide con `id: number` del frontend."""

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True, autoincrement=True)


class TimestampMixin:
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), default=utcnow
    )


class UpdatedAtMixin(TimestampMixin):
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), default=utcnow, onupdate=utcnow
    )


__all__ = ['Base', 'IDMixin', 'TimestampMixin', 'UpdatedAtMixin', 'utcnow']
