"""Fixtures compartidos: cliente TestClient contra la app real (BD Supabase)."""

from __future__ import annotations

import pathlib
import sys

sys.path.insert(0, str(pathlib.Path(__file__).resolve().parents[1]))

import pytest
from fastapi.testclient import TestClient

from app.main import app

DEMO_EMAIL = 'admin@salesia.com'
DEMO_PASSWORD = 'admin123'


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
    response = client.post('/api/v1/auth/login', json={
        'email': 'vendedor@salesia.com', 'password': DEMO_PASSWORD,
    })
    assert response.status_code == 200, response.text
    return {'Authorization': f"Bearer {response.json()['access_token']}"}
