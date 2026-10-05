"""Base de schemas: normalización de cadenas de texto (hardening de entrada)."""

from __future__ import annotations

import re
from typing import Any, ClassVar

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

# Un carácter alfanumérico que NO sea dígito ni símbolo (letra unicode).
_LETTER_RE = re.compile(r'[^\W\d_]', re.UNICODE)


class NormalizedModel(BaseModel):
    """Modelo base que limpia las cadenas después de validarlas.

    - Recorta y colapsa los espacios internos de todo campo ``str``.
    - Los campos de correo (``email`` o terminados en ``email``) pasan a minúsculas.
    - Si al normalizar la cadena queda por debajo del ``min_length`` declarado
      (o vacía), se rechaza: una cadena de solo espacios nunca es válida.
    - Las subclases pueden declarar ``letter_required`` con los campos que,
      además, deben contener al menos una letra (rechaza "###", "123", "---").
    """

    letter_required: ClassVar[frozenset[str]] = frozenset()

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
        if normalized and field_name in cls.letter_required and not _LETTER_RE.search(normalized):
            raise ValueError('Debe contener al menos una letra')
        if field_name == 'email' or field_name.endswith('email'):
            normalized = normalized.lower()
        return normalized
