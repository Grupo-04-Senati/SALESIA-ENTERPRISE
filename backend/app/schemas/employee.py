"""Schemas de vendedores/empleados (docs/05 §2.5 · RF-05)."""

from __future__ import annotations

from datetime import date, datetime
from typing import ClassVar, Optional

from pydantic import EmailStr, Field

from app.schemas.base import NormalizedModel

DOCUMENT_PATTERN = r'^([A-Za-z0-9\-]{5,20})?$'
PHONE_PATTERN = r'^(\+?\d{7,15})?$'


class EmployeeData(NormalizedModel):
    letter_required: ClassVar[frozenset[str]] = frozenset({'full_name'})
    full_name: str = Field(min_length=2, max_length=150)
    document: Optional[str] = Field(default=None, max_length=20, pattern=DOCUMENT_PATTERN)
    position: Optional[str] = Field(default='Vendedor', max_length=80)
    phone: Optional[str] = Field(default=None, max_length=20, pattern=PHONE_PATTERN)
    # La BD usa String(100) para el correo del empleado.
    email: Optional[EmailStr] = Field(default=None, max_length=100)
    hire_date: Optional[date] = None


class EmployeeCreate(EmployeeData):
    pass


class EmployeeUpdate(EmployeeData):
    pass


class EmployeeMetrics(NormalizedModel):
    sales: int = 0
    revenue: float = 0.0
    average_ticket: float = 0.0


class EmployeeResponse(EmployeeData):
    id: int = Field(ge=1)
    name: str
    status: str = 'active'
    hired_at: Optional[date] = None
    created_at: Optional[datetime] = None
    metrics: Optional[EmployeeMetrics] = None
