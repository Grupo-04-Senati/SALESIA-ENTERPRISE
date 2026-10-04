"""Schemas de devoluciones de venta (BE-1 · docs/04 §2.4)."""

from __future__ import annotations

from typing import List

from pydantic import BaseModel, Field


class ReturnItemInput(BaseModel):
    product_id: int
    quantity: int = Field(gt=0)


class ReturnData(BaseModel):
    sale_id: int
    reason: str = Field(min_length=3, max_length=500)
    items: List[ReturnItemInput] = Field(min_length=1)


class ReturnCreate(ReturnData):
    pass


class ReturnUpdate(ReturnData):
    pass


class ReturnStatusUpdate(BaseModel):
    status: str = Field(max_length=20)
