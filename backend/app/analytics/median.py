"""Mediana (RF-12 · docs/06 §4 · RN-41).

1. Ordenar los valores de menor a mayor.
2. n impar  → valor central.
3. n par    → promedio de los dos centrales.
"""

from __future__ import annotations

from typing import Sequence

from app.utils.validators import require_non_empty


def median(values: Sequence[float]) -> float:
    data = sorted(float(value) for value in require_non_empty(values, minimum=2))
    middle = len(data) // 2
    if len(data) % 2 == 1:
        return data[middle]
    return (data[middle - 1] + data[middle]) / 2
