"""Permisos de rol: matriz de módulos/submódulos editable por Admin (RF-02)."""

from __future__ import annotations

VENDEDOR_DEFAULT_MODULES = [
    '/dashboard', '/ventas', '/clientes', '/cotizaciones',
    '/devoluciones', '/productos', '/precios',
]


def _role_id(client, admin_headers, name: str) -> int:
    roles = client.get('/api/v1/roles', headers=admin_headers).json()['items']
    return next(role['id'] for role in roles if role['name'] == name)


def _put_permissions(client, admin_headers, role_id: int, payload: dict):
    return client.put(
        f'/api/v1/roles/{role_id}/permissions', headers=admin_headers, json=payload,
    )


def test_admin_actualiza_permisos_de_vendedor(client, admin_headers):
    role_id = _role_id(client, admin_headers, 'Vendedor')
    response = _put_permissions(
        client, admin_headers, role_id,
        {'modules': ['/ventas', '/dashboard'], 'submodules': {}},
    )
    assert response.status_code == 200, response.text
    body = response.json()
    assert body['name'] == 'Vendedor'
    assert body['permissions'] == {'modules': ['/dashboard', '/ventas'], 'submodules': {}}

    roles = client.get('/api/v1/roles', headers=admin_headers).json()['items']
    stored = next(role for role in roles if role['id'] == role_id)
    assert stored['permissions']['modules'] == ['/dashboard', '/ventas']


def test_vendedor_no_puede_editar_permisos(client, admin_headers, vendedor_headers):
    role_id = _role_id(client, admin_headers, 'Vendedor')
    response = _put_permissions(
        client, vendedor_headers, role_id, {'modules': ['/dashboard']},
    )
    assert response.status_code == 403


def test_modulo_desconocido_rechazado(client, admin_headers):
    role_id = _role_id(client, admin_headers, 'Vendedor')
    response = _put_permissions(
        client, admin_headers, role_id, {'modules': ['/dashboard', '/noexiste']},
    )
    assert response.status_code == 422


def test_submodulos_validos_se_guardan_ordenados(client, admin_headers):
    role_id = _role_id(client, admin_headers, 'Almacén')
    response = _put_permissions(
        client, admin_headers, role_id,
        {
            'modules': ['/inventario', '/productos'],
            'submodules': {
                '/inventario': ['sucursales', 'existencias'],
                '/productos': ['productos'],
            },
        },
    )
    assert response.status_code == 200, response.text
    permissions = response.json()['permissions']
    assert permissions['modules'] == ['/inventario', '/productos']
    assert permissions['submodules'] == {
        '/inventario': ['existencias', 'sucursales'],
        '/productos': ['productos'],
    }


def test_submodulo_desconocido_rechazado(client, admin_headers):
    role_id = _role_id(client, admin_headers, 'Vendedor')
    response = _put_permissions(
        client, admin_headers, role_id,
        {'modules': ['/inventario'], 'submodules': {'/inventario': ['noexiste']}},
    )
    assert response.status_code == 422


def test_submodulo_de_modulo_no_marcado_rechazado(client, admin_headers):
    role_id = _role_id(client, admin_headers, 'Vendedor')
    response = _put_permissions(
        client, admin_headers, role_id,
        {'modules': ['/ventas'], 'submodules': {'/inventario': ['existencias']}},
    )
    assert response.status_code == 422


def test_rol_admin_no_es_editable(client, admin_headers):
    role_id = _role_id(client, admin_headers, 'Admin')
    response = _put_permissions(
        client, admin_headers, role_id, {'modules': ['/dashboard']},
    )
    assert response.status_code == 422


def test_modulos_vacios_rechazados(client, admin_headers):
    role_id = _role_id(client, admin_headers, 'Vendedor')
    response = _put_permissions(client, admin_headers, role_id, {'modules': []})
    assert response.status_code == 422


def test_me_refleja_permisos_configurados(client, admin_headers, vendedor_headers):
    role_id = _role_id(client, admin_headers, 'Vendedor')
    _put_permissions(
        client, admin_headers, role_id,
        {
            'modules': ['/dashboard', '/ventas', '/productos'],
            'submodules': {'/productos': ['productos', 'categorias']},
        },
    )
    me = client.get('/api/v1/auth/me', headers=vendedor_headers).json()
    assert me['role'] == 'Vendedor'
    assert me['modules'] == ['/dashboard', '/productos', '/ventas']
    assert me['submodules'] == {'/productos': ['categorias', 'productos']}


def test_almacen_puede_leer_compras(client, admin_headers):
    """Regresión del fix de roles: Almacén ve Compras/Proveedores (recepción de OC)."""
    login = client.post(
        '/api/v1/auth/login',
        json={'email': 'almacen@salesia.com', 'password': 'admin123'},
    )
    assert login.status_code == 200, login.text
    headers = {'Authorization': f"Bearer {login.json()['access_token']}"}
    orders = client.get('/api/v1/purchase-orders', headers=headers)
    assert orders.status_code == 200, orders.text
    suppliers = client.get('/api/v1/suppliers', headers=headers)
    assert suppliers.status_code == 200, suppliers.text


def test_restaurar_defaults_de_vendedor(client, admin_headers):
    """Deja el JSONB del rol Vendedor en su matriz por defecto tras los tests."""
    role_id = _role_id(client, admin_headers, 'Vendedor')
    response = _put_permissions(
        client, admin_headers, role_id, {'modules': VENDEDOR_DEFAULT_MODULES},
    )
    assert response.status_code == 200, response.text
    assert response.json()['permissions']['submodules'] == {}
