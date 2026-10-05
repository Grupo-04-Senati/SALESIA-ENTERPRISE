"""Schemas de devoluciones de venta (BE-1 · docs/04 §2.4)."""

from __future__ import annotations

from typing import List, Literal

from pydantic import Field

from app.schemas.base import NormalizedModel

# return_service.update_return_status solo admite rechazar ('rejected').
ReturnStatusValue = Literal['rejected']


class ReturnItemInput(NormalizedModel):
    product_id: int = Field(ge=1)
    quantity: int = Field(gt=0, le=1_000_000)


class ReturnData(NormalizedModel):
    sale_id: int = Field(ge=1)
    reason: str = Field(min_length=3, max_length=500)
    items: List[ReturnItemInput] = Field(min_length=1)


class ReturnCreate(ReturnData):
    pass


class ReturnUpdate(ReturnData):
    pass


class ReturnStatusUpdate(NormalizedModel):
    status: ReturnStatusValue
