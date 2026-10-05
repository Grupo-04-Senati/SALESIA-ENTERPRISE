"""Schemas de listas de precios y promociones (docs/04 §2.4)."""

from __future__ import annotations

from typing import Annotated, List, Literal, Optional

from pydantic import Field

from app.schemas.base import NormalizedModel

PromotionKind = Literal['percent', 'fixed']
# pricing_service._to_active solo admite 'active'/'inactive' (None => activo).
PriceListStatus = Literal['active', 'inactive']


class PriceListData(NormalizedModel):
    name: Optional[str] = Field(default=None, min_length=2, max_length=120)
    currency: Optional[str] = Field(default=None, min_length=3, max_length=3)
    status: Optional[PriceListStatus] = None


class PriceListCreate(PriceListData):
    name: str = Field(min_length=2, max_length=120)
    currency: str = Field(default='PEN', min_length=3, max_length=3)


class PriceListUpdate(PriceListData):
    pass


class PriceListItemInput(NormalizedModel):
    product_id: int = Field(ge=1)
    price: float = Field(ge=0, le=100_000_000)


class PriceListItemsPayload(NormalizedModel):
    items: List[PriceListItemInput] = Field(min_length=1)


class PromotionData(NormalizedModel):
    name: str = Field(min_length=2, max_length=120)
    kind: PromotionKind = 'percent'
    value: float = Field(gt=0, le=100_000_000)
    starts_at: Optional[str] = Field(default=None, max_length=32)
    ends_at: Optional[str] = Field(default=None, max_length=32)
    status: Optional[PriceListStatus] = None
    product_ids: List[Annotated[int, Field(ge=1)]] = Field(min_length=1)


class PromotionCreate(PromotionData):
    pass


class PromotionUpdate(PromotionData):
    pass
