"""Utilidades comunes del backend."""

from __future__ import annotations

from datetime import datetime, timezone
from decimal import Decimal, ROUND_HALF_UP
from typing import Any, Dict, Iterable, List, Sequence

TWO_PLACES = Decimal('0.01')
FOUR_PLACES = Decimal('0.0001')


def money(value: Any) -> Decimal:
    """Redondea a 2 decimales con HALF_UP (montos)."""
    return Decimal(str(value)).quantize(TWO_PLACES, rounding=ROUND_HALF_UP)


def round4(value: Any) -> Decimal:
    return Decimal(str(value)).quantize(FOUR_PLACES, rounding=ROUND_HALF_UP)


def utcnow() -> datetime:
    return datetime.now(timezone.utc)


def as_float(value: Any) -> float:
    """Decimal/entero → float para los DTO JSON."""
    if isinstance(value, Decimal):
        return float(value)
    if value is None:
        return 0.0
    return float(value)


def paginate(items: Sequence[Any], page: int, page_size: int) -> Dict[str, Any]:
    """Envoltura de listado: {items, total, page, page_size, pages} (docs/05 §1)."""
    total = len(items)
    pages = max(1, -(-total // page_size))
    start = (page - 1) * page_size
    return {
        'items': list(items[start : start + page_size]),
        'total': total,
        'page': page,
        'page_size': page_size,
        'pages': pages,
    }


def clamp_page(page: int, page_size: int, maximum: int = 100) -> tuple[int, int]:
    return max(1, page), min(max(1, page_size), maximum)
