"""Schemas de ventas, pagos e inventario (docs/05 §2.6 · RF-06…RF-08)."""

from __future__ import annotations

from datetime import datetime
from typing import List, Literal, Optional

from pydantic import BaseModel, Field

PaymentMethod = Literal['cash', 'card', 'transfer']
MovementKind = Literal['IN', 'OUT', 'RETURN', 'SHRINKAGE', 'ADJUSTMENT']


class SaleItemInput(BaseModel):
    product_id: int
    quantity: int = Field(gt=0)
    unit_price: float = Field(ge=0)
    discount: float = Field(default=0, ge=0)


class PaymentInput(BaseModel):
    method: PaymentMethod = 'cash'
    amount: float = Field(gt=0)
    reference: Optional[str] = Field(default=None, max_length=100)


class SaleCreate(BaseModel):
    customer_id: int
    seller_id: int
    items: List[SaleItemInput] = Field(min_length=1)
    payment: Optional[PaymentInput] = None
    tax_rate: float = Field(default=0.18, ge=0, le=1)
    notes: Optional[str] = None


class TraceStep(BaseModel):
    module: str
    label: str
    detail: str


class SaleCreated(BaseModel):
    id: int
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


class SaleItemResponse(BaseModel):
    product_id: int
    sku: str = ''
    name: str = ''
    quantity: int
    unit_price: float
    discount: float
    subtotal: float


class PaymentResponse(BaseModel):
    id: int
    method: str
    amount: float
    paid_at: datetime
    reference: Optional[str] = None


class PartyRef(BaseModel):
    id: Optional[int] = None
    name: str


class SaleResponse(BaseModel):
    id: int
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


class PaymentCreate(BaseModel):
    method: PaymentMethod = 'cash'
    amount: float = Field(gt=0)
    reference: Optional[str] = None


class StatusUpdate(BaseModel):
    status: str
    reason: Optional[str] = None


class CancelRequest(BaseModel):
    reason: str = Field(min_length=10, max_length=500)


class MovementCreate(BaseModel):
    product_id: int
    type: MovementKind
    quantity: int = Field(gt=0)
    reason: Optional[str] = Field(default=None, max_length=255)


class MovementResponse(BaseModel):
    id: int
    product_id: int
    sku: str = ''
    type: str
    quantity: int
    resulting_stock: int
    reason: str
    user: Optional[PartyRef] = None
    created_at: datetime


class StockRow(BaseModel):
    product_id: int
    sku: str
    name: str
    category: str = ''
    current_stock: int
    min_stock: int
    unit: str = 'UND'
