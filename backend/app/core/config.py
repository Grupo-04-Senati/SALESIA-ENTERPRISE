"""Configuración por variables de entorno (RNF-10, RN-36).

Busca `.env` subiendo desde el directorio actual hasta la raíz del
repositorio, de modo que funciona tanto con `uvicorn` desde `backend/`
como con `pytest` o scripts sueltos.
"""

from __future__ import annotations

from functools import lru_cache
from pathlib import Path
from typing import List

from pydantic import Field, field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


def _find_env_file() -> Path:
    here = Path(__file__).resolve()
    for directory in [here.parent, *here.parents]:
        candidate = directory / '.env'
        if candidate.is_file():
            return candidate
    return here.parent / '.env'


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=_find_env_file(), extra='ignore', case_sensitive=False)

    environment: str = 'development'
    debug: bool = True

    database_url: str
    secret_key: str
    algorithm: str = 'HS256'
    access_token_expire_minutes: int = 30
    refresh_token_expire_days: int = 7

    cors_origins: str = 'http://localhost:5173'
    cors_origin_regex: str = ''
    api_base_url: str = 'http://localhost:8000'
    vite_api_base_url: str = 'http://localhost:8000/api/v1'

    # Empresa dueña del storefront público (tienda web); si no existe se usa la primera.
    storefront_company_id: int = 1

    supabase_url: str = ''
    supabase_anon_key: str = ''
    supabase_service_role_key: str = ''
    supabase_jwt_secret: str = ''

    default_tax_rate: float = 0.18

    @field_validator('cors_origins', mode='before')
    @classmethod
    def _split_origins(cls, value: object) -> object:
        """Se acepta lista JSON o cadena separada por comas."""
        if isinstance(value, list):
            return ','.join(str(item) for item in value)
        return value

    @field_validator('environment')
    @classmethod
    def _valid_environment(cls, value: str) -> str:
        allowed = {'development', 'testing', 'production'}
        if value not in allowed:
            raise ValueError(f'ENVIRONMENT debe ser uno de {sorted(allowed)}')
        return value

    def cors_origin_list(self) -> List[str]:
        """CORS_ORIGINS como lista: 'http://a, http://b' → ['http://a', 'http://b']."""
        return [origin.strip() for origin in self.cors_origins.split(',') if origin.strip()]

    def cors_origin_regex_pattern(self) -> str | None:
        """CORS_ORIGIN_REGEX (p. ej. previews de Vercel) o None si está vacío."""
        return self.cors_origin_regex.strip() or None

    def model_post_init(self, __context: object) -> None:
        if self.environment == 'production' and self.debug:
            raise ValueError('DEBUG=true está prohibido en producción (docs/02 §10.1).')


@lru_cache
def get_settings() -> Settings:
    return Settings()


settings = get_settings()
