"""Schemas de cotizaciones (BE-1 · docs/04 §2.4)."""

from __future__ import annotations

from datetime import date
from decimal import Decimal
from typing import List, Literal, Optional

from pydantic import Field, model_validator

from app.schemas.base import NormalizedModel

# quote_service.QUOTE_STATUSES (el estado 'converted' no se envía por PATCH).
QuoteStatusValue = Literal['draft', 'sent', 'approved', 'rejected', 'expired']


class QuoteItemInput(NormalizedModel):
    product_id: int = Field(ge=1)
    quantity: int = Field(gt=0, le=1_000_000)
    unit_price: float = Field(ge=0, le=100_000_000)
    discount: float = Field(default=0, ge=0, le=100_000_000)

    @model_validator(mode='after')
    def _check_discount(self) -> 'QuoteItemInput':
        # RN-13 (espejo de sale_service.py): el descuento no supera el subtotal.
        if Decimal(str(self.discount)) > Decimal(str(self.quantity)) * Decimal(str(self.unit_price)):
            raise ValueError('El descuento de la línea supera su subtotal (RN-13).')
        return self


class QuoteData(NormalizedModel):
    customer_id: int = Field(ge=1)
    valid_until: Optional[date] = None
    notes: Optional[str] = Field(default=None, max_length=500)
    tax_rate: float = Field(default=0.18, ge=0, le=1)
    items: List[QuoteItemInput] = Field(min_length=1)


class QuoteCreate(QuoteData):
    pass


class QuoteUpdate(QuoteData):
    pass


class QuoteStatusUpdate(NormalizedModel):
    status: QuoteStatusValue
