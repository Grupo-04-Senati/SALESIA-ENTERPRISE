"""4. employees — personal / vendedores (RF-05)."""

from __future__ import annotations

from datetime import date, datetime
from typing import TYPE_CHECKING, Optional

from sqlalchemy import BigInteger, Boolean, Date, DateTime, ForeignKey, String
from sqlalchemy.orm import Mapped, MappedColumn, mapped_column, relationship

from app.models.base import IDMixin, UpdatedAtMixin
from app.core.database import Base

if TYPE_CHECKING:
    from app.models.company import Company
    from app.models.user import User


class Employee(IDMixin, UpdatedAtMixin, Base):
    __tablename__ = 'empleados'

    company_id: Mapped[int] = mapped_column(
        BigInteger, ForeignKey('empresas.id', ondelete='CASCADE'), index=True
    )
    user_id: Mapped[Optional[int]] = mapped_column(
        BigInteger, ForeignKey('usuarios.id', ondelete='SET NULL'), nullable=True
    )
    full_name: Mapped[str] = mapped_column(String(150))
    document: Mapped[Optional[str]] = mapped_column(String(20), unique=True, nullable=True)
    position: Mapped[Optional[str]] = mapped_column(String(80), nullable=True)
    phone: Mapped[Optional[str]] = mapped_column(String(20), nullable=True)
    email: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)
    hire_date: Mapped[Optional[date]] = mapped_column(Date, nullable=True)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)

    user: Mapped[Optional['User']] = relationship('User', lazy='selectin')
    company: Mapped['Company'] = relationship('Company', lazy='selectin')
