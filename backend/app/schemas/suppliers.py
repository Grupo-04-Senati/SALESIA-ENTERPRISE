"""Schemas de proveedores (BE-1 · docs/04 §2.4)."""

from __future__ import annotations

from typing import ClassVar, Optional

from pydantic import EmailStr, Field

from app.schemas.base import NormalizedModel

PHONE_PATTERN = r'^(\+?\d{7,15})?$'


class SupplierData(NormalizedModel):
    letter_required: ClassVar[frozenset[str]] = frozenset({'name'})
    ruc: str = Field(min_length=8, max_length=15, pattern=r'^\d{8,15}$')
    name: str = Field(min_length=2, max_length=150)
    email: Optional[EmailStr] = Field(default=None, max_length=160)
    phone: Optional[str] = Field(default=None, max_length=20, pattern=PHONE_PATTERN)
    address: Optional[str] = Field(default=None, max_length=255)


class SupplierCreate(SupplierData):
    pass


class SupplierUpdate(SupplierData):
    pass
