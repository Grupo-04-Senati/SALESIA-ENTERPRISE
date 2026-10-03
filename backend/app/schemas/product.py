"""Schemas de productos y categorías (docs/05 §2.4 · RF-04)."""

from __future__ import annotations

from datetime import datetime
from typing import Optional

from pydantic import BaseModel, Field


class CategoryData(BaseModel):
    name: str = Field(min_length=2, max_length=100)
    description: Optional[str] = None


class CategoryCreate(CategoryData):
    pass


class CategoryUpdate(CategoryData):
    pass


class CategoryOut(BaseModel):
    id: int
    name: str
    status: str = 'active'


class ProductData(BaseModel):
    sku: str = Field(min_length=1, max_length=50)
    name: str = Field(min_length=2, max_length=150)
    category_id: Optional[int] = None
    cost_price: float = Field(default=0, ge=0)
    sale_price: float = Field(default=0, ge=0)
    min_stock: int = Field(default=0, ge=0)
    unit: str = Field(default='UND', max_length=20)
    description: Optional[str] = None


class ProductCreate(ProductData):
    pass


class ProductUpdate(ProductData):
    pass


class ProductResponse(ProductData):
    id: int
    category: Optional[CategoryOut] = None
    current_stock: int = 0
    status: str = 'active'
    created_at: datetime
