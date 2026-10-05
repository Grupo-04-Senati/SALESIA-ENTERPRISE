"""Schemas de órdenes de compra (BE-1 · docs/04 §2.4)."""

from __future__ import annotations

from typing import List, Literal, Optional

from pydantic import Field

from app.schemas.base import NormalizedModel

# purchase_order_service.PURCHASE_STATUSES (TRANSITIONS restringe además).
PurchaseOrderStatusValue = Literal['pending', 'approved', 'received', 'cancelled']


class PurchaseOrderItemInput(NormalizedModel):
    product_id: int = Field(ge=1)
    quantity: int = Field(gt=0, le=1_000_000)
    unit_cost: float = Field(ge=0, le=100_000_000)


class PurchaseOrderData(NormalizedModel):
    supplier_id: int = Field(ge=1)
    notes: Optional[str] = Field(default=None, max_length=500)
    items: List[PurchaseOrderItemInput] = Field(min_length=1)


class PurchaseOrderCreate(PurchaseOrderData):
    pass


class PurchaseOrderUpdate(PurchaseOrderData):
    pass


class PurchaseOrderStatusUpdate(NormalizedModel):
    status: PurchaseOrderStatusValue
