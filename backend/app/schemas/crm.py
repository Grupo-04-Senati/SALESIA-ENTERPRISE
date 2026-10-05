"""Schemas de segmentos e interacciones con clientes (docs/04 §2.4)."""

from __future__ import annotations

from datetime import datetime
from typing import ClassVar, Literal, Optional

from pydantic import Field

from app.schemas.base import NormalizedModel

InteractionKind = Literal['note', 'call', 'email', 'meeting', 'visit']
# crm_service._to_active solo admite 'active'/'inactive' (None => activo).
SegmentStatus = Literal['active', 'inactive']


class CustomerSegmentData(NormalizedModel):
    letter_required: ClassVar[frozenset[str]] = frozenset({'name'})
    name: str = Field(min_length=2, max_length=60)
    description: Optional[str] = Field(default=None, max_length=300)
    min_purchases: int = Field(default=0, ge=0, le=9_999_999)
    min_total: float = Field(default=0, ge=0, le=100_000_000)
    status: Optional[SegmentStatus] = None


class CustomerSegmentCreate(CustomerSegmentData):
    pass


class CustomerSegmentUpdate(CustomerSegmentData):
    pass


class CustomerInteractionData(NormalizedModel):
    letter_required: ClassVar[frozenset[str]] = frozenset({'subject'})
    customer_id: int = Field(ge=1)
    kind: InteractionKind = 'note'
    subject: str = Field(min_length=3, max_length=150)
    notes: Optional[str] = Field(default=None, max_length=500)
    occurred_at: Optional[datetime] = None


class CustomerInteractionCreate(CustomerInteractionData):
    pass


class CustomerInteractionUpdate(CustomerInteractionData):
    pass
