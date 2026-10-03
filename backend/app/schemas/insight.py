"""Schemas de insights (docs/05 §2.10 · RF-19 · RN-47)."""

from __future__ import annotations

from datetime import datetime
from typing import Any, Dict, List, Optional

from pydantic import BaseModel


class InsightResponse(BaseModel):
    id: int
    title: str
    severity: str
    rule: str
    message: str
    evidence: Dict[str, Any] = {}
    analysis_id: Optional[int] = None
    dataset_id: Optional[int] = None
    created_at: datetime
    read: bool = False


class InsightRule(BaseModel):
    code: str
    description: str
    severity: str
    enabled: bool = True
