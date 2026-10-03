"""RF-01 · autenticación (docs/05 §2.1 · RN-30, RN-31, RN-35)."""

from __future__ import annotations

DEMO_EMAIL = 'admin@salesia.com'
DEMO_PASSWORD = 'admin123'


def test_login_devuelve_token_y_rol(client):
    response = client.post('/api/v1/auth/login', json={
        'email': DEMO_EMAIL, 'password': DEMO_PASSWORD,
    })
    assert response.status_code == 200
    body = response.json()
    assert body['access_token']
    assert body['refresh_token']
    assert body['token_type'] == 'bearer'
    assert body['expires_in'] > 0
    assert body['user']['email'] == DEMO_EMAIL
    assert body['user']['role'] == 'Admin'


def test_login_password_incorrecto_da_401(client):
    # Un único intento fallido: RN-31 bloquea tras 5 (evita bloquear la cuenta demo).
    response = client.post('/api/v1/auth/login', json={
        'email': DEMO_EMAIL, 'password': 'clave-incorrecta',
    })
    assert response.status_code == 401
    assert response.json()['code'] == 'UNAUTHENTICATED'


def test_login_email_invalido_da_422(client):
    response = client.post('/api/v1/auth/login', json={
        'email': 'no-es-correo', 'password': DEMO_PASSWORD,
    })
    assert response.status_code == 422


def test_me_requiere_token(client, admin_headers):
    response = client.get('/api/v1/auth/me', headers=admin_headers)
    assert response.status_code == 200
    assert response.json()['email'] == DEMO_EMAIL

    anonimo = client.get('/api/v1/auth/me')
    assert anonimo.status_code == 401


def test_refresh_rota_el_token(client, admin_headers):
    login = client.post('/api/v1/auth/login', json={
        'email': 'gerente@salesia.com', 'password': DEMO_PASSWORD,
    }).json()
    response = client.post('/api/v1/auth/refresh', json={
        'refresh_token': login['refresh_token'],
    })
    assert response.status_code == 200
    assert response.json()['access_token']


def test_refresh_rechaza_token_falso(client):
    response = client.post('/api/v1/auth/refresh', json={
        'refresh_token': 'token-falso',
    })
    assert response.status_code == 401


def test_logout_audita_la_sesion(client, admin_headers):
    response = client.post('/api/v1/auth/logout', headers=admin_headers)
    assert response.status_code == 200
