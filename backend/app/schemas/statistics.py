"""Schemas de estadística — Semana 07 (docs/05 §2.8 · RF-10…RF-14, RF-21)."""

from __future__ import annotations

from datetime import datetime
from typing import Any, List, Literal, Optional

from pydantic import BaseModel, Field


class StatInput(BaseModel):
    """Valores directos (pruebas académicas) o referencia a un dataset."""

    values: Optional[List[float]] = None
    dataset_id: Optional[int] = None
    field: Optional[str] = None
    save_history: bool = True


class Period(BaseModel):
    from_: str = Field(alias='from')
    to: str

    model_config = {'populate_by_name': True}


class MetricResult(BaseModel):
    metric: Literal['mean', 'median']
    value: float
    count: int
    min: Optional[float] = None
    max: Optional[float] = None
    period: Optional[Period] = None
    analysis_id: Optional[int] = None
    calculated_at: Optional[datetime] = None


class CompareResult(BaseModel):
    mean: float
    median: float
    difference: float
    difference_pct: float
    interpretation: str
    analysis_id: Optional[int] = None
    count: Optional[int] = None


class Frequency(BaseModel):
    value: str
    count: int
    pct: float


class VariableInfo(BaseModel):
    name: str
    type: Literal['quantitative', 'qualitative']
    subtype: str
    count: int
    mean: Optional[float] = None
    median: Optional[float] = None
    min: Optional[float] = None
    max: Optional[float] = None
    frequencies: Optional[List[Frequency]] = None


class VariablesResult(BaseModel):
    variables: List[VariableInfo]
    analysis_id: Optional[int] = None


class VariableSpec(BaseModel):
    name: str
    label: Optional[str] = None
    stat_type: Literal['qualitative', 'quantitative'] = 'quantitative'
    scale: Literal['nominal', 'ordinal', 'discrete', 'continuous'] = 'continuous'
    unit: Optional[str] = None
    is_random_variable: bool = False


class DatasetCreate(BaseModel):
    name: str = Field(min_length=2, max_length=150)
    description: Optional[str] = None
    source: Literal['sales', 'customers', 'products', 'custom'] = 'sales'
    filters: dict = {}
    fields: Optional[List[VariableSpec]] = None


class DatasetResponse(BaseModel):
    id: int
    name: str
    description: Optional[str] = None
    source: str
    row_count: int
    created_at: datetime
    variables: List[VariableSpec] = []


class AnalysisRecord(BaseModel):
    """Historial de análisis (RF-21) en la forma que consume el frontend."""

    id: int
    kind: Literal['media', 'mediana', 'comparacion', 'bayes', 'variable']
    label: str
    result: str
    created_at: datetime
