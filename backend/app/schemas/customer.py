"""Schemas de clientes (docs/05 §2.3 · RF-03)."""

from __future__ import annotations

from datetime import datetime
from typing import Optional

from pydantic import BaseModel, EmailStr, Field


class CustomerData(BaseModel):
    document_type: str = Field(default='DNI', max_length=10)
    document_number: str = Field(min_length=3, max_length=20)
    name: str = Field(min_length=2, max_length=150)
    email: Optional[EmailStr] = None
    phone: Optional[str] = Field(default=None, max_length=20)
    address: Optional[str] = Field(default=None, max_length=255)
    segment: str = Field(default='Nuevo', max_length=30)


class CustomerCreate(CustomerData):
    pass


class CustomerUpdate(CustomerData):
    pass


class CustomerResponse(CustomerData):
    id: int
    status: str = 'active'
    created_at: datetime
    purchase_count: int = 0
    total_purchased: float = 0.0
