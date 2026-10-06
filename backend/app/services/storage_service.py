"""Imágenes de productos en Supabase Storage (bucket público `salesia-store`)."""

from __future__ import annotations

import re
import uuid

import httpx

from app.core.config import settings
from app.core.exceptions import ValidationAppError

BUCKET = 'salesia-store'

ALLOWED_TYPES = frozenset({
    'image/png',
    'image/jpeg',
    'image/webp',
    'image/gif',
    'image/svg+xml',
})
MAX_IMAGE_BYTES = 2_000_000

_EXT_BY_TYPE = {
    'image/png': '.png',
    'image/jpeg': '.jpg',
    'image/webp': '.webp',
    'image/gif': '.gif',
    'image/svg+xml': '.svg',
}

_SAFE_NAME_RE = re.compile(r'[^A-Za-z0-9._-]+')


def _client() -> tuple[str, dict[str, str]]:
    if not settings.supabase_url:
        raise ValidationAppError('Storage de imágenes no configurado (SUPABASE_URL).')
    token = settings.supabase_service_role_key or settings.supabase_publishable_key
    if not token:
        raise ValidationAppError('Storage de imágenes no configurado (clave de acceso).')
    headers = {'apikey': token, 'Authorization': f'Bearer {token}'}
    return settings.supabase_url.rstrip('/'), headers


def public_url(path: str) -> str:
    base, _ = _client()
    return f'{base}/storage/v1/object/public/{BUCKET}/{path}'


def upload_image(
    data: bytes,
    *,
    folder: str,
    name: str,
    content_type: str,
) -> str:
    """Sube una imagen y devuelve su URL pública. ``name`` fija la ruta (idempotente)."""
    ctype = (content_type or '').split(';')[0].strip().lower()
    if ctype not in ALLOWED_TYPES:
        raise ValidationAppError('Formato de imagen no soportado (PNG, JPG, WEBP, GIF o SVG).')
    if len(data) > MAX_IMAGE_BYTES:
        raise ValidationAppError('La imagen supera el máximo de 2 MB.')
    if not data:
        raise ValidationAppError('La imagen está vacía.')

    safe = _SAFE_NAME_RE.sub('-', (name or '').strip()).strip('-._') or uuid.uuid4().hex
    ext = _EXT_BY_TYPE[ctype]
    if not safe.lower().endswith(ext):
        safe = f'{safe}{ext}'
    path = f'{folder.strip("/")}/{safe}'

    base, headers = _client()
    response = httpx.post(
        f'{base}/storage/v1/object/{BUCKET}/{path}',
        headers={**headers, 'Content-Type': ctype, 'x-upsert': 'true'},
        content=data,
        timeout=60,
    )
    if response.status_code >= 400:
        raise ValidationAppError('No se pudo subir la imagen al almacenamiento.')
    return public_url(path)


def delete_image(path: str) -> None:
    base, headers = _client()
    httpx.delete(
        f'{base}/storage/v1/object/{BUCKET}/{path.strip("/")}',
        headers=headers,
        timeout=30,
    )
