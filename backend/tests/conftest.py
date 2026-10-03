"""Fixtures compartidos: cliente TestClient contra la app real (BD Supabase).

Las pruebas de API e integración **escriben datos** en la base configurada en
DATABASE_URL. Para no tocar producción por accidente solo corren si se define
RUN_DB_TESTS=1; las unitarias (`tests/unit`) no dependen de la base.
"""

from __future__ import annotations

import os
import pathlib
import sys

sys.path.insert(0, str(pathlib.Path(__file__).resolve().parents[1]))

import pytest
from fastapi.testclient import TestClient

from app.main import app

DEMO_EMAIL = 'admin@salesia.com'
DEMO_PASSWORD = 'admin123'

RUN_DB_TESTS = os.getenv('RUN_DB_TESTS') == '1'
requires_db = pytest.mark.skipif(
    not RUN_DB_TESTS,
    reason='Pruebas que escriben en la BD: ejecuta con RUN_DB_TESTS=1 (nunca contra producción).',
)


@pytest.fixture(scope='session')
def client() -> TestClient:
    with TestClient(app) as test_client:
        yield test_client


@pytest.fixture(scope='session')
def admin_token(client: TestClient) -> str:
    response = client.post('/api/v1/auth/login', json={
        'email': DEMO_EMAIL, 'password': DEMO_PASSWORD,
    })
    assert response.status_code == 200, response.text
    return response.json()['access_token']


@pytest.fixture(scope='session')
def admin_headers(admin_token: str) -> dict:
    return {'Authorization': f'Bearer {admin_token}'}


@pytest.fixture(scope='session')
def vendedor_headers(client: TestClient) -> dict:
    """El usuario vendedor es opcional: si no existe, se omiten esos tests."""
    response = client.post('/api/v1/auth/login', json={
        'email': 'vendedor@salesia.com', 'password': DEMO_PASSWORD,
    })
    if response.status_code != 200:
        pytest.skip('El usuario vendedor@salesia.com no existe en esta base de datos.')
    return {'Authorization': f"Bearer {response.json()['access_token']}"}


_DB_FIXTURES = {'client', 'admin_token', 'admin_headers', 'vendedor_headers'}


def pytest_collection_modifyitems(config, items) -> None:
    """Omit automáticamente las pruebas que tocan la base si no se piden."""
    if RUN_DB_TESTS:
        return
    marker = pytest.mark.skip(reason=requires_db.__doc__ or 'requiere RUN_DB_TESTS=1')
    for item in items:
        if _DB_FIXTURES.intersection(item.fixturenames):
            item.add_marker(marker)
