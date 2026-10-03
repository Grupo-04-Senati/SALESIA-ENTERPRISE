"""Validadores de reglas de negocio reutilizables (RN-*)."""

from __future__ import annotations

import re
from decimal import Decimal
from typing import Any, Iterable

from app.core.exceptions import BusinessRuleError, ValidationAppError

EMAIL_RE = re.compile(r'^[^@\s]+@[^@\s]+\.[^@\s]+$')


def require_probability(value: float, label: str) -> float:
    """Toda probabilidad ∈ [0,1] (docs/06 §8.3)."""
    if value != value or value < 0 or value > 1:
        raise ValidationAppError(f'{label} debe ser una probabilidad entre 0 y 1.')
    return value


def require_non_empty(values: Iterable[Any], minimum: int = 2) -> list[Any]:
    """RN-40: mínimo de observaciones; nunca se devuelve NaN."""
    items = list(values)
    if len(items) < minimum:
        raise BusinessRuleError(
            f'Datos insuficientes: se requieren al menos {minimum} observaciones.',
            code='DATOS_INSUFICIENTES',
        )
    return items


def valid_email(email: str) -> str:
    if email and not EMAIL_RE.match(email):
        raise ValidationAppError('El correo electrónico no tiene un formato válido.')
    return email
