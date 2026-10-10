"""Schemas de clientes (docs/05 §2.3 · RF-03)."""

from __future__ import annotations

from datetime import datetime
from typing import ClassVar, Literal, Optional

from pydantic import EmailStr, Field, field_validator

from app.schemas.base import NormalizedModel

# Valores que envía el frontend (CustomerForm: DNI/RUC/CE) + PASAPORTE.
DocumentType = Literal['DNI', 'RUC', 'CE', 'PASAPORTE']


class CustomerData(NormalizedModel):
    letter_required: ClassVar[frozenset[str]] = frozenset({'name'})
    document_type: DocumentType = 'DNI'
    document_number: str = Field(min_length=6, max_length=20, pattern=r'^\d{6,20}$')
    name: str = Field(min_length=3, max_length=150)
    email: Optional[EmailStr] = Field(default=None, max_length=160)
    phone: Optional[str] = Field(default=None, max_length=20, pattern=r'^(\+?\d{7,15})?$')
    address: Optional[str] = Field(default=None, max_length=255)
    segment: str = Field(default='Nuevo', max_length=30)
    commercial_line: Optional[str] = Field(default=None, max_length=80)

    @field_validator('email', mode='before')
    @classmethod
    def _empty_email_to_none(cls, value: object) -> object:
        """El formulario envía '' cuando el correo opcional está en blanco."""
        if isinstance(value, str) and not value.strip():
            return None
        return value


class CustomerCreate(CustomerData):
    pass


class CustomerUpdate(CustomerData):
    pass


class CustomerResponse(CustomerData):
    id: int = Field(ge=1)
    status: str = 'active'
    created_at: datetime
    purchase_count: int = 0
    total_purchased: float = 0.0


class CustomerInline(CustomerData):
    """Cliente que llega junto a la venta para crearse/reusarse automáticamente."""


class DocumentLookup(NormalizedModel):
    found: bool = False
    source: str = 'none'  # local | api | none
    document_type: DocumentType = 'DNI'
    document_number: str = ''
    name: str = ''
    address: str = ''


class StatementSale(NormalizedModel):
    sale_number: str
    issued_at: datetime
    total: float
    paid: float
    balance: float
    days_overdue: int = 0
    aging_bucket: str = 'vigente'  # vigente | 1-30 | 31-60 | 61-90 | 90+


class AccountStatement(NormalizedModel):
    customer: dict
    total_purchased: float
    total_paid: float
    balance: float
    aging: dict
    sales: list[StatementSale] = []
