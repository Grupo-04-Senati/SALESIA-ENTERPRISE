"""Schemas de unidades, sucursales, almacenes, stock y conteos (docs/04 §2.4)."""

from __future__ import annotations

from typing import List, Optional

from pydantic import BaseModel, Field


class UnitData(BaseModel):
    name: str = Field(min_length=1, max_length=30)
    symbol: Optional[str] = Field(default=None, max_length=10)
    status: Optional[str] = Field(default=None, max_length=10)


class UnitCreate(UnitData):
    pass


class UnitUpdate(UnitData):
    pass


class BranchData(BaseModel):
    code: str = Field(min_length=1, max_length=20)
    name: str = Field(min_length=2, max_length=120)
    address: Optional[str] = Field(default=None, max_length=255)
    phone: Optional[str] = Field(default=None, max_length=20)
    status: Optional[str] = Field(default=None, max_length=10)


class BranchCreate(BranchData):
    pass


class BranchUpdate(BranchData):
    pass


class WarehouseData(BaseModel):
    code: str = Field(min_length=1, max_length=20)
    name: str = Field(min_length=2, max_length=120)
    address: Optional[str] = Field(default=None, max_length=255)
    status: Optional[str] = Field(default=None, max_length=10)


class WarehouseCreate(WarehouseData):
    pass


class WarehouseUpdate(WarehouseData):
    pass


class WarehouseStockData(BaseModel):
    stock: Optional[int] = Field(default=None, ge=0)
    min_stock: Optional[int] = Field(default=None, ge=0)


class WarehouseStockCreate(WarehouseStockData):
    warehouse_id: int
    product_id: int
    stock: int = Field(ge=0)
    min_stock: int = Field(ge=0)


class WarehouseStockUpdate(WarehouseStockData):
    pass


class StockCountItemInput(BaseModel):
    product_id: int
    counted_qty: int = Field(ge=0)


class StockCountData(BaseModel):
    warehouse_id: int
    notes: Optional[str] = None
    items: List[StockCountItemInput] = Field(min_length=1)


class StockCountCreate(StockCountData):
    pass


class StockCountUpdate(StockCountData):
    pass
