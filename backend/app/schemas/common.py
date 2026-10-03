"""Tipos comunes: paginación y respuestas de error (docs/05 §1, §3)."""

from __future__ import annotations

from typing import Generic, List, TypeVar

from pydantic import BaseModel

T = TypeVar('T')


class Page(BaseModel, Generic[T]):
    """Envoltura estándar de listados."""

    items: List[T]
    total: int
    page: int
    page_size: int
    pages: int


class OkResponse(BaseModel):
    detail: str
