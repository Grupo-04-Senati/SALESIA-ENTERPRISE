"""21. reports — reportes generados (RF-20)."""

from __future__ import annotations

from typing import TYPE_CHECKING, Any, Optional

from sqlalchemy import BigInteger, CheckConstraint, ForeignKey, String, Text
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, MappedColumn, mapped_column

from app.models.base import IDMixin, TimestampMixin
from app.core.database import Base

if TYPE_CHECKING:
    from app.models.user import User

REPORT_TYPES = ('ventas', 'estadistico', 'productos', 'clientes', 'vendedores')


class Report(IDMixin, TimestampMixin, Base):
    __tablename__ = 'reports'
    __table_args__ = (
        CheckConstraint(
            "report_type IN ('ventas','estadistico','productos','clientes','vendedores')",
            name='ck_reports_type',
        ),
    )

    company_id: Mapped[int] = mapped_column(BigInteger, index=True)
    report_type: Mapped[str] = mapped_column(String(30), index=True)
    title: Mapped[str] = mapped_column(String(200))
    parameters: Mapped[dict[str, Any]] = mapped_column(JSONB, default=dict)
    summary: Mapped[dict[str, Any]] = mapped_column(JSONB, default=dict)
    file_path: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    generated_by: Mapped[Optional[int]] = mapped_column(
        BigInteger, ForeignKey('users.id', ondelete='SET NULL'), nullable=True
    )
