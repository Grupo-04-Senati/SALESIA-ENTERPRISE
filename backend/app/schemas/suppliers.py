"""Schemas de proveedores (BE-1 · docs/04 §2.4)."""

from __future__ import annotations

from typing import Optional

from pydantic import BaseModel, Field


class SupplierData(BaseModel):
    ruc: str = Field(min_length=8, max_length=15)
    name: str = Field(min_length=2, max_length=150)
    email: Optional[str] = Field(default=None, max_length=160)
    phone: Optional[str] = Field(default=None, max_length=20)
    address: Optional[str] = Field(default=None, max_length=255)


class SupplierCreate(SupplierData):
    pass


class SupplierUpdate(SupplierData):
    pass
