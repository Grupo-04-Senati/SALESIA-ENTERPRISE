"""Schemas de reportes (docs/05 §2.10 · RF-20)."""

from __future__ import annotations

from datetime import datetime
from typing import Any, ClassVar, Dict, List, Literal, Optional

from pydantic import Field

from app.schemas.base import NormalizedModel

ReportType = Literal['ventas', 'estadistico', 'productos', 'clientes', 'vendedores']


class ReportCreate(NormalizedModel):
    letter_required: ClassVar[frozenset[str]] = frozenset({'title'})
    report_type: ReportType
    title: Optional[str] = Field(default=None, min_length=3, max_length=200)
    filters: Dict[str, Any] = {}


class ReportColumn(NormalizedModel):
    key: str
    label: str
    align: Optional[str] = None


class ReportResponse(NormalizedModel):
    id: int = Field(ge=1)
    report_type: str
    title: str
    description: str = ''
    filters: Dict[str, Any] = {}
    columns: List[ReportColumn] = []
    rows: List[Dict[str, Any]] = []
    summary: List[Dict[str, Any]] = []
    generated_by: Optional[int] = None
    created_at: datetime
