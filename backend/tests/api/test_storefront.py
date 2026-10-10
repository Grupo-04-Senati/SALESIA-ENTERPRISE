"""Endpoints del storefront de la tienda web (catálogo público + pedidos con sesión)."""

from __future__ import annotations


def _store_auth(client, name, email, password='clave1234', phone=None):
    payload = {'name': name, 'email': email, 'password': password}
    if phone:
        payload['phone'] = phone
    response = client.post('/api/v1/store/auth/register', json=payload)
    if response.status_code == 409:
        response = client.post('/api/v1/store/auth/login', json={
            'email': email, 'password': password,
        })
        assert response.status_code == 200, response.text
    else:
        assert response.status_code == 201, response.text
    return {'Authorization': f"Bearer {response.json()['access_token']}"}


def _quote(client, target, auth=None, quantity=1, notes=None):
    body = {'items': [{'product_id': target['id'], 'quantity': quantity}]}
    if notes:
        body['notes'] = notes
    return client.post('/api/v1/store/quotes', json=body, headers=auth or {})


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


def test_store_quote_requiere_sesion(client):
    first = client.get('/api/v1/store/products?page_size=1').json()['items'][0]
    payload = {'items': [{'product_id': first['id'], 'quantity': 1}]}

    response = client.post('/api/v1/store/quotes', json=payload)
    assert response.status_code == 401
    assert 'Inicia sesión' in response.json()['message']

    invalido = client.post('/api/v1/store/quotes', json=payload, headers={
        'Authorization': 'Bearer token-falso',
    })
    assert invalido.status_code == 401


def test_store_quote_requiere_contacto(client):
    auth = _store_auth(client, 'Contacto Requerido', 'contacto.requerido@example.com')
    first = client.get('/api/v1/store/products?page_size=1').json()['items'][0]
    response = client.post('/api/v1/store/quotes', json={
        'customer': {'name': 'Sin Contacto SAC'},
        'items': [{'product_id': first['id'], 'quantity': 1}],
    }, headers=auth)
    assert response.status_code == 422


def test_store_quote_crea_cotizacion_y_venta_con_stock(client, admin_headers):
    products = client.get('/api/v1/store/products?page_size=100').json()['items']
    assert products
    target = max(products, key=lambda row: row['current_stock'])
    assert target['current_stock'] >= 1, 'el seed debe dejar stock disponible'
    qty = min(2, target['current_stock'])
    stock_before = target['current_stock']

    auth = _store_auth(
        client, 'Cliente Tienda Web', 'tienda.web@example.com', phone='999888777'
    )
    response = _quote(client, target, auth=auth, quantity=qty, notes='Prueba automatizada del storefront')
    assert response.status_code == 201, response.text
    quote = response.json()
    assert quote['quote_number'].startswith('COT-')
    assert quote['customer_name'] == 'Cliente Tienda Web'
    assert quote['item_count'] == 1
    assert quote['tax'] == 0
    assert quote['subtotal'] == round(target['sale_price'] * qty, 2)
    assert quote['total'] == quote['subtotal']

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

    detail = client.get(
        f"/api/v1/quotes/{quote['id']}", headers=admin_headers
    ).json()
    assert detail['items'][0]['unit_price'] == target['sale_price']
    assert detail['status'] == 'converted'

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

    auth = _store_auth(
        client, 'Cliente Pedido Web', 'pedido.web@example.com', phone='911222333'
    )
    response = _quote(client, target, auth=auth)
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

    auth = _store_auth(
        client, 'Cliente Sin Stock', 'sin.stock@example.com', phone='999000111'
    )
    response = _quote(client, target, auth=auth, quantity=qty)
    assert response.status_code == 400, response.text
    body = response.json()
    assert 'Stock insuficiente' in body['message']
    assert str(target['current_stock']) in body['message']

    quotes = client.get('/api/v1/quotes?page_size=100', headers=admin_headers).json()['items']
    leftovers = [row for row in quotes if row['customer_name'] == 'Cliente Sin Stock']
    assert leftovers == [], 'la cotización rechazada no debe persistir'


def test_store_quote_producto_inexistente(client):
    auth = _store_auth(client, 'Cliente Prueba', 'cliente.prueba@example.com', phone='999777666')
    response = _quote(client, {'id': 999999999}, auth=auth)
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
    created = client.post('/api/v1/customers', json={
        'document_number': '999000111',
        'name': 'Invitado Que Registra',
        'email': 'invitado.registro@example.com',
        'segment': 'Tienda Web',
    }, headers=admin_headers)
    if created.status_code == 201:
        customer_id = created.json()['id']
    else:
        existentes = client.get(
            '/api/v1/customers', params={'q': 'invitado.registro@example.com'},
            headers=admin_headers,
        ).json()['items']
        customer_id = next(
            row['id'] for row in existentes
            if row['email'] == 'invitado.registro@example.com'
        )

    employees = client.get(
        '/api/v1/employees?page_size=100', headers=admin_headers
    ).json()['items']
    seller = next(row for row in employees if row['status'] == 'active')
    products = client.get('/api/v1/store/products?page_size=100').json()['items']
    target = max(products, key=lambda row: row['current_stock'])

    venta = client.post('/api/v1/sales', json={
        'customer_id': customer_id,
        'seller_id': seller['id'],
        'items': [{
            'product_id': target['id'],
            'quantity': 1,
            'unit_price': target['sale_price'],
            'discount': 0,
        }],
        'tax_rate': 0,
    }, headers=admin_headers)
    assert venta.status_code == 201, venta.text
    sale_number = venta.json()['sale_number']

    registered = client.post('/api/v1/store/auth/register', json={
        'name': 'Invitado Que Registra',
        'email': 'invitado.registro@example.com',
        'password': 'cuenta1234',
    })
    if registered.status_code == 409:
        registered = client.post('/api/v1/store/auth/login', json={
            'email': 'invitado.registro@example.com', 'password': 'cuenta1234',
        })
        assert registered.status_code == 200, registered.text
    else:
        assert registered.status_code == 201, registered.text

    token = registered.json()['access_token']
    orders = client.get(
        '/api/v1/store/orders', headers={'Authorization': f'Bearer {token}'}
    )
    assert orders.status_code == 200
    sale_numbers = [row['sale_number'] for row in orders.json()['items']]
    assert sale_number in sale_numbers, 'el historial de invitado queda en la cuenta'

    cancelled = client.post(
        f"/api/v1/sales/{venta.json()['id']}/cancel",
        json={'reason': 'limpieza del test de vínculo'},
        headers=admin_headers,
    )
    assert cancelled.status_code == 200, cancelled.text


def test_store_orders_requiere_sesion(client):
    assert client.get('/api/v1/store/orders').status_code == 401
    assert client.post(
        '/api/v1/store/orders/1/pay', json={'method': 'yape'}
    ).status_code == 401
    assert client.post(
        '/api/v1/store/orders/1/claims',
        json={'description': 'No me llegó el pedido que realicé.'},
    ).status_code == 401
    assert client.post('/api/v1/store/auth/login', json={
        'email': 'no.existe@example.com', 'password': 'cualquiera1',
    }).status_code == 401


def test_store_orders_y_marcado_de_recibido(client, admin_headers):
    products = client.get('/api/v1/store/products?page_size=100').json()['items']
    target = max(products, key=lambda row: row['current_stock'])
    stock_before = target['current_stock']

    auth = _store_auth(
        client, 'Cliente Recibido Web', 'recibido.web@example.com',
        password='pedido1234', phone='955666777',
    )
    quote = _quote(client, target, auth=auth, notes='Prueba de recibido')
    assert quote.status_code == 201, quote.text
    quote = quote.json()
    assert quote['status'] == 'converted'

    orders = client.get('/api/v1/store/orders', headers=auth).json()['items']
    mine = next(row for row in orders if row['sale_number'] == quote['sale_number'])
    assert mine['received_at'] is None, 'nace sin marcar como recibido'
    assert mine['status'] == 'pending'

    sin_gestion = client.put(
        f"/api/v1/sales/{quote['sale_id']}/received",
        json={'received': True},
    )
    assert sin_gestion.status_code in (401, 403), 'solo Admin/Gerente gestionan la entrega'

    cliente_no_marca = client.put(
        f"/api/v1/store/orders/{quote['sale_id']}/received",
        json={'received': True},
        headers=auth,
    )
    assert cliente_no_marca.status_code == 404, 'el cliente no marca la llegada'

    orders = client.get('/api/v1/store/orders', headers=auth).json()['items']
    mine = next(row for row in orders if row['sale_number'] == quote['sale_number'])
    assert mine['received_at'] is None, 'sin marca hasta que el sistema confirme'

    marcado = client.put(
        f"/api/v1/sales/{quote['sale_id']}/received",
        json={'received': True},
        headers=admin_headers,
    )
    assert marcado.status_code == 200, marcado.text
    assert marcado.json()['received_at'] is not None

    orders = client.get('/api/v1/store/orders', headers=auth).json()['items']
    mine = next(row for row in orders if row['sale_number'] == quote['sale_number'])
    assert mine['received_at'] is not None, 'el cliente ve la marca del sistema'

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


def test_store_reclamo_de_pedido_flujo_completo(client, admin_headers, vendedor_headers):
    products = client.get('/api/v1/store/products?page_size=100').json()['items']
    target = max(products, key=lambda row: row['current_stock'])
    stock_before = target['current_stock']

    auth = _store_auth(
        client, 'Cliente Reclamo Web', 'reclamo.web@example.com', password='reclamo1234'
    )
    quote = _quote(client, target, auth=auth, notes='Prueba de reclamo')
    assert quote.status_code == 201, quote.text
    quote = quote.json()
    sale_id = quote['sale_id']

    otro = _store_auth(client, 'Otro Cliente Reclamo', 'otro.reclamo@example.com')
    ajeno = client.post(
        f'/api/v1/store/orders/{sale_id}/claims',
        json={'description': 'Quiero reclamar este pedido que no es mío.'},
        headers=otro,
    )
    assert ajeno.status_code == 404, 'solo el dueño del pedido puede reclamar'

    corto = client.post(
        f'/api/v1/store/orders/{sale_id}/claims',
        json={'description': 'corto'},
        headers=auth,
    )
    assert corto.status_code == 422

    response = client.post(
        f'/api/v1/store/orders/{sale_id}/claims',
        json={'description': 'No me llegó el pedido, favor de revisar la entrega.'},
        headers=auth,
    )
    assert response.status_code == 201, response.text
    claim = response.json()
    assert claim['status'] == 'pendiente'
    assert claim['resolved_at'] is None

    duplicado = client.post(
        f'/api/v1/store/orders/{sale_id}/claims',
        json={'description': 'Otro reclamo sobre el mismo pedido pendiente.'},
        headers=auth,
    )
    assert duplicado.status_code == 409
    assert 'pendiente' in duplicado.json()['message']

    notifications = client.get(
        '/api/v1/notifications?page_size=50', headers=admin_headers
    ).json()['items']
    found = [row for row in notifications if 'Reclamo de pedido' in row.get('title', '')]
    assert found, 'el reclamo debe generar una notificación en el sistema'
    assert quote['sale_number'] in found[0]['message']
    assert 'Cliente Reclamo Web' in found[0]['message']
    assert found[0]['level'] == 'warning'
    assert found[0]['link'] == f'/ventas?sale={sale_id}'

    orders = client.get('/api/v1/store/orders', headers=auth).json()['items']
    mine = next(row for row in orders if row['sale_number'] == quote['sale_number'])
    assert mine['claims'], 'el cliente ve su reclamo en Mis pedidos'
    assert mine['claims'][0]['id'] == claim['id']
    assert mine['claims'][0]['status'] == 'pendiente'

    detalle = client.get(f'/api/v1/sales/{sale_id}', headers=admin_headers)
    assert detalle.status_code == 200
    claims = detalle.json()['claims']
    assert claims and claims[0]['id'] == claim['id']
    assert claims[0]['status'] == 'pendiente'

    sin_permiso = client.put(f"/api/v1/claims/{claim['id']}/resolve")
    assert sin_permiso.status_code in (401, 403)

    rol_vendedor = client.put(
        f"/api/v1/claims/{claim['id']}/resolve", headers=vendedor_headers
    )
    assert rol_vendedor.status_code == 403, 'solo Admin/Gerente atienden reclamos'

    resuelto = client.put(f"/api/v1/claims/{claim['id']}/resolve", headers=admin_headers)
    assert resuelto.status_code == 200, resuelto.text
    assert resuelto.json()['status'] == 'atendida'
    assert resuelto.json()['resolved_at'] is not None

    repetido = client.put(f"/api/v1/claims/{claim['id']}/resolve", headers=admin_headers)
    assert repetido.status_code == 400
    assert 'atendido' in repetido.json()['message']

    orders = client.get('/api/v1/store/orders', headers=auth).json()['items']
    mine = next(row for row in orders if row['sale_number'] == quote['sale_number'])
    assert mine['claims'][0]['status'] == 'atendida'

    otro_pedido = _quote(client, target, auth=auth, notes='Prueba de reclamo anulado')
    assert otro_pedido.status_code == 201, otro_pedido.text
    otro_pedido = otro_pedido.json()
    anulada = client.post(
        f"/api/v1/sales/{otro_pedido['sale_id']}/cancel",
        json={'reason': 'limpieza del test de reclamos'},
        headers=admin_headers,
    )
    assert anulada.status_code == 200, anulada.text
    sobre_anulada = client.post(
        f"/api/v1/store/orders/{otro_pedido['sale_id']}/claims",
        json={'description': 'Reclamo sobre un pedido que fue anulado.'},
        headers=auth,
    )
    assert sobre_anulada.status_code == 400
    assert 'anulado' in sobre_anulada.json()['message']

    cancelled = client.post(
        f'/api/v1/sales/{sale_id}/cancel',
        json={'reason': 'limpieza del test de reclamos'},
        headers=admin_headers,
    )
    assert cancelled.status_code == 200, cancelled.text
    restored = client.get(f'/api/v1/store/products/{target["id"]}').json()['current_stock']
    assert restored == stock_before


def test_store_pago_simulado_pasarela(client, admin_headers):
    products = client.get('/api/v1/store/products?page_size=100').json()['items']
    target = max(products, key=lambda row: row['current_stock'])
    stock_before = target['current_stock']

    auth = _store_auth(client, 'Cliente Pago Web', 'pago.web@example.com', password='pago12345')
    quote = _quote(client, target, auth=auth, notes='Prueba de pasarela')
    assert quote.status_code == 201, quote.text
    quote = quote.json()
    sale_id = quote['sale_id']

    orders = client.get('/api/v1/store/orders', headers=auth).json()['items']
    mine = next(row for row in orders if row['sale_number'] == quote['sale_number'])
    assert mine['status'] == 'pending', 'el pedido nace pendiente de pago'
    assert mine['balance'] > 0

    sin_sesion = client.post(f'/api/v1/store/orders/{sale_id}/pay', json={'method': 'yape'})
    assert sin_sesion.status_code == 401

    otro = _store_auth(client, 'Otro Cliente Pago', 'otro.pago@example.com')
    ajeno = client.post(
        f'/api/v1/store/orders/{sale_id}/pay',
        json={'method': 'yape'},
        headers=otro,
    )
    assert ajeno.status_code == 404, 'solo el dueño del pedido puede pagar'

    mal_metodo = client.post(
        f'/api/v1/store/orders/{sale_id}/pay',
        json={'method': 'cash'},
        headers=auth,
    )
    assert mal_metodo.status_code == 422, 'la pasarela solo acepta card, yape o plin'

    pagado = client.post(
        f'/api/v1/store/orders/{sale_id}/pay',
        json={'method': 'yape', 'reference': 'YP-DEMO-0001'},
        headers=auth,
    )
    assert pagado.status_code == 201, pagado.text
    body = pagado.json()
    assert body['status'] == 'paid'
    assert body['balance'] == 0
    assert body['payments'][-1]['method'] == 'yape'
    assert body['payments'][-1]['reference'] == 'YP-DEMO-0001'

    repetido = client.post(
        f'/api/v1/store/orders/{sale_id}/pay',
        json={'method': 'card'},
        headers=auth,
    )
    assert repetido.status_code == 409, 'el pedido ya pagado no admite otro cobro'
    assert 'pagado' in repetido.json()['message']

    orders = client.get('/api/v1/store/orders', headers=auth).json()['items']
    mine = next(row for row in orders if row['sale_number'] == quote['sale_number'])
    assert mine['status'] == 'paid'
    assert mine['balance'] == 0

    detalle = client.get(f'/api/v1/sales/{sale_id}', headers=admin_headers)
    assert detalle.status_code == 200
    assert detalle.json()['payments'][-1]['method'] == 'yape'

    notifications = client.get(
        '/api/v1/notifications?page_size=50', headers=admin_headers
    ).json()['items']
    found = [row for row in notifications if 'Pago recibido' in row.get('title', '')]
    assert found, 'el pago debe generar una notificación en el sistema'
    assert quote['sale_number'] in found[0]['message']

    anulado_previo = _quote(client, target, auth=auth, notes='Pedido anulado sin pagar')
    assert anulado_previo.status_code == 201, anulado_previo.text
    anulado_previo = anulado_previo.json()
    anulado = client.post(
        f"/api/v1/sales/{anulado_previo['sale_id']}/cancel",
        json={'reason': 'limpieza del test de pasarela'},
        headers=admin_headers,
    )
    assert anulado.status_code == 200, anulado.text
    pagar_anulado = client.post(
        f"/api/v1/store/orders/{anulado_previo['sale_id']}/pay",
        json={'method': 'plin'},
        headers=auth,
    )
    assert pagar_anulado.status_code == 400
    assert 'anulado' in pagar_anulado.json()['message']

    sin_referencia = _quote(client, target, auth=auth, notes='Pago sin referencia')
    assert sin_referencia.status_code == 201, sin_referencia.text
    sin_referencia = sin_referencia.json()
    autogenerado = client.post(
        f"/api/v1/store/orders/{sin_referencia['sale_id']}/pay",
        json={'method': 'card'},
        headers=auth,
    )
    assert autogenerado.status_code == 201, autogenerado.text
    referencia = autogenerado.json()['payments'][-1]['reference']
    assert referencia.startswith('SIM-'), 'la operación se autogenera si no viene del cliente'

    for sid in (sale_id, sin_referencia['sale_id']):
        limpieza = client.post(
            f'/api/v1/sales/{sid}/cancel',
            json={'reason': 'limpieza del test de pasarela'},
            headers=admin_headers,
        )
        assert limpieza.status_code == 200, limpieza.text
    restored = client.get(f"/api/v1/store/products/{target['id']}").json()['current_stock']
    assert restored == stock_before
