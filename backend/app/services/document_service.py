"""Consulta de documentos RUC/DNI contra la API de apiperu (opcional).

Si `APIPERU_TOKEN` no está definido, la consulta externa se omite y solo se
responde con lo que ya existe en la base local. Nunca lanza excepciones: el
formulario de cliente siempre puede completarse a mano.
"""

from __future__ import annotations

import os
from typing import Optional

import httpx

from app.models.customer import Customer
from sqlalchemy import select
from sqlalchemy.orm import Session

API_BASE = 'https://api.apiperu.dev/api'
TIMEOUT = 8.0


def _local_customer(db: Session, company_id: int, document_number: str) -> Optional[Customer]:
    return db.execute(
        select(Customer).where(
            Customer.company_id == company_id,
            Customer.document_number == document_number,
        )
    ).scalar_one_or_none()


def _call_external(document_type: str, document_number: str) -> Optional[dict]:
    token = os.getenv('APIPERU_TOKEN', '').strip()
    if not token:
        return None
    path = 'ruc' if document_type == 'RUC' else 'dni'
    url = f'{API_BASE}/{path}/{document_number}'
    try:
        response = httpx.get(url, headers={'Authorization': f'Bearer {token}'}, timeout=TIMEOUT)
        if response.status_code != 200:
            return None
        data = response.json().get('data') or {}
    except (httpx.HTTPError, ValueError):
        return None

    if document_type == 'RUC':
        return {
            'document_type': 'RUC',
            'document_number': str(data.get('ruc') or document_number),
            'name': (data.get('razon_social') or '').strip(),
            'address': (data.get('direccion') or '').strip(),
        }
    nombre = ' '.join(
        part for part in [data.get('apellido_paterno'), data.get('apellido_materno'), data.get('nombres')] if part
    ).strip()
    return {
        'document_type': 'DNI',
        'document_number': str(data.get('dni') or document_number),
        'name': nombre,
        'address': '',
    }


def lookup_document(db: Session, company_id: int, document: str) -> dict:
    document = document.strip()
    document_type = 'RUC' if len(document) == 11 else 'DNI'

    local = _local_customer(db, company_id, document)
    if local is not None:
        return {
            'found': True,
            'source': 'local',
            'document_type': local.document_type,
            'document_number': local.document_number,
            'name': local.name,
            'address': local.address or '',
        }

    remote = _call_external(document_type, document)
    if remote:
        remote['found'] = True
        remote['source'] = 'api'
        return remote

    return {
        'found': False,
        'source': 'none',
        'document_type': document_type,
        'document_number': document,
        'name': '',
        'address': '',
    }
