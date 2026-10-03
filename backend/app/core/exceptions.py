"""Excepciones de dominio y formato de error estándar (docs/02 §9, docs/05 §3)."""

from __future__ import annotations

from typing import Any, Dict, List, Optional


class AppError(Exception):
    """Base de todas las excepciones de negocio."""

    code = 'INTERNAL_ERROR'
    status_code = 500

    def __init__(
        self,
        message: str,
        detail: Optional[List[Dict[str, Any]]] = None,
        *,
        code: Optional[str] = None,
    ) -> None:
        super().__init__(message)
        self.message = message
        self.detail = detail or []
        if code:
            self.code = code

    def to_dict(self) -> Dict[str, Any]:
        payload: Dict[str, Any] = {'code': self.code, 'message': self.message}
        if self.detail:
            payload['detail'] = self.detail
        return payload


class NotFound(AppError):
    code = 'NOT_FOUND'
    status_code = 404


class Forbidden(AppError):
    code = 'FORBIDDEN'
    status_code = 403


class Unauthenticated(AppError):
    code = 'UNAUTHENTICATED'
    status_code = 401


class Conflict(AppError):
    code = 'CONFLICT'
    status_code = 409


class BusinessRuleError(AppError):
    code = 'BUSINESS_RULE_ERROR'
    status_code = 400


class ValidationAppError(AppError):
    code = 'VALIDATION_ERROR'
    status_code = 422


class RateLimited(AppError):
    code = 'RATE_LIMITED'
    status_code = 429


class BayesPorCero(AppError):
    code = 'BAYES_POR_CERO'
    status_code = 422


class DatosInsuficientes(AppError):
    code = 'DATOS_INSUFICIENTES'
    status_code = 400
