"""RF-10 a RF-14 · motor estadístico vía API (docs/05 §2.8)."""


def test_media_de_valores_directos(client, admin_headers):
    response = client.post('/api/v1/statistics/mean', headers=admin_headers, json={
        'values': [2, 4, 4, 4, 5, 5, 7, 9], 'save_history': False,
    })
    assert response.status_code == 200
    body = response.json()
    assert body['metric'] == 'mean'
    assert body['value'] == 5.0
    assert body['count'] == 8
    assert body['min'] == 2.0
    assert body['max'] == 9.0


def test_mediana_impar_y_par(client, admin_headers):
    impar = client.post('/api/v1/statistics/median', headers=admin_headers, json={
        'values': [1, 3, 5, 7, 9], 'save_history': False,
    }).json()
    assert impar['value'] == 5.0

    par = client.post('/api/v1/statistics/median', headers=admin_headers, json={
        'values': [1, 2, 3, 4], 'save_history': False,
    }).json()
    assert par['value'] == 2.5


def test_rn40_datos_insuficientes(client, admin_headers):
    response = client.post('/api/v1/statistics/mean', headers=admin_headers, json={
        'values': [42], 'save_history': False,
    })
    assert response.status_code == 400
    assert response.json()['code'] == 'DATOS_INSUFICIENTES'


def test_historial_de_analisis_rf21(client, admin_headers):
    creada = client.post('/api/v1/statistics/mean', headers=admin_headers, json={
        'values': [10, 20, 30], 'save_history': True,
    })
    assert creada.status_code == 200
    analysis_id = creada.json()['analysis_id']
    assert analysis_id

    detalle = client.get(f'/api/v1/statistics/analyses/{analysis_id}', headers=admin_headers)
    assert detalle.status_code == 200
    assert detalle.json()['id'] == analysis_id

    historial = client.get('/api/v1/statistics/analyses', headers=admin_headers)
    assert historial.status_code == 200
    assert historial.json()['total'] >= 1


def test_vendedor_no_puede_calcular_metricas(client, vendedor_headers):
    response = client.post('/api/v1/statistics/mean', headers=vendedor_headers, json={
        'values': [1, 2], 'save_history': False,
    })
    assert response.status_code == 403


def test_datasets_requieren_datos(client, admin_headers):
    response = client.get('/api/v1/statistics/datasets', headers=admin_headers)
    assert response.status_code == 200
    assert 'items' in response.json()
