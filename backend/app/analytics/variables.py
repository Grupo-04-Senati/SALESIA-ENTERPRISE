"""Clasificación de variables estadísticas (RF-14 · docs/06 §2 · RN-46).

Cualitativas: nominal u ordinal · Cuantitativas: discreta o continua.
"""

from __future__ import annotations

from collections import Counter
from typing import Any, Dict, List, Sequence


def _is_numeric(value: Any) -> bool:
    return isinstance(value, (int, float)) and not isinstance(value, bool)


def classify_variable(name: str, values: Sequence[Any]) -> Dict[str, Any]:
    """Clasifica una columna y calcula sus estadísticos o frecuencias."""
    data = [value for value in values if value is not None]
    numeric = [float(value) for value in data if _is_numeric(value)]

    if len(numeric) == len(data) and data:
        integer_like = all(value == int(value) for value in numeric)
        from app.analytics.mean import mean
        from app.analytics.median import median

        return {
            'name': name,
            'type': 'quantitative',
            'subtype': 'discrete' if integer_like else 'continuous',
            'count': len(numeric),
            'mean': round(mean(numeric), 4),
            'median': round(median(numeric), 4),
            'min': min(numeric),
            'max': max(numeric),
        }

    counts = Counter(str(value) for value in data)
    total = len(data) or 1
    frequencies: List[Dict[str, Any]] = [
        {'value': value, 'count': count, 'pct': round(count / total * 100, 2)}
        for value, count in counts.most_common()
    ]
    return {
        'name': name,
        'type': 'qualitative',
        'subtype': 'nominal',
        'count': len(data),
        'frequencies': frequencies,
    }
