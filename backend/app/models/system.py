"""Extensión docs/04 §2.4 — notificaciones, ajustes y eventos del sistema."""

from __future__ import annotations

from datetime import datetime
from typing import Optional

from sqlalchemy import JSON, BigInteger, DateTime, ForeignKey, String, Text, UniqueConstraint, func
from sqlalchemy.orm import Mapped, MappedColumn, mapped_column

from app.core.database import Base
from app.models.base import IDMixin, TimestampMixin, UpdatedAtMixin, utcnow


class Notification(IDMixin, TimestampMixin, Base):
    __tablename__ = 'notificaciones'

    company_id: Mapped[int] = mapped_column(
        BigInteger, ForeignKey('empresas.id', ondelete='CASCADE'), index=True
    )
    user_id: Mapped[Optional[int]] = mapped_column(
        BigInteger, ForeignKey('usuarios.id', ondelete='CASCADE'), nullable=True, index=True
    )
    level: Mapped[str] = mapped_column(String(10), default='info')
    title: Mapped[str] = mapped_column(String(150))
    message: Mapped[str] = mapped_column(Text)
    read_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    # Origen del cambio (notificaciones automáticas de módulos).
    module: Mapped[Optional[str]] = mapped_column(String(60), nullable=True, index=True)
    entity: Mapped[Optional[str]] = mapped_column(String(60), nullable=True)
    entity_id: Mapped[Optional[int]] = mapped_column(BigInteger, nullable=True)
    link: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    target_role: Mapped[Optional[str]] = mapped_column(String(30), nullable=True, index=True)
    group_id: Mapped[Optional[str]] = mapped_column(String(36), nullable=True, index=True)
    detail: Mapped[Optional[dict]] = mapped_column(JSON, nullable=True)
    actor_name: Mapped[Optional[str]] = mapped_column(String(150), nullable=True)


class NotificationRead(IDMixin, TimestampMixin, Base):
    """Lectura individual por usuario (cada rol/usuario marca lo suyo)."""

    __tablename__ = 'notificaciones_leidas'
    __table_args__ = (
        UniqueConstraint('notification_id', 'user_id', name='uq_notif_reads_notification_user'),
    )

    notification_id: Mapped[int] = mapped_column(
        BigInteger, ForeignKey('notificaciones.id', ondelete='CASCADE'), index=True
    )
    user_id: Mapped[int] = mapped_column(
        BigInteger, ForeignKey('usuarios.id', ondelete='CASCADE'), index=True
    )
    read_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)


class SystemSetting(IDMixin, UpdatedAtMixin, Base):
    __tablename__ = 'ajustes_sistema'
    __table_args__ = (
        UniqueConstraint('company_id', 'key', name='uq_ajustes_sistema_company_key'),
    )

    company_id: Mapped[int] = mapped_column(
        BigInteger, ForeignKey('empresas.id', ondelete='CASCADE'), index=True
    )
    key: Mapped[str] = mapped_column(String(60))
    value: Mapped[Optional[dict]] = mapped_column(JSON, nullable=True)


class AppEvent(IDMixin, TimestampMixin, Base):
    __tablename__ = 'eventos_app'

    company_id: Mapped[Optional[int]] = mapped_column(
        BigInteger, ForeignKey('empresas.id', ondelete='CASCADE'), nullable=True, index=True
    )
    event_type: Mapped[str] = mapped_column(String(60), index=True)
    entity: Mapped[Optional[str]] = mapped_column(String(60), nullable=True)
    entity_id: Mapped[Optional[int]] = mapped_column(BigInteger, nullable=True)
    payload: Mapped[Optional[dict]] = mapped_column(JSON, nullable=True)
