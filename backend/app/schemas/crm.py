"""Schemas de segmentos e interacciones con clientes (docs/04 §2.4)."""

from __future__ import annotations

from datetime import datetime
from typing import Literal, Optional

from pydantic import BaseModel, Field

InteractionKind = Literal['note', 'call', 'email', 'meeting', 'visit']


class CustomerSegmentData(BaseModel):
    name: str = Field(min_length=2, max_length=60)
    description: Optional[str] = None
    min_purchases: int = Field(default=0, ge=0)
    min_total: float = Field(default=0, ge=0)
    status: Optional[str] = Field(default=None, max_length=10)


class CustomerSegmentCreate(CustomerSegmentData):
    pass


class CustomerSegmentUpdate(CustomerSegmentData):
    pass


class CustomerInteractionData(BaseModel):
    customer_id: int
    kind: InteractionKind = 'note'
    subject: str = Field(min_length=3, max_length=150)
    notes: Optional[str] = None
    occurred_at: Optional[datetime] = None


class CustomerInteractionCreate(CustomerInteractionData):
    pass


class CustomerInteractionUpdate(CustomerInteractionData):
    pass
