"""Schemas de órdenes de compra (BE-1 · docs/04 §2.4)."""

from __future__ import annotations

from typing import List, Optional

from pydantic import BaseModel, Field


class PurchaseOrderItemInput(BaseModel):
    product_id: int
    quantity: int = Field(gt=0)
    unit_cost: float = Field(ge=0)


class PurchaseOrderData(BaseModel):
    supplier_id: int
    notes: Optional[str] = None
    items: List[PurchaseOrderItemInput] = Field(min_length=1)


class PurchaseOrderCreate(PurchaseOrderData):
    pass


class PurchaseOrderUpdate(PurchaseOrderData):
    pass


class PurchaseOrderStatusUpdate(BaseModel):
    status: str = Field(max_length=20)
