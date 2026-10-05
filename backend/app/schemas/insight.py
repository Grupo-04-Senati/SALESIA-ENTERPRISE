"""Schemas de insights (docs/05 ��2.10 �� RF-19 �� RN-47, RN-48)."""

from __future__ import annotations

from datetime import datetime
from typing import Any, Dict, Optional

from pydantic import Field

from app.schemas.base import NormalizedModel


class InsightResponse(NormalizedModel):
    id: int = Field(ge=1)
    title: str
    severity: str
    rule: str
    message: str
    evidence: Dict[str, Any] = {}
    analysis_id: Optional[int] = None
    dataset_id: Optional[int] = None
    created_at: datetime
    read: bool = False


class InsightRule(NormalizedModel):
    code: str
    description: str
    severity: str
    enabled: bool = True
