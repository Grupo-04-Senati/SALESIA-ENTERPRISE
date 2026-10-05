"""Schemas de ventas, pagos e inventario (docs/05 §2.6 · RF-06…RF-08)."""

from __future__ import annotations

from datetime import datetime
from typing import List, Literal, Optional

from pydantic import Field

from app.schemas.base import NormalizedModel

PaymentMethod = Literal['cash', 'card', 'transfer']
MovementKind = Literal['IN', 'OUT', 'RETURN', 'SHRINKAGE', 'ADJUSTMENT']
# sale_service.update_sale_status (L488) acepta exactamente estos estados.
SaleStatusValue = Literal['pending', 'partial', 'paid', 'cancelled']


class SaleItemInput(NormalizedModel):
    product_id: int = Field(ge=1)
    quantity: int = Field(gt=0, le=1_000_000)
    unit_price: float = Field(ge=0, le=100_000_000)
    discount: float = Field(default=0, ge=0, le=100_000_000)


class PaymentInput(NormalizedModel):
    method: PaymentMethod = 'cash'
    amount: float = Field(gt=0, le=100_000_000)
    reference: Optional[str] = Field(default=None, max_length=100)


class SaleCreate(NormalizedModel):
    customer_id: int = Field(ge=1)
    seller_id: int = Field(ge=1)
    items: List[SaleItemInput] = Field(min_length=1)
    payment: Optional[PaymentInput] = None
    tax_rate: float = Field(default=0.18, ge=0, le=1)
    notes: Optional[str] = Field(default=None, max_length=500)


class TraceStep(NormalizedModel):
    module: str
    label: str
    detail: str


class SaleCreated(NormalizedModel):
    id: int = Field(ge=1)
    sale_number: str
    subtotal: float
    discount: float
    tax: float
    total: float
    status: str
    inventory_updated: bool
    paid: float
    balance: float
    trace: List[TraceStep] = []


class SaleItemResponse(NormalizedModel):
    product_id: int = Field(ge=1)
    sku: str = ''
    name: str = ''
    quantity: int
    unit_price: float
    discount: float
    subtotal: float


class PaymentResponse(NormalizedModel):
    id: int = Field(ge=1)
    method: str
    amount: float
    paid_at: datetime
    reference: Optional[str] = None


class PartyRef(NormalizedModel):
    id: Optional[int] = Field(default=None, ge=1)
    name: str


class SaleResponse(NormalizedModel):
    id: int = Field(ge=1)
    sale_number: str
    customer: Optional[PartyRef] = None
    seller: Optional[PartyRef] = None
    issued_at: datetime
    status: str
    items: List[SaleItemResponse]
    subtotal: float
    discount: float
    tax: float
    total: float
    paid: float
    balance: float
    cancelled_at: Optional[datetime] = None
    cancel_reason: Optional[str] = None
    payments: List[PaymentResponse] = []


class PaymentCreate(NormalizedModel):
    method: PaymentMethod = 'cash'
    amount: float = Field(gt=0, le=100_000_000)
    reference: Optional[str] = Field(default=None, max_length=100)


class StatusUpdate(NormalizedModel):
    status: SaleStatusValue
    reason: Optional[str] = Field(default=None, max_length=255)


class CancelRequest(NormalizedModel):
    reason: str = Field(min_length=10, max_length=500)


class MovementCreate(NormalizedModel):
    product_id: int = Field(ge=1)
    type: MovementKind
    quantity: int = Field(gt=0, le=1_000_000)
    reason: Optional[str] = Field(default=None, max_length=255)


class MovementResponse(NormalizedModel):
    id: int = Field(ge=1)
    product_id: int = Field(ge=1)
    sku: str = ''
    type: str
    quantity: int
    resulting_stock: int
    reason: str
    user: Optional[PartyRef] = None
    created_at: datetime


class StockRow(NormalizedModel):
    product_id: int = Field(ge=1)
    sku: str
    name: str
    category: str = ''
    current_stock: int
    min_stock: int
    unit: str = 'UND'
