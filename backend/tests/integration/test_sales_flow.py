"""RF-06 · flujo completo de ventas (RN-10, RN-11, RN-20, RN-22, RN-37)."""

from __future__ import annotations


def _first(client, path, headers, query=''):
    response = client.get(f'{path}?page=1&page_size=1{query}', headers=headers)
    assert response.status_code == 200, response.text
    items = response.json()['items']
    assert items, f'La semilla no dejó datos en {path}'
    return items[0]


def _payload(client, headers, quantity=2, amount=5.0):
    product = _first(client, '/api/v1/products', headers, '&status=active')
    customer = _first(client, '/api/v1/customers', headers, '&status=active')
    employees = client.get('/api/v1/employees', headers=headers).json()
    seller = employees[0] if isinstance(employees, list) else employees['items'][0]
    return product, {
        'customer_id': customer['id'],
        'seller_id': seller['id'],
        'items': [{'product_id': product['id'], 'quantity': quantity,
                   'unit_price': float(product['sale_price']), 'discount': 0}],
        'payment': {'method': 'cash', 'amount': amount},
    }


def test_crear_venta_calcula_totales_rn11(client, admin_headers):
    product, payload = _payload(client, admin_headers)
    stock_antes = client.get(f"/api/v1/inventory/{product['id']}", headers=admin_headers).json()

    response = client.post('/api/v1/sales', headers=admin_headers, json=payload)
    assert response.status_code == 201, response.text
    sale = response.json()

    unit = float(product['sale_price'])
    esperado_subtotal = round(unit * 2, 2)
    esperado_total = round(esperado_subtotal * 1.18, 2)
    assert sale['sale_number'].startswith('V-20')
    assert abs(sale['subtotal'] - esperado_subtotal) < 0.01
    assert abs(sale['tax'] - round(esperado_subtotal * 0.18, 2)) < 0.01
    assert abs(sale['total'] - esperado_total) < 0.01
    assert sale['status'] == 'partial'  # pagó S/5.00 de S/11.80
    assert sale['balance'] > 0
    assert sale['inventory_updated'] is True

    # RN-20: el stock se descontó exactamente las unidades vendidas.
    stock_despues = client.get(f"/api/v1/inventory/{product['id']}", headers=admin_headers).json()
    assert stock_antes['current_stock'] - stock_despues['current_stock'] == 2

    # RN-22: al anular, el stock vuelve al valor previo.
    cancelada = client.post(f"/api/v1/sales/{sale['id']}/cancel", headers=admin_headers, json={
        'reason': 'Anulación de prueba automatizada',
    })
    assert cancelada.status_code == 200, cancelada.text
    stock_final = client.get(f"/api/v1/inventory/{product['id']}", headers=admin_headers).json()
    assert stock_final['current_stock'] == stock_antes['current_stock']

    detalle = client.get(f"/api/v1/sales/{sale['id']}", headers=admin_headers)
    assert detalle.status_code == 200
    assert detalle.json()['status'] == 'cancelled'


def test_venta_sin_pago_queda_pendiente(client, admin_headers):
    _, payload = _payload(client, admin_headers, quantity=1, amount=100.0)
    payload['payment'] = None
    response = client.post('/api/v1/sales', headers=admin_headers, json=payload)
    assert response.status_code == 201
    assert response.json()['status'] == 'pending'
    assert response.json()['balance'] == response.json()['total']

    client.post(f"/api/v1/sales/{response.json()['id']}/cancel", headers=admin_headers, json={
        'reason': 'Limpieza de prueba automatizada',
    })


def test_analista_no_puede_registrar_ventas(client, admin_headers, vendedor_headers):
    # El rol Analista no está en sell_roles (docs/01 §4.1).
    login = client.post('/api/v1/auth/login', json={
        'email': 'analista@salesia.com', 'password': 'admin123',
    })
    assert login.status_code == 200
    headers = {'Authorization': f"Bearer {login.json()['access_token']}"}
    _, payload = _payload(client, admin_headers)
    response = client.post('/api/v1/sales', headers=headers, json=payload)
    assert response.status_code == 403


def test_vendedor_si_puede_registrar_ventas(client, admin_headers, vendedor_headers):
    product = _first(client, '/api/v1/products', vendedor_headers, '&status=active')
    customer = _first(client, '/api/v1/customers', vendedor_headers, '&status=active')
    # El rol Vendedor no lee vendedores (docs/01 §4.1): se toma el vendedor con admin.
    employees = client.get('/api/v1/employees', headers=admin_headers).json()
    seller = employees[0] if isinstance(employees, list) else employees['items'][0]

    # RN-11: total = subtotal + ROUND(subtotal * 0.18, 2) — igual que el backend.
    unit = float(product['sale_price'])
    total = round(unit + round(unit * 0.18, 2), 2)
    response = client.post('/api/v1/sales', headers=vendedor_headers, json={
        'customer_id': customer['id'],
        'seller_id': seller['id'],
        'items': [{'product_id': product['id'], 'quantity': 1,
                   'unit_price': unit, 'discount': 0}],
        'payment': {'method': 'cash', 'amount': total},
    })
    assert response.status_code == 201, response.text
    assert response.json()['status'] == 'paid'

    client.post(f"/api/v1/sales/{response.json()['id']}/cancel", headers=vendedor_headers, json={
        'reason': 'Limpieza de prueba automatizada',
    })


def test_listado_y_filtros_de_ventas(client, admin_headers):
    response = client.get('/api/v1/sales?page=1&page_size=5', headers=admin_headers)
    assert response.status_code == 200
    body = response.json()
    assert body['total'] >= 45
    assert len(body['items']) == 5

    filtradas = client.get('/api/v1/sales?status=paid&page_size=5', headers=admin_headers)
    assert filtradas.status_code == 200
    assert all(item['status'] == 'paid' for item in filtradas.json()['items'])
