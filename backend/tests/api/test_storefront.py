"""Endpoints públicos del storefront de la tienda web (sin JWT)."""

from __future__ import annotations


def test_store_products_es_publico(client):
    response = client.get('/api/v1/store/products?page_size=5')
    assert response.status_code == 200
    body = response.json()
    assert body['total'] >= 1
    assert 1 <= len(body['items']) <= 5

    item = body['items'][0]
    for key in ('id', 'sku', 'name', 'sale_price', 'wholesale_price', 'brand',
                'image_url', 'is_featured', 'current_stock', 'category', 'status'):
        assert key in item, f'falta {key}'
    assert 'cost_price' not in item, 'el costo no debe exponerse al público'
    assert item['status'] == 'active'
    if item['category']:
        assert 'slug' in item['category']


def test_store_products_busqueda_y_categoria(client):
    all_items = client.get('/api/v1/store/products?page_size=100').json()['items']
    assert all_items

    first = all_items[0]
    if first['category']:
        response = client.get(f"/api/v1/store/products?category={first['category']['slug']}")
        assert response.status_code == 200
        assert response.json()['total'] >= 1

    response = client.get('/api/v1/store/products?category=inexistente-xyz')
    assert response.status_code == 200
    assert response.json()['total'] == 0

    if first['sku']:
        response = client.get('/api/v1/store/products', params={'q': first['sku']})
        assert response.status_code == 200
        assert response.json()['total'] >= 1


def test_store_categories_publico(client):
    response = client.get('/api/v1/store/categories')
    assert response.status_code == 200
    items = response.json()['items']
    assert items
    assert all(row['status'] == 'active' for row in items)
    assert all(row['slug'] for row in items)
    assert any('slug' in row and 'image_url' in row for row in items)


def test_store_product_detalle(client):
    first = client.get('/api/v1/store/products?page_size=1').json()['items'][0]
    response = client.get(f"/api/v1/store/products/{first['id']}")
    assert response.status_code == 200
    body = response.json()
    assert body['sku'] == first['sku']
    assert 'cost_price' not in body

    response = client.get('/api/v1/store/products/999999999')
    assert response.status_code == 404


def test_store_quote_requiere_contacto(client):
    first = client.get('/api/v1/store/products?page_size=1').json()['items'][0]
    response = client.post('/api/v1/store/quotes', json={
        'customer': {'name': 'Sin Contacto SAC'},
        'items': [{'product_id': first['id'], 'quantity': 1}],
    })
    assert response.status_code == 422


def test_store_quote_crea_cotizacion_y_venta_con_stock(client, admin_headers):
    products = client.get('/api/v1/store/products?page_size=100').json()['items']
    assert products
    target = max(products, key=lambda row: row['current_stock'])
    assert target['current_stock'] >= 1, 'el seed debe dejar stock disponible'
    qty = min(2, target['current_stock'])
    stock_before = target['current_stock']

    response = client.post('/api/v1/store/quotes', json={
        'customer': {
            'name': 'Cliente Tienda Web',
            'phone': '999888777',
            'email': 'tienda.web@example.com',
        },
        'items': [{'product_id': target['id'], 'quantity': qty}],
        'notes': 'Prueba automatizada del storefront',
    })
    assert response.status_code == 201, response.text
    quote = response.json()
    assert quote['quote_number'].startswith('COT-')
    assert quote['customer_name'] == 'Cliente Tienda Web'
    assert quote['item_count'] == 1
    assert quote['tax'] == 0
    assert quote['subtotal'] == round(target['sale_price'] * qty, 2)
    assert quote['total'] == quote['subtotal']

    # El pedido queda convertido en venta automática (stock descontado + kardex).
    assert quote['status'] == 'converted'
    assert quote['sale_number'].startswith('V-')

    stock_after = client.get(
        f"/api/v1/store/products/{target['id']}"
    ).json()['current_stock']
    assert stock_after == stock_before - qty, 'la compra de la tienda debe descontar stock'

    sales = client.get('/api/v1/sales?page_size=100', headers=admin_headers).json()['items']
    venta = next((row for row in sales if row['sale_number'] == quote['sale_number']), None)
    assert venta is not None, 'la venta debe aparecer en /sales (alimenta estadísticas)'
    assert venta['status'] == 'pending'

    # El precio se recalcula en servidor con el catálogo vigente (RN-11).
    detail = client.get(
        f"/api/v1/quotes/{quote['id']}", headers=admin_headers
    ).json()
    assert detail['items'][0]['unit_price'] == target['sale_price']
    assert detail['status'] == 'converted'

    # Limpieza: anular la venta devuelve el stock.
    cancelled = client.post(
        f"/api/v1/sales/{quote['sale_id']}/cancel",
        json={'reason': 'limpieza del test de storefront'},
        headers=admin_headers,
    )
    assert cancelled.status_code == 200, cancelled.text
    restored = client.get(
        f"/api/v1/store/products/{target['id']}"
    ).json()['current_stock']
    assert restored == stock_before


def test_store_quote_genera_notificacion_de_pedido(client, admin_headers):
    products = client.get('/api/v1/store/products?page_size=100').json()['items']
    target = max(products, key=lambda row: row['current_stock'])
    assert target['current_stock'] >= 1

    response = client.post('/api/v1/store/quotes', json={
        'customer': {
            'name': 'Cliente Pedido Web',
            'phone': '911222333',
            'email': 'pedido.web@example.com',
        },
        'items': [{'product_id': target['id'], 'quantity': 1}],
    })
    assert response.status_code == 201, response.text
    quote = response.json()

    notifications = client.get(
        '/api/v1/notifications?page_size=50', headers=admin_headers
    ).json()['items']
    found = [row for row in notifications if 'Nuevo pedido de la tienda' in row.get('title', '')]
    assert found, 'la compra de la tienda debe generar una notificación de pedido'
    note = found[0]
    assert quote['sale_number'] in note['message']
    assert note['link'] == f"/ventas?sale={quote['sale_id']}"
    assert note['module'] == 'ventas'
    assert note['target_role'] is None, 'el pedido debe verse para todos los roles'
    assert note['detail']['quote_number'] == quote['quote_number']


def test_store_quote_sin_stock_se_rechaza(client, admin_headers):
    products = client.get('/api/v1/store/products?page_size=100').json()['items']
    assert products
    target = min(products, key=lambda row: row['current_stock'])
    qty = target['current_stock'] + 1

    response = client.post('/api/v1/store/quotes', json={
        'customer': {'name': 'Cliente Sin Stock', 'phone': '999000111'},
        'items': [{'product_id': target['id'], 'quantity': qty}],
    })
    assert response.status_code == 400, response.text
    body = response.json()
    assert 'Stock insuficiente' in body['message']
    assert str(target['current_stock']) in body['message']

    # No queda cotización huérfana cuando se rechaza por stock.
    quotes = client.get('/api/v1/quotes?page_size=100', headers=admin_headers).json()['items']
    leftovers = [row for row in quotes if row['customer_name'] == 'Cliente Sin Stock']
    assert leftovers == [], 'la cotización rechazada no debe persistir'


def test_store_quote_producto_inexistente(client):
    response = client.post('/api/v1/store/quotes', json={
        'customer': {'name': 'Cliente Prueba', 'phone': '999777666'},
        'items': [{'product_id': 999999999, 'quantity': 1}],
    })
    assert response.status_code == 404


def test_store_contact_registra_notificacion(client, admin_headers):
    response = client.post('/api/v1/store/contact', json={
        'name': 'Cliente Contacto Web',
        'email': 'contacto.web@example.com',
        'phone': '988777666',
        'message': 'Hola, quiero información sobre precios de mayoreo.',
    })
    assert response.status_code == 201, response.text
    assert response.json()['status'] == 'ok'

    notifications = client.get(
        '/api/v1/notifications?page_size=50', headers=admin_headers
    ).json()['items']
    found = [row for row in notifications if 'Cliente Contacto Web' in row.get('title', '')]
    assert found, 'el mensaje de contacto debe generar una notificación en SalesIA'
    assert 'contacto.web@example.com' in found[0].get('message', '')


def test_store_contact_valida_datos(client):
    response = client.post('/api/v1/store/contact', json={
        'name': 'AB',
        'email': 'no-es-correo',
        'phone': '123',
        'message': 'corto',
    })
    assert response.status_code == 422


def test_store_auth_registro_login_y_me(client):
    payload = {
        'name': 'Ana Tienda Web',
        'email': 'ana.tienda@example.com',
        'phone': '911000111',
        'password': 'secreta123',
    }
    response = client.post('/api/v1/store/auth/register', json=payload)
    assert response.status_code == 201, response.text
    body = response.json()
    assert body['token_type'] == 'bearer'
    assert body['customer']['email'] == 'ana.tienda@example.com'
    token = body['access_token']

    assert client.get('/api/v1/store/auth/me').status_code == 401

    me = client.get('/api/v1/store/auth/me', headers={'Authorization': f'Bearer {token}'})
    assert me.status_code == 200
    assert me.json()['name'] == 'Ana Tienda Web'
    assert me.json()['phone'] == '911000111'

    duplicated = client.post('/api/v1/store/auth/register', json=payload)
    assert duplicated.status_code == 409
    assert 'Ya existe una cuenta' in duplicated.json()['message']

    login = client.post('/api/v1/store/auth/login', json={
        'email': payload['email'], 'password': payload['password'],
    })
    assert login.status_code == 200, login.text
    assert login.json()['access_token']
    assert login.json()['customer']['id'] == body['customer']['id']

    wrong = client.post('/api/v1/store/auth/login', json={
        'email': payload['email'], 'password': 'clave-equivocada',
    })
    assert wrong.status_code == 401
    assert 'incorrectos' in wrong.json()['message']

    bad_token = client.get(
        '/api/v1/store/auth/me', headers={'Authorization': 'Bearer token-falso'}
    )
    assert bad_token.status_code == 401


def test_store_auth_vincula_historial_de_invitado(client, admin_headers):
    products = client.get('/api/v1/store/products?page_size=100').json()['items']
    target = max(products, key=lambda row: row['current_stock'])
    quote = client.post('/api/v1/store/quotes', json={
        'customer': {
            'name': 'Invitado Que Registra',
            'phone': '933444555',
            'email': 'invitado.registro@example.com',
        },
        'items': [{'product_id': target['id'], 'quantity': 1}],
    }).json()
    assert quote['status'] == 'converted'

    registered = client.post('/api/v1/store/auth/register', json={
        'name': 'Invitado Que Registra',
        'email': 'invitado.registro@example.com',
        'password': 'cuenta1234',
    })
    assert registered.status_code == 201, registered.text

    token = registered.json()['access_token']
    orders = client.get(
        '/api/v1/store/orders', headers={'Authorization': f'Bearer {token}'}
    )
    assert orders.status_code == 200
    sale_numbers = [row['sale_number'] for row in orders.json()['items']]
    assert quote['sale_number'] in sale_numbers, 'el historial de invitado queda en la cuenta'

    cancelled = client.post(
        f"/api/v1/sales/{quote['sale_id']}/cancel",
        json={'reason': 'limpieza del test de vínculo'},
        headers=admin_headers,
    )
    assert cancelled.status_code == 200, cancelled.text


def test_store_orders_requiere_sesion(client):
    assert client.get('/api/v1/store/orders').status_code == 401
    assert client.post('/api/v1/store/auth/login', json={
        'email': 'no.existe@example.com', 'password': 'cualquiera1',
    }).status_code == 401


def test_store_orders_y_marcado_de_recibido(client, admin_headers):
    products = client.get('/api/v1/store/products?page_size=100').json()['items']
    target = max(products, key=lambda row: row['current_stock'])
    stock_before = target['current_stock']

    quote = client.post('/api/v1/store/quotes', json={
        'customer': {
            'name': 'Cliente Recibido Web',
            'phone': '955666777',
            'email': 'recibido.web@example.com',
        },
        'items': [{'product_id': target['id'], 'quantity': 1}],
    }).json()
    assert quote['status'] == 'converted'

    registered = client.post('/api/v1/store/auth/register', json={
        'name': 'Cliente Recibido Web',
        'email': 'recibido.web@example.com',
        'password': 'pedido1234',
    })
    assert registered.status_code == 201, registered.text
    auth = {'Authorization': f"Bearer {registered.json()['access_token']}"}

    orders = client.get('/api/v1/store/orders', headers=auth).json()['items']
    mine = next(row for row in orders if row['sale_number'] == quote['sale_number'])
    assert mine['received_at'] is None, 'nace sin marcar como recibido'
    assert mine['status'] == 'pending'

    sin_gestion = client.put(
        f"/api/v1/sales/{quote['sale_id']}/received",
        json={'received': True},
    )
    assert sin_gestion.status_code in (401, 403), 'solo Admin/Gerente gestionan la entrega'

    marked = client.put(
        f"/api/v1/sales/{quote['sale_id']}/received",
        json={'received': True},
        headers=admin_headers,
    )
    assert marked.status_code == 200, marked.text
    assert marked.json()['received_at'] is not None

    orders = client.get('/api/v1/store/orders', headers=auth).json()['items']
    mine = next(row for row in orders if row['sale_number'] == quote['sale_number'])
    assert mine['received_at'] is not None, 'el cliente ve la marca de recibido'

    unmarked = client.put(
        f"/api/v1/sales/{quote['sale_id']}/received",
        json={'received': False},
        headers=admin_headers,
    )
    assert unmarked.status_code == 200
    assert unmarked.json()['received_at'] is None

    orders = client.get('/api/v1/store/orders', headers=auth).json()['items']
    mine = next(row for row in orders if row['sale_number'] == quote['sale_number'])
    assert mine['received_at'] is None

    cancelled = client.post(
        f"/api/v1/sales/{quote['sale_id']}/cancel",
        json={'reason': 'limpieza del test de recibido'},
        headers=admin_headers,
    )
    assert cancelled.status_code == 200, cancelled.text
    restored = client.get(f"/api/v1/store/products/{target['id']}").json()['current_stock']
    assert restored == stock_before
