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


def test_store_quote_crea_cotizacion_real(client, admin_headers):
    products = client.get('/api/v1/store/products?page_size=2').json()['items']
    assert len(products) >= 1
    target = products[0]

    response = client.post('/api/v1/store/quotes', json={
        'customer': {
            'name': 'Cliente Tienda Web',
            'phone': '999888777',
            'email': 'tienda.web@example.com',
        },
        'items': [{'product_id': target['id'], 'quantity': 2}],
        'notes': 'Prueba automatizada del storefront',
    })
    assert response.status_code == 201, response.text
    quote = response.json()
    assert quote['quote_number'].startswith('COT-')
    assert quote['customer_name'] == 'Cliente Tienda Web'
    assert quote['item_count'] == 1
    assert quote['tax'] == 0
    assert quote['subtotal'] == round(target['sale_price'] * 2, 2)
    assert quote['total'] == quote['subtotal']

    # El precio se recalcula en servidor con el catálogo vigente (RN-11).
    detail = client.get(
        f"/api/v1/quotes/{quote['id']}", headers=admin_headers
    ).json()
    assert detail['items'][0]['unit_price'] == target['sale_price']

    # Limpieza: solo se pueden borrar las cotizaciones en borrador.
    deleted = client.delete(
        f"/api/v1/quotes/{quote['id']}", headers=admin_headers
    )
    assert deleted.status_code == 200


def test_store_quote_producto_inexistente(client):
    response = client.post('/api/v1/store/quotes', json={
        'customer': {'name': 'Cliente Prueba', 'phone': '999777666'},
        'items': [{'product_id': 999999999, 'quantity': 1}],
    })
    assert response.status_code == 404
