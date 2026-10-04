"""Schemas de envíos de ventas (BE-1 · docs/04 §2.4)."""

from __future__ import annotations

from typing import Optional

from pydantic import BaseModel, Field


class ShipmentData(BaseModel):
    sale_id: int
    carrier: Optional[str] = Field(default=None, max_length=80)
    tracking_code: Optional[str] = Field(default=None, max_length=60)
    status: str = Field(default='pending', max_length=20)


class ShipmentCreate(ShipmentData):
    pass


class ShipmentUpdate(ShipmentData):
    pass


class ShipmentStatusUpdate(BaseModel):
    status: str = Field(max_length=20)
