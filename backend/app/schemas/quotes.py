"""Schemas de cotizaciones (BE-1 · docs/04 §2.4)."""

from __future__ import annotations

from datetime import date
from typing import List, Optional

from pydantic import BaseModel, Field


class QuoteItemInput(BaseModel):
    product_id: int
    quantity: int = Field(gt=0)
    unit_price: float = Field(ge=0)
    discount: float = Field(default=0, ge=0)


class QuoteData(BaseModel):
    customer_id: int
    valid_until: Optional[date] = None
    notes: Optional[str] = None
    tax_rate: float = Field(default=0.18, ge=0, le=1)
    items: List[QuoteItemInput] = Field(min_length=1)


class QuoteCreate(QuoteData):
    pass


class QuoteUpdate(QuoteData):
    pass


class QuoteStatusUpdate(BaseModel):
    status: str = Field(max_length=20)
