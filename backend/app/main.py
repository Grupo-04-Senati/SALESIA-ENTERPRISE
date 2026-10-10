"""Aplicación FastAPI — SalesIA Enterprise (docs/02 §9 · docs/05 §3).

Arquitectura: React → FastAPI → PostgreSQL (Supabase).
"""

from __future__ import annotations

import logging
import re
from datetime import datetime, timezone

from fastapi import FastAPI, Request, status
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from app.api.v1.router import api_router
from app.core.config import settings
from app.core.exceptions import AppError

logging.basicConfig(
    level=logging.DEBUG if settings.debug else logging.INFO,
    format='%(asctime)s %(levelname)s %(name)s %(message)s',
)
logger = logging.getLogger('salesia')

app = FastAPI(
    title='SalesIA Enterprise API',
    version='1.0.0',
    description='API REST de SalesIA Enterprise (docs/05_api.md).',
    docs_url='/docs',
    openapi_url='/openapi.json',
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origin_list(),
    allow_origin_regex=settings.cors_origin_regex_pattern(),
    allow_credentials=True,
    allow_methods=['*'],
    allow_headers=['*'],
)

app.include_router(api_router, prefix='/api/v1')


# ------------------------------------------------------------------ errores

@app.exception_handler(AppError)
async def app_error_handler(request: Request, exc: AppError) -> JSONResponse:
    """Formato estándar: {code, message, detail?} (docs/05 §3)."""
    return JSONResponse(status_code=exc.status_code, content=exc.to_dict())


@app.exception_handler(RequestValidationError)
async def validation_error_handler(request: Request, exc: RequestValidationError) -> JSONResponse:
    detail = [
        {'field': '.'.join(str(part) for part in error.get('loc', ())), 'issue': error.get('msg', '')}
        for error in exc.errors()
    ]
    return JSONResponse(
        status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
        content={
            'code': 'VALIDATION_ERROR',
            'message': 'Error de validación en los datos enviados.',
            'detail': detail,
        },
    )


@app.exception_handler(Exception)
async def unhandled_error_handler(request: Request, exc: Exception) -> JSONResponse:
    logger.exception('Error no controlado en %s', request.url.path)
    response = JSONResponse(
        status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
        content={'code': 'INTERNAL_ERROR', 'message': 'Error interno del servidor.'},
    )
    # Este handler corre en ServerErrorMiddleware (fuera de CORSMiddleware):
    # sin estas cabeceras el navegador reporta el 500 como un bloqueo CORS.
    origin = request.headers.get('origin')
    if origin:
        allowed = origin in settings.cors_origin_list()
        pattern = settings.cors_origin_regex_pattern()
        if not allowed and pattern:
            allowed = re.fullmatch(pattern, origin) is not None
        if allowed:
            response.headers['Access-Control-Allow-Origin'] = origin
            response.headers['Access-Control-Allow-Credentials'] = 'true'
            response.headers['Vary'] = 'Origin'
    return response


# ------------------------------------------------------------------ salud

@app.get('/health', tags=['health'])
def health() -> dict:
    """Health check público (docs/05 §2.1)."""
    return {
        'status': 'ok',
        'service': 'salesia-api',
        'environment': settings.environment,
        'time': datetime.now(timezone.utc).isoformat(),
    }


@app.get('/', include_in_schema=False)
def root() -> dict:
    return {'service': 'SalesIA Enterprise API', 'docs': '/docs', 'base': '/api/v1'}
