"""Media aritmética (RF-11 · docs/06 §3).

media = (x₁ + x₂ + … + xₙ) / n
"""

from __future__ import annotations

from typing import Sequence

from app.utils.validators import require_non_empty


def mean(values: Sequence[float]) -> float:
    """Media aritmética. RN-40: exige al menos 2 observaciones (nunca NaN)."""
    data = [float(value) for value in require_non_empty(values, minimum=2)]
    return sum(data) / len(data)


def describe(values: Sequence[float]) -> dict[str, float]:
    """Estadísticos básicos compartidos por los endpoints de métrica."""
    from app.analytics.median import median

    data = [float(value) for value in require_non_empty(values, minimum=2)]
    return {
        'mean': mean(data),
        'median': median(data),
        'min': min(data),
        'max': max(data),
        'count': float(len(data)),
        'sum': sum(data),
    }
