"""Schemas de listas de precios y promociones (docs/04 §2.4)."""

from __future__ import annotations

from typing import List, Literal, Optional

from pydantic import BaseModel, Field

PromotionKind = Literal['percent', 'fixed']


class PriceListData(BaseModel):
    name: Optional[str] = Field(default=None, min_length=2, max_length=120)
    currency: Optional[str] = Field(default=None, min_length=3, max_length=3)
    status: Optional[str] = Field(default=None, max_length=10)


class PriceListCreate(PriceListData):
    name: str = Field(min_length=2, max_length=120)
    currency: str = Field(default='PEN', min_length=3, max_length=3)


class PriceListUpdate(PriceListData):
    pass


class PriceListItemInput(BaseModel):
    product_id: int
    price: float = Field(ge=0)


class PriceListItemsPayload(BaseModel):
    items: List[PriceListItemInput] = Field(min_length=1)


class PromotionData(BaseModel):
    name: str = Field(min_length=2, max_length=120)
    kind: PromotionKind = 'percent'
    value: float = Field(gt=0)
    starts_at: Optional[str] = None
    ends_at: Optional[str] = None
    status: Optional[str] = Field(default=None, max_length=10)
    product_ids: List[int] = Field(min_length=1)


class PromotionCreate(PromotionData):
    pass


class PromotionUpdate(PromotionData):
    pass
