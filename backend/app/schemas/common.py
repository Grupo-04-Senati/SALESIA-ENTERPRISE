"""Tipos comunes: paginación y respuestas de error (docs/05 §1, §3)."""

from __future__ import annotations

from typing import Generic, List, TypeVar

from app.schemas.base import NormalizedModel

T = TypeVar('T')


class Page(NormalizedModel, Generic[T]):
    """Envoltura estándar de listados."""

    items: List[T]
    total: int
    page: int
    page_size: int
    pages: int


class OkResponse(NormalizedModel):
    detail: str
