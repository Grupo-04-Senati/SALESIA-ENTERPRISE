"""Schemas de envíos de ventas (BE-1 · docs/04 §2.4)."""

from __future__ import annotations

from typing import Literal, Optional

from pydantic import Field

from app.schemas.base import NormalizedModel

# shipment_service.SHIPMENT_STATUSES (create/update/status lo validan igual).
ShipmentStatusValue = Literal['pending', 'shipped', 'delivered', 'cancelled']


class ShipmentData(NormalizedModel):
    sale_id: int = Field(ge=1)
    carrier: Optional[str] = Field(default=None, max_length=80)
    tracking_code: Optional[str] = Field(default=None, pattern=r'^[A-Za-z0-9\-]{0,60}$')
    status: ShipmentStatusValue = 'pending'


class ShipmentCreate(ShipmentData):
    pass


class ShipmentUpdate(ShipmentData):
    pass


class ShipmentStatusUpdate(NormalizedModel):
    status: ShipmentStatusValue
