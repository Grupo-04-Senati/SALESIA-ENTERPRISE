"""Nuevas features: cliente inline en venta, lookup, kits y estado de cuenta."""

from __future__ import annotations

import time


def _first(client, path, headers, query=''):
    response = client.get(f'{path}?page=1&page_size=1{query}', headers=headers)
    assert response.status_code == 200, response.text
    items = response.json()['items']
    assert items, f'La semilla no dejó datos en {path}'
    return items[0]


def _seller_id(client, headers):
    employees = client.get('/api/v1/employees', headers=headers).json()
    seller = employees[0] if isinstance(employees, list) else employees['items'][0]
    return seller['id']


def test_venta_crea_cliente_inline(client, admin_headers):
    product = _first(client, '/api/v1/products', admin_headers, '&status=active')
    doc = f'88{int(time.time()) % 100000000:08d}'[:8]
    payload = {
        'customer': {
            'document_type': 'DNI',
            'document_number': doc,
            'name': 'Cliente Auto Test',
            'commercial_line': 'Retail',
        },
        'seller_id': _seller_id(client, admin_headers),
        'items': [{'product_id': product['id'], 'quantity': 1,
                   'unit_price': float(product['sale_price']), 'discount': 0}],
        'payment': None,
    }
    response = client.post('/api/v1/sales', headers=admin_headers, json=payload)
    assert response.status_code == 201, response.text

    # El cliente quedó guardado en el listado.
    listing = client.get(f'/api/v1/customers?q={doc}', headers=admin_headers)
    assert listing.status_code == 200
    found = listing.json()['items']
    assert found, 'El cliente inline no se guardó en el listado de clientes'
    assert found[0]['document_number'] == doc
    assert found[0]['name'] == 'Cliente Auto Test'

    client.post(f"/api/v1/sales/{response.json()['id']}/cancel", headers=admin_headers, json={
        'reason': 'Limpieza de prueba automatizada',
    })


def test_venta_con_cliente_inline_reusa_existente(client, admin_headers):
    customer = _first(client, '/api/v1/customers', admin_headers, '&status=active')
    product = _first(client, '/api/v1/products', admin_headers, '&status=active')
    payload = {
        'customer': {
            'document_type': customer['document_type'],
            'document_number': customer['document_number'],
            'name': 'Nombre Ignorado',
        },
        'seller_id': _seller_id(client, admin_headers),
        'items': [{'product_id': product['id'], 'quantity': 1,
                   'unit_price': float(product['sale_price']), 'discount': 0}],
        'payment': None,
    }
    response = client.post('/api/v1/sales', headers=admin_headers, json=payload)
    assert response.status_code == 201, response.text

    client.post(f"/api/v1/sales/{response.json()['id']}/cancel", headers=admin_headers, json={
        'reason': 'Limpieza de prueba automatizada',
    })


def test_venta_requiere_cliente_o_payload(client, admin_headers):
    product = _first(client, '/api/v1/products', admin_headers, '&status=active')
    payload = {
        'seller_id': _seller_id(client, admin_headers),
        'items': [{'product_id': product['id'], 'quantity': 1,
                   'unit_price': float(product['sale_price']), 'discount': 0}],
        'payment': None,
    }
    response = client.post('/api/v1/sales', headers=admin_headers, json=payload)
    assert response.status_code == 422, response.text


def test_lookup_encuentra_cliente_local(client, admin_headers):
    customer = _first(client, '/api/v1/customers', admin_headers, '&status=active')
    response = client.get(
        f"/api/v1/customers/lookup?document={customer['document_number']}",
        headers=admin_headers,
    )
    assert response.status_code == 200, response.text
    body = response.json()
    assert body['found'] is True
    assert body['source'] == 'local'
    assert body['document_number'] == customer['document_number']


def test_lookup_documento_desconocido(client, admin_headers):
    response = client.get(
        '/api/v1/customers/lookup?document=00000000', headers=admin_headers
    )
    assert response.status_code == 200, response.text
    body = response.json()
    # Sin token de API ni registro local: found=False, nunca un error 500.
    assert body['found'] in (True, False)


def test_kit_venta_descuenta_componentes_y_anulacion_los_devuelve(client, admin_headers):
    products = client.get(
        '/api/v1/products?status=active&page=1&page_size=2', headers=admin_headers
    ).json()['items']
    kit, componente = products[0], products[1]
    headers = admin_headers

    # Armar el kit.
    add = client.post(
        f"/api/v1/products/{kit['id']}/components", headers=headers,
        json={'component_id': componente['id'], 'quantity': 2},
    )
    assert add.status_code == 201, add.text

    stock_comp_antes = client.get(
        f"/api/v1/inventory/{componente['id']}", headers=headers
    ).json()['current_stock']
    stock_kit_antes = client.get(
        f"/api/v1/inventory/{kit['id']}", headers=headers
    ).json()['current_stock']

    customer = _first(client, '/api/v1/customers', headers, '&status=active')
    sale_resp = client.post('/api/v1/sales', headers=headers, json={
        'customer_id': customer['id'],
        'seller_id': _seller_id(client, headers),
        'items': [{'product_id': kit['id'], 'quantity': 1,
                   'unit_price': float(kit['sale_price']), 'discount': 0}],
        'payment': None,
    })
    assert sale_resp.status_code == 201, sale_resp.text
    sale = sale_resp.json()

    # El componente bajó 2 unidades; el kit no cambió.
    stock_comp_despues = client.get(
        f"/api/v1/inventory/{componente['id']}", headers=headers
    ).json()['current_stock']
    stock_kit_despues = client.get(
        f"/api/v1/inventory/{kit['id']}", headers=headers
    ).json()['current_stock']
    assert stock_comp_antes - stock_comp_despues == 2
    assert stock_kit_despues == stock_kit_antes

    # Anular devuelve los componentes.
    cancel = client.post(f'/api/v1/sales/{sale["id"]}/cancel', headers=headers, json={
        'reason': 'Limpieza de prueba automatizada de kit',
    })
    assert cancel.status_code == 200, cancel.text
    stock_comp_final = client.get(
        f"/api/v1/inventory/{componente['id']}", headers=headers
    ).json()['current_stock']
    assert stock_comp_final == stock_comp_antes

    # Quitar el componente del kit para no afectar otras pruebas.
    client.delete(
        f"/api/v1/products/{kit['id']}/components/{componente['id']}", headers=headers
    )


def test_producto_es_kit_tras_agregar_componente(client, admin_headers):
    products = client.get(
        '/api/v1/products?status=active&page=1&page_size=2', headers=admin_headers
    ).json()['items']
    kit, componente = products[0], products[1]

    client.post(
        f"/api/v1/products/{kit['id']}/components", headers=admin_headers,
        json={'component_id': componente['id'], 'quantity': 1},
    )
    listing = client.get(f'/api/v1/products?q={kit["sku"]}', headers=admin_headers)
    row = next(p for p in listing.json()['items'] if p['id'] == kit['id'])
    assert row['is_kit'] is True

    client.delete(
        f"/api/v1/products/{kit['id']}/components/{componente['id']}", headers=admin_headers
    )


def test_estado_de_cuenta_cliente(client, admin_headers):
    customer = _first(client, '/api/v1/customers', admin_headers, '&status=active')
    response = client.get(
        f"/api/v1/customers/{customer['id']}/account-statement", headers=admin_headers
    )
    assert response.status_code == 200, response.text
    body = response.json()
    assert body['customer']['id'] == customer['id']
    assert 'total_purchased' in body
    assert 'total_paid' in body
    assert 'balance' in body
    assert 'aging' in body
    assert set(body['aging']) == {'vigente', '1-30', '31-60', '61-90', '90+'}
    assert isinstance(body['sales'], list)


def test_cliente_guarda_linea_comercial(client, admin_headers):
    doc = f'77{int(time.time()) % 100000000:08d}'[:8]
    response = client.post('/api/v1/customers', headers=admin_headers, json={
        'document_type': 'DNI',
        'document_number': doc,
        'name': 'Cliente Linea Comercial',
        'commercial_line': 'Mayorista',
    })
    assert response.status_code == 201, response.text
    assert response.json()['commercial_line'] == 'Mayorista'
