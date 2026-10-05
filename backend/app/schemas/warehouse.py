"""Schemas de unidades, sucursales, almacenes, stock y conteos (docs/04 §2.4)."""

from __future__ import annotations

from typing import ClassVar, List, Literal, Optional

from pydantic import Field

from app.schemas.base import NormalizedModel

# warehouse_service._to_active solo admite 'active'/'inactive' (None => activo).
WarehouseStatus = Literal['active', 'inactive']
PHONE_PATTERN = r'^(\+?\d{7,15})?$'


class UnitData(NormalizedModel):
    name: str = Field(min_length=1, max_length=30)
    symbol: Optional[str] = Field(default=None, max_length=10)
    status: Optional[WarehouseStatus] = None


class UnitCreate(UnitData):
    pass


class UnitUpdate(UnitData):
    pass


class BranchData(NormalizedModel):
    letter_required: ClassVar[frozenset[str]] = frozenset({'name'})
    code: str = Field(min_length=1, max_length=20)
    name: str = Field(min_length=2, max_length=120)
    address: Optional[str] = Field(default=None, max_length=255)
    phone: Optional[str] = Field(default=None, max_length=20, pattern=PHONE_PATTERN)
    status: Optional[WarehouseStatus] = None


class BranchCreate(BranchData):
    pass


class BranchUpdate(BranchData):
    pass


class WarehouseData(NormalizedModel):
    letter_required: ClassVar[frozenset[str]] = frozenset({'name'})
    code: str = Field(min_length=1, max_length=20)
    name: str = Field(min_length=2, max_length=120)
    address: Optional[str] = Field(default=None, max_length=255)
    status: Optional[WarehouseStatus] = None


class WarehouseCreate(WarehouseData):
    pass


class WarehouseUpdate(WarehouseData):
    pass


class WarehouseStockData(NormalizedModel):
    stock: Optional[int] = Field(default=None, ge=0, le=9_999_999)
    min_stock: Optional[int] = Field(default=None, ge=0, le=9_999_999)


class WarehouseStockCreate(WarehouseStockData):
    warehouse_id: int = Field(ge=1)
    product_id: int = Field(ge=1)
    stock: int = Field(ge=0, le=9_999_999)
    min_stock: int = Field(ge=0, le=9_999_999)


class WarehouseStockUpdate(WarehouseStockData):
    pass


class StockCountItemInput(NormalizedModel):
    product_id: int = Field(ge=1)
    counted_qty: int = Field(ge=0, le=9_999_999)


class StockCountData(NormalizedModel):
    warehouse_id: int = Field(ge=1)
    notes: Optional[str] = Field(default=None, max_length=500)
    items: List[StockCountItemInput] = Field(min_length=1)


class StockCountCreate(StockCountData):
    pass


class StockCountUpdate(StockCountData):
    pass
