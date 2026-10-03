"""RF-08 · inventario y kardex (RN-20 · RN-24 · RN-38)."""

from __future__ import annotations


def _first_product(client, headers):
    response = client.get('/api/v1/products?page=1&page_size=1', headers=headers)
    assert response.status_code == 200
    return response.json()['items'][0]


def test_listado_de_existencias(client, admin_headers):
    response = client.get('/api/v1/inventory', headers=admin_headers)
    assert response.status_code == 200
    body = response.json()
    rows = body['items'] if isinstance(body, dict) else body
    assert rows
    assert {'product_id', 'sku', 'current_stock', 'min_stock'} <= set(rows[0].keys())


def test_alertas_rn24(client, admin_headers):
    response = client.get('/api/v1/inventory/alerts', headers=admin_headers)
    assert response.status_code == 200
    body = response.json()
    rows = body if isinstance(body, list) else body.get('items', [])
    # La semilla incluye productos con stock por debajo del mínimo.
    assert len(rows) >= 1
    assert all(row['current_stock'] <= row['min_stock'] for row in rows)


def test_kardex_con_movimientos_previos(client, admin_headers):
    product = _first_product(client, admin_headers)
    response = client.get(f"/api/v1/inventory/{product['id']}/movements", headers=admin_headers)
    assert response.status_code == 200
    body = response.json()
    rows = body if isinstance(body, list) else body.get('items', [])
    assert len(rows) >= 1
    assert rows[0]['type'].lower() in {'in', 'out', 'return', 'shrinkage', 'adjustment'}


def test_vendedor_no_puede_registrar_movimientos(client, vendedor_headers):
    product = _first_product(client, vendedor_headers)
    response = client.post('/api/v1/inventory/movements', headers=vendedor_headers, json={
        'product_id': product['id'], 'type': 'IN', 'quantity': 1,
        'reason': 'No debería permitirse',
    })
    assert response.status_code == 403


def test_entrada_y_salida_ajustan_el_stock(client, admin_headers):
    product = _first_product(client, admin_headers)
    stock_inicial = client.get(f"/api/v1/inventory/{product['id']}", headers=admin_headers).json()

    entrada = client.post('/api/v1/inventory/movements', headers=admin_headers, json={
        'product_id': product['id'], 'type': 'IN', 'quantity': 3,
        'reason': 'Reposición de prueba automatizada',
    })
    assert entrada.status_code == 201, entrada.text
    assert entrada.json()['resulting_stock'] == stock_inicial['current_stock'] + 3

    salida = client.post('/api/v1/inventory/movements', headers=admin_headers, json={
        'product_id': product['id'], 'type': 'OUT', 'quantity': 3,
        'reason': 'Salida de prueba automatizada',
    })
    assert salida.status_code == 201, salida.text

    stock_final = client.get(f"/api/v1/inventory/{product['id']}", headers=admin_headers).json()
    assert stock_final['current_stock'] == stock_inicial['current_stock']


def test_merma_con_motivo_obligatorio(client, admin_headers):
    product = _first_product(client, admin_headers)
    response = client.post('/api/v1/inventory/movements', headers=admin_headers, json={
        'product_id': product['id'], 'type': 'SHRINKAGE', 'quantity': 1,
        'reason': 'Merma por vencimiento (prueba automatizada)',
    })
    assert response.status_code == 201
    # Se repone inmediatamente para no alterar el stock de la demo.
    client.post('/api/v1/inventory/movements', headers=admin_headers, json={
        'product_id': product['id'], 'type': 'RETURN', 'quantity': 1,
        'reason': 'Reposición tras merma de prueba',
    })
