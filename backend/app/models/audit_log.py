"""22. audit_logs — bitácora de acciones críticas (RF-22, RN-34, RNF-07)."""

from __future__ import annotations

from datetime import datetime
from typing import TYPE_CHECKING, Any, Optional

from sqlalchemy import BigInteger, DateTime, ForeignKey, Index, String, func
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, MappedColumn, mapped_column

from app.models.base import IDMixin, TimestampMixin
from app.core.database import Base

if TYPE_CHECKING:
    from app.models.company import Company
    from app.models.user import User


class AuditLog(IDMixin, TimestampMixin, Base):
    __tablename__ = 'audit_logs'
    __table_args__ = (Index('ix_audit_logs_company_created', 'company_id', 'created_at'),)

    company_id: Mapped[Optional[int]] = mapped_column(
        BigInteger, ForeignKey('companies.id', ondelete='CASCADE'), nullable=True, index=True
    )
    user_id: Mapped[Optional[int]] = mapped_column(
        BigInteger, ForeignKey('users.id', ondelete='SET NULL'), nullable=True, index=True
    )
    action: Mapped[str] = mapped_column(String(100), index=True)
    entity: Mapped[Optional[str]] = mapped_column(String(60), nullable=True)
    entity_id: Mapped[Optional[int]] = mapped_column(BigInteger, nullable=True)
    detail: Mapped[dict[str, Any]] = mapped_column(JSONB, default=dict)
    ip_address: Mapped[Optional[str]] = mapped_column(String(45), nullable=True)
