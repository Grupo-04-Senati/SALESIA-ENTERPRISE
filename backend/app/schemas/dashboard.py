"""Schemas del dashboard ejecutivo (docs/05 §2.7 · RF-09)."""

from __future__ import annotations

from typing import Dict, List

from pydantic import BaseModel, Field


class PeriodOut(BaseModel):
    from_: str = Field(default='', alias='from')
    to: str = ''

    model_config = {'populate_by_name': True}


class DashboardSummary(BaseModel):
    period: PeriodOut
    sales: int = 0
    revenue: float = 0.0
    transactions: int = 0
    new_customers: int = 0
    average_ticket: float = 0.0
    mean_sale: float = 0.0
    median_sale: float = 0.0
    low_stock_products: int = 0
    cancellations: int = 0
    vs_previous_period: Dict[str, float] = Field(default_factory=dict)


class SeriesPoint(BaseModel):
    label: str
    revenue: float = 0.0
    transactions: int = 0


class TopPoint(BaseModel):
    name: str
    revenue: float = 0.0
    units: int = 0
    transactions: int = 0


class StockAlert(BaseModel):
    product_id: int
    sku: str
    name: str
    current_stock: int
    min_stock: int
    unit: str = 'UND'
