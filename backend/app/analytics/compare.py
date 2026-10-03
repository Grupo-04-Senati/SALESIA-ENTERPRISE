"""Comparación media vs. mediana (RF-13 · docs/06 §5 · RN-42)."""

from __future__ import annotations

from typing import Any, Dict, Sequence

from app.analytics.mean import mean
from app.analytics.median import median

SYMMETRY_THRESHOLD_PCT = 5.0


def compare(values: Sequence[float]) -> Dict[str, Any]:
    mean_value = mean(values)
    median_value = median(values)
    difference = round(mean_value - median_value, 2)
    difference_pct = round((difference / median_value) * 100, 2) if median_value else 0.0

    if abs(difference_pct) < SYMMETRY_THRESHOLD_PCT:
        interpretation = 'Media y mediana son muy parecidas: la distribución es casi simétrica.'
    elif difference > 0:
        interpretation = (
            'La media supera a la mediana: la distribución tiene cola derecha '
            '(algunas ventas muy altas elevan el promedio).'
        )
    else:
        interpretation = (
            'La mediana supera a la media: la distribución tiene cola izquierda '
            '(las ventas pequeñas bajan el promedio).'
        )

    return {
        'mean': round(mean_value, 2),
        'median': round(median_value, 2),
        'difference': difference,
        'difference_pct': difference_pct,
        'interpretation': interpretation,
    }
