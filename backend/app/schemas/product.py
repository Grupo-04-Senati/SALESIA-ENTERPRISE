"""Schemas de productos y categorías (docs/05 §2.4 · RF-04)."""

from __future__ import annotations

from datetime import datetime
from typing import ClassVar, Literal, Optional

from pydantic import Field

from app.schemas.base import NormalizedModel

ProductStatus = Literal['active', 'inactive']


class CategoryData(NormalizedModel):
    letter_required: ClassVar[frozenset[str]] = frozenset({'name'})
    name: str = Field(min_length=2, max_length=100)
    description: Optional[str] = Field(default=None, max_length=500)
    image_url: Optional[str] = Field(default=None, max_length=400_000)


class CategoryCreate(CategoryData):
    pass


class CategoryUpdate(CategoryData):
    pass


class CategoryOut(NormalizedModel):
    id: int = Field(ge=1)
    name: str
    status: str = 'active'


class ProductData(NormalizedModel):
    letter_required: ClassVar[frozenset[str]] = frozenset({'name'})
    sku: str = Field(
        min_length=1, max_length=50, pattern=r'^[A-Za-z0-9][A-Za-z0-9\-_.]{0,49}$'
    )
    name: str = Field(min_length=2, max_length=150)
    category_id: Optional[int] = Field(default=None, ge=1)
    cost_price: float = Field(default=0, ge=0, le=100_000_000)
    sale_price: float = Field(default=0, ge=0, le=100_000_000)
    wholesale_price: Optional[float] = Field(default=None, ge=0, le=100_000_000)
    brand: Optional[str] = Field(default=None, max_length=100)
    image_url: Optional[str] = Field(default=None, max_length=400_000)
    is_featured: bool = False
    min_stock: int = Field(default=0, ge=0, le=9_999_999)
    unit: str = Field(default='UND', max_length=20)
    description: Optional[str] = Field(default=None, max_length=500)


class ProductCreate(ProductData):
    pass


class ProductUpdate(ProductData):
    pass


class ProductStatusPatch(NormalizedModel):
    """PATCH /products/{id}/status — antes era un body ``dict`` sin validar."""

    status: ProductStatus


class ProductResponse(ProductData):
    id: int = Field(ge=1)
    category: Optional[CategoryOut] = None
    current_stock: int = 0
    status: str = 'active'
    created_at: datetime
