"""Probabilidad básica (RF-16 · docs/06 §7).

P(A) = casos favorables / casos posibles
P(Aᶜ) = 1 − P(A) · P(A ∪ B) = P(A) + P(B) − P(A ∩ B)
"""

from __future__ import annotations

from typing import Any, Dict

from app.core.exceptions import ValidationAppError


def _check(value: float, label: str) -> float:
    number = float(value)
    if number != number or number < 0 or number > 1:
        raise ValidationAppError(f'{label} debe ser una probabilidad entre 0 y 1.')
    return number


def basic(p_a: float, p_b: float, p_intersection: float) -> Dict[str, Any]:
    """Probabilidades simples, conjunta, complementaria, unión y condicional."""
    a = _check(p_a, 'P(A)')
    b = _check(p_b, 'P(B)')
    both = _check(p_intersection, 'P(A ∩ B)')

    if both > min(a, b) + 1e-9:
        raise ValidationAppError('P(A ∩ B) no puede superar a P(A) ni a P(B).')

    union = a + b - both
    conditional = both / a if a > 0 else 0.0
    return {
        'p_a': round(a, 4),
        'p_b': round(b, 4),
        'p_a_complement': round(1 - a, 4),
        'p_b_complement': round(1 - b, 4),
        'p_intersection': round(both, 4),
        'p_union': round(min(union, 1.0), 4),
        'p_b_given_a': round(conditional, 4),
        'summary': (
            f'P(A ∪ B) = {round(min(union, 1.0), 4)} · '
            f'P(B|A) = {round(conditional, 4)}'
        ),
    }
