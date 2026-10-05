"""Base de schemas: normalización de cadenas de texto (hardening de entrada)."""

from __future__ import annotations

from typing import Any

from pydantic import BaseModel, ValidationInfo, field_validator

# Campos donde recortar/colapsar espacios rompería la semántica del valor.
SKIP_NORMALIZE = frozenset({
    'password',
    'current_password',
    'new_password',
    'refresh_token',
    'token',
    'reset_token',
    'avatar',
})


class NormalizedModel(BaseModel):
    """Modelo base que limpia las cadenas después de validarlas.

    - Recorta y colapsa los espacios internos de todo campo ``str``.
    - Los campos de correo (``email`` o terminados en ``email``) pasan a minúsculas.
    - Si al normalizar la cadena queda por debajo del ``min_length`` declarado
      (o vacía), se rechaza: una cadena de solo espacios nunca es válida.
    """

    @field_validator('*', mode='after')
    @classmethod
    def _normalize_string(cls, value: Any, info: ValidationInfo) -> Any:
        field_name = info.field_name
        if field_name in SKIP_NORMALIZE or not isinstance(value, str):
            return value
        normalized = ' '.join(value.split())
        field = cls.model_fields.get(field_name)
        for constraint in getattr(field, 'metadata', ()) if field else ():
            min_length = getattr(constraint, 'min_length', None)
            if min_length is not None and len(normalized) < min_length:
                raise ValueError(f'String should have at least {min_length} characters')
        if not normalized and value:
            raise ValueError('El campo no puede contener solo espacios.')
        if field_name == 'email' or field_name.endswith('email'):
            normalized = normalized.lower()
        return normalized
