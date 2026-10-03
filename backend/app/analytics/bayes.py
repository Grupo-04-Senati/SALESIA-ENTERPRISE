"""Teorema de Bayes (RF-17 · docs/06 §8 · RN-43, RN-49).

P(A|B) = P(B|A) · P(A) / P(B)
"""

from __future__ import annotations

from typing import Any, Dict, List

from app.core.exceptions import BayesPorCero, ValidationAppError


def _check_probability(value: float, label: str) -> float:
    try:
        number = float(value)
    except (TypeError, ValueError) as exc:
        raise ValidationAppError(f'{label} debe ser un número entre 0 y 1.') from exc
    if number != number or number < 0 or number > 1:
        raise ValidationAppError(f'{label} debe ser una probabilidad entre 0 y 1.')
    return number


def bayes(prior: float, likelihood: float, evidence: float) -> Dict[str, Any]:
    """Devuelve el posterior con su fórmula, explicación y pasos (RF-17)."""
    p_a = _check_probability(prior, 'P(A)')
    p_b_given_a = _check_probability(likelihood, 'P(B|A)')
    p_b = _check_probability(evidence, 'P(B)')

    if p_b == 0:
        raise BayesPorCero('P(B) = 0: la evidencia es imposible, el posterior no está definido (RN-43).')

    joint = p_b_given_a * p_a
    posterior = joint / p_b

    change_pct = round((posterior - p_a) * 100, 2)
    if posterior >= p_a:
        reading = (
            f'Si ocurre B, la probabilidad de A pasa de {round(p_a * 100, 2)}% a '
            f'{round(posterior * 100, 2)}% (la evidencia aumenta la probabilidad de A).'
        )
    else:
        reading = (
            f'Si ocurre B, la probabilidad de A baja de {round(p_a * 100, 2)}% a '
            f'{round(posterior * 100, 2)}% (la evidencia disminuye la probabilidad de A).'
        )

    steps: List[str] = [
        f'P(B ∩ A) = P(B|A) × P(A) = {round(p_b_given_a, 4)} × {round(p_a, 4)} = {round(joint, 4)}',
        f'P(A|B) = P(B ∩ A) / P(B) = {round(joint, 4)} / {round(p_b, 4)} = {round(posterior, 4)}',
        reading,
    ]

    return {
        # Forma del frontend (types/statistics.ts BayesResult)
        'posterior': round(posterior, 4),
        'prior': round(p_a, 4),
        'likelihood': round(p_b_given_a, 4),
        'evidence': round(p_b, 4),
        'joint': round(joint, 4),
        'steps': steps,
        # Forma de docs/05_api.md §2.9
        'p_a': round(p_a, 4),
        'p_b_given_a': round(p_b_given_a, 4),
        'p_b': round(p_b, 4),
        'p_a_given_b': round(posterior, 4),
        'formula': 'P(A|B) = P(B|A)·P(A) / P(B)',
        'explanation': reading,
        'change_pct': change_pct,
    }
