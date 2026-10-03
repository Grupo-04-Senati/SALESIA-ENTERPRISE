"""Extensión docs/04 §2.4 — instantáneas de KPI, reportes programados,
exportaciones y reglas de automatización (RF-08 / RN de alertas)."""

from __future__ import annotations

from datetime import date, datetime
from typing import Optional

from sqlalchemy import (
    JSON,
    BigInteger,
    Date,
    DateTime,
    ForeignKey,
    Numeric,
    String,
    Text,
    UniqueConstraint,
)
from sqlalchemy.orm import Mapped, MappedColumn, mapped_column

from app.core.database import Base
from app.models.base import IDMixin, TimestampMixin


class KpiSnapshot(IDMixin, TimestampMixin, Base):
    __tablename__ = 'instantaneas_kpi'

    company_id: Mapped[int] = mapped_column(
        BigInteger, ForeignKey('empresas.id', ondelete='CASCADE'), index=True
    )
    kpi_code: Mapped[str] = mapped_column(String(40), index=True)
    period_start: Mapped[date] = mapped_column(Date)
    period_end: Mapped[date] = mapped_column(Date)
    value: Mapped[float] = mapped_column(Numeric(14, 4))
    payload: Mapped[Optional[dict]] = mapped_column(JSON, nullable=True)


class ScheduledReport(IDMixin, TimestampMixin, Base):
    __tablename__ = 'reportes_programados'

    company_id: Mapped[int] = mapped_column(
        BigInteger, ForeignKey('empresas.id', ondelete='CASCADE'), index=True
    )
    report_type: Mapped[str] = mapped_column(String(40))
    title: Mapped[str] = mapped_column(String(150))
    parameters: Mapped[Optional[dict]] = mapped_column(JSON, nullable=True)
    frequency: Mapped[str] = mapped_column(String(10), default='monthly')
    next_run_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    is_active: Mapped[bool] = mapped_column(default=True)
    created_by: Mapped[Optional[int]] = mapped_column(
        BigInteger, ForeignKey('usuarios.id', ondelete='SET NULL'), nullable=True
    )


class DataExport(IDMixin, TimestampMixin, Base):
    __tablename__ = 'exportaciones_datos'

    company_id: Mapped[int] = mapped_column(
        BigInteger, ForeignKey('empresas.id', ondelete='CASCADE'), index=True
    )
    export_type: Mapped[str] = mapped_column(String(40))
    format: Mapped[str] = mapped_column(String(10), default='csv')
    status: Mapped[str] = mapped_column(String(15), default='pending')
    row_count: Mapped[Optional[int]] = mapped_column(nullable=True)
    requested_by: Mapped[Optional[int]] = mapped_column(
        BigInteger, ForeignKey('usuarios.id', ondelete='SET NULL'), nullable=True
    )


class AutomationRule(IDMixin, TimestampMixin, Base):
    __tablename__ = 'reglas_automatizacion'
    __table_args__ = (
        UniqueConstraint('company_id', 'code', name='uq_reglas_automatizacion_company_code'),
    )

    company_id: Mapped[int] = mapped_column(
        BigInteger, ForeignKey('empresas.id', ondelete='CASCADE'), index=True
    )
    code: Mapped[str] = mapped_column(String(50))
    name: Mapped[str] = mapped_column(String(150))
    description: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    condition: Mapped[Optional[dict]] = mapped_column(JSON, nullable=True)
    action: Mapped[Optional[dict]] = mapped_column(JSON, nullable=True)
    severity: Mapped[str] = mapped_column(String(10), default='info')
    is_active: Mapped[bool] = mapped_column(default=True)
