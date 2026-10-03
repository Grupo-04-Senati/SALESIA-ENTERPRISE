"""Variables aleatorias (RF-15 · docs/06 §6).

Discreta: valores contables con probabilidad asociada (frecuencias relativas).
Continua: se describe con histograma y estadísticos.
"""

from __future__ import annotations

from collections import Counter
from typing import Any, Dict, List, Sequence

from app.analytics.mean import mean
from app.analytics.median import median
from app.utils.validators import require_non_empty


def analyze(values: Sequence[Any], distribution: str = 'discrete') -> Dict[str, Any]:
    """Distribución de frecuencias, valor esperado y varianza muestral."""
    data = [float(value) for value in require_non_empty(values, minimum=2)]
    expected = mean(data)
    variance = sum((value - expected) ** 2 for value in data) / len(data)

    counts = Counter(data)
    possible_values = sorted(counts)
    probabilities = [round(counts[value] / len(data), 4) for value in possible_values]

    return {
        'distribution': 'discrete' if distribution in ('', 'discrete', 'discreta') else distribution,
        'count': len(data),
        'possible_values': possible_values,
        'probabilities': probabilities,
        'distribution_rows': [
            {'value': value, 'frequency': counts[value], 'probability': counts[value] / len(data)}
            for value in possible_values
        ],
        'expected_value': round(expected, 4),
        'mean': round(expected, 4),
        'median': round(median(data), 4),
        'variance': round(variance, 4),
        'summary': (
            f'La media es {round(expected, 4)} con varianza {round(variance, 4)} '
            f'sobre {len(data)} observaciones.'
        ),
    }
