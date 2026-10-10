"""Importación masiva de productos desde CSV (vista previa + kardex)."""

from __future__ import annotations

import time

from app.models.inventory import Inventory  # noqa: F401 — documents the stock link


def _prefix() -> str:
    """Prefijo de SKU único por corrida (evita colisiones entre ejecuciones)."""
    return f"IMP{int(time.time() * 1000) % 10**6:06d}"


def _csv(header: str, *rows: str) -> str:
    return header + '\n' + '\n'.join(rows)


VALID_HEADER = 'sku;nombre;categoria;precio_costo;precio_venta;precio_mayoreo;marca;stock_inicial;stock_minimo;unidad;destacado;descripcion'


def test_preview_clasifica_filas_sin_escribir(client, admin_headers):
    sku = _prefix() + 'A'
    csv_text = _csv(
        VALID_HEADER,
        f'{sku};Tecla Mecánica;Periféricos;80,50;120,99;110;MarcaX;25;5;UND;sí;Teclado RGB',
        f'{sku};Duplicado;Periféricos;10;20;;;0;0;UND;;',
        ';;Sin datos;;;15;;;;;;;',
    )
    response = client.post(
        '/api/v1/products/import/preview',
        headers=admin_headers, json={'csv': csv_text},
    )
    assert response.status_code == 200, response.text
    body = response.json()
    assert body['will_create'] == 1
    assert body['error_rows'] == 2
    assert body['new_categories'] == ['Periféricos']
    ok_row = next(row for row in body['rows'] if row['ok'])
    assert ok_row['data']['sku'] == sku
    assert ok_row['data']['sale_price'] == 120.99
    assert body['rows'][0]['line'] == 2
    # Nada se escribió en la base.
    check = client.get(f'/api/v1/products?q={sku}', headers=admin_headers)
    assert check.json()['items'] == []


def test_import_crea_producto_categoria_y_kardex(client, admin_headers):
    sku = _prefix() + 'B'
    csv_text = _csv(
        VALID_HEADER,
        f'{sku};Mouse Gamer;Import Cat {sku[-4:]};40;75,90;70;Logi;30;3;UND;no;Mouse 12000dpi',
    )
    response = client.post(
        '/api/v1/products/import', headers=admin_headers, json={'csv': csv_text},
    )
    assert response.status_code == 201, response.text
    body = response.json()
    assert body['created'] == 1
    assert body['stock_movements'] == 1
    assert body['categories_created'] == 1

    listing = client.get(f'/api/v1/products?q={sku}', headers=admin_headers).json()
    assert len(listing['items']) == 1
    product = listing['items'][0]
    assert product['current_stock'] == 30
    assert product['min_stock'] == 3
    assert product['unit'] == 'UND'

    movements = client.get(
        f"/api/v1/inventory/{product['id']}/movements", headers=admin_headers
    ).json()
    rows = movements if isinstance(movements, list) else movements.get('items', [])
    import_rows = [row for row in rows if row.get('reason') == 'Importación CSV']
    assert import_rows and import_rows[0]['quantity'] == 30
    assert import_rows[0]['type'].lower() == 'in'


def test_import_sku_existente_requiere_update_flag(client, admin_headers):
    sku = _prefix() + 'C'
    first = _csv(
        VALID_HEADER,
        f'{sku};Producto Base;Utilidades;10;20;;;5;0;UND;;',
    )
    assert client.post(
        '/api/v1/products/import', headers=admin_headers, json={'csv': first}
    ).status_code == 201

    second = _csv(
        VALID_HEADER,
        f'{sku};Producto Base v2;Utilidades;12;25;;;0;0;UND;;',
    )
    # Sin update_existing: la fila se rechaza.
    preview = client.post(
        '/api/v1/products/import/preview',
        headers=admin_headers, json={'csv': second},
    ).json()
    assert preview['will_update'] == 0
    assert preview['error_rows'] == 1

    # Con update_existing: se actualiza precio y nombre.
    run = client.post(
        '/api/v1/products/import',
        headers=admin_headers, json={'csv': second, 'update_existing': True},
    )
    assert run.status_code == 201, run.text
    assert run.json()['updated'] == 1
    assert run.json()['skipped'] == 0

    product = client.get(f'/api/v1/products?q={sku}', headers=admin_headers).json()['items'][0]
    assert product['name'] == 'Producto Base v2'
    assert product['sale_price'] == 25.0


def test_import_rechaza_columnas_faltantes(client, admin_headers):
    response = client.post(
        '/api/v1/products/import/preview',
        headers=admin_headers, json={'csv': 'sku;nombre\nX;Y'},
    )
    assert response.status_code == 422
    body = response.json()
    text = f"{body.get('message', '')} {body.get('detail', '')}".lower()
    assert 'categor' in text


def test_vendedor_no_puede_importar(client, vendedor_headers):
    response = client.post(
        '/api/v1/products/import',
        headers=vendedor_headers, json={'csv': VALID_HEADER},
    )
    assert response.status_code == 403
