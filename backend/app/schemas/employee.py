"""Schemas de vendedores/empleados (docs/05 §2.5 · RF-05)."""

from __future__ import annotations

from datetime import date, datetime
from typing import Optional

from pydantic import BaseModel, EmailStr, Field


class EmployeeData(BaseModel):
    full_name: str = Field(min_length=2, max_length=150)
    document: Optional[str] = Field(default=None, max_length=20)
    position: Optional[str] = Field(default='Vendedor', max_length=80)
    phone: Optional[str] = Field(default=None, max_length=20)
    email: Optional[EmailStr] = None
    hire_date: Optional[date] = None


class EmployeeCreate(EmployeeData):
    pass


class EmployeeUpdate(EmployeeData):
    pass


class EmployeeMetrics(BaseModel):
    sales: int = 0
    revenue: float = 0.0
    average_ticket: float = 0.0


class EmployeeResponse(EmployeeData):
    id: int
    name: str
    status: str = 'active'
    hired_at: Optional[date] = None
    created_at: Optional[datetime] = None
    metrics: Optional[EmployeeMetrics] = None
