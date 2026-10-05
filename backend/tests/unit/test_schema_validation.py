"""Validación de schemas (hardening de entrada) — sin BD."""

from __future__ import annotations

import pytest
from pydantic import ValidationError

from app.schemas.auth import LoginRequest, StatusPatch, UserCreate, UserUpdate
from app.schemas.customer import CustomerCreate
from app.schemas.product import ProductCreate, ProductStatusPatch
from app.schemas.probability import BayesRequest
from app.schemas.quotes import QuoteItemInput
from app.schemas.suppliers import SupplierCreate


def _customer(**kwargs) -> CustomerCreate:
    payload = {'document_number': '12345678', 'name': 'Ana Torres'}
    payload.update(kwargs)
    return CustomerCreate(**payload)


# ---------------------------------------------------------------- normalización

def test_nombre_demasiado_largo_se_rechaza():
    with pytest.raises(ValidationError):
        _customer(name='A' * 151)


def test_nombre_solo_espacios_se_rechaza():
    # '   ' supera el min_length en bruto, pero al normalizar queda vacío.
    with pytest.raises(ValidationError):
        _customer(name='   ')
    with pytest.raises(ValidationError):
        _customer(name='  ')
    with pytest.raises(ValidationError):
        _customer(name='\t \n ')


def test_colapsa_espacios_internos():
    created = _customer(name='  Ana   María   Torres  ')
    assert created.name == 'Ana María Torres'


def test_correo_se_pasa_a_minusculas():
    created = _customer(email='ANA.Example@Example.COM')
    assert created.email == 'ana.example@example.com'


def test_nombre_con_signos_se_rechaza():
    # '###' tiene 3 caracteres pero ninguna letra: regla hasLetter.
    with pytest.raises(ValidationError, match='letra'):
        _customer(name='###')


def test_password_corta_en_user_update():
    with pytest.raises(ValidationError):
        UserUpdate(password='12345')


def test_password_larga_en_user_update():
    with pytest.raises(ValidationError):
        UserUpdate(password='x' * 73)


def test_password_en_blanco_no_se_normaliza():
    # Los campos de contraseña se excluyen de la normalización.
    created = UserUpdate(password='  secreto1  ')
    assert created.password == '  secreto1  '


# ---------------------------------------------------------------- Literals

def test_estado_invalido_en_status_patch():
    with pytest.raises(ValidationError):
        StatusPatch(status='banana')


def test_estado_invalido_en_user_update():
    with pytest.raises(ValidationError):
        UserUpdate(status='enabled')


def test_estado_valido_en_user_update():
    assert UserUpdate(status='inactive').status == 'inactive'


def test_rol_invalido_en_user_create():
    with pytest.raises(ValidationError):
        UserCreate(
            full_name='Ana Torres', email='ana@salesia.pe',
            password='secreto1', role='superuser',
        )


def test_producto_status_rechaza_banana():
    with pytest.raises(ValidationError):
        ProductStatusPatch(status='banana')
    with pytest.raises(ValidationError):
        ProductStatusPatch.model_validate({'status': 'banana'})
    assert ProductStatusPatch(status='active').status == 'active'


def test_login_password_con_tope():
    with pytest.raises(ValidationError):
        LoginRequest(email='ana@salesia.pe', password='x' * 101)


# ---------------------------------------------------------------- cotizaciones

def test_descuento_de_cotizacion_supera_subtotal():
    with pytest.raises(ValidationError):
        QuoteItemInput(product_id=1, quantity=2, unit_price=10.0, discount=25.0)


def test_descuento_de_cotizacion_dentro_del_subtotal():
    item = QuoteItemInput(product_id=1, quantity=2, unit_price=10.0, discount=5.0)
    assert item.discount == 5.0


# ---------------------------------------------------------------- probabilidad

def test_bayes_prior_fuera_de_rango():
    with pytest.raises(ValidationError):
        BayesRequest(prior=1.5, likelihood=0.5, evidence=0.6)


def test_bayes_valores_validos():
    request = BayesRequest(prior=0.01, likelihood=0.9, evidence=0.108)
    assert request.p_a == 0.01
    assert request.p_b_given_a == 0.9
    assert request.p_b == 0.108


# ---------------------------------------------------------------- patrones

def test_ruc_con_letras_se_rechaza():
    with pytest.raises(ValidationError):
        SupplierCreate(ruc='ABCDEFGH', name='Distribuidora Andina')
    assert SupplierCreate(ruc='20456789012', name='Distribuidora Andina').ruc == '20456789012'


def test_telefono_con_letras_se_rechaza():
    with pytest.raises(ValidationError):
        SupplierCreate(ruc='20456789012', name='Distribuidora Andina', phone='call-me-please')
    with pytest.raises(ValidationError):
        _customer(phone='no-digits-here')


def test_documento_con_letras_se_rechaza():
    with pytest.raises(ValidationError):
        _customer(document_number='12AB5678')
    assert _customer(document_number='12345678').document_number == '12345678'


def test_tipo_de_documento_invalido_se_rechaza():
    with pytest.raises(ValidationError):
        _customer(document_type='PASSPORT')
    assert _customer(document_type='CE').document_type == 'CE'


def test_producto_sku_invalido_se_rechaza():
    with pytest.raises(ValidationError):
        ProductCreate(sku='###', name='Café molido')
    with pytest.raises(ValidationError):
        ProductCreate(sku='a b', name='Café molido')
    assert ProductCreate(sku='CAF-01', name='Café molido').sku == 'CAF-01'


def test_correo_vacio_opcional_se_convierte_en_none():
    """CustomerForm envia '' cuando el correo opcional esta en blanco."""
    created = _customer(email='')
    assert created.email is None
    created2 = _customer(email='   ')
    assert created2.email is None


# ------------------------------------------------------- letras obligatorias

def test_nombre_de_cliente_rechaza_basura():
    from app.schemas.product import ProductCreate
    for junk in ('###', '1234', '----', '@@@@'):
        with pytest.raises(ValidationError, match='letra'):
            _customer(name=junk)
        with pytest.raises(ValidationError, match='letra'):
            ProductCreate(sku='SKU-1', name=junk, cost_price=1, sale_price=2)


def test_titulo_de_notificacion_rechaza_basura():
    from app.schemas.system import NotificationCreate
    with pytest.raises(ValidationError, match='letra'):
        NotificationCreate(title='###', message='Mensaje de prueba')
    ok = NotificationCreate(title='Alerta de stock', message='Mensaje de prueba')
    assert ok.title == 'Alerta de stock'


def test_reporte_con_titulo_vacio_o_nulo_no_bloquea():
    from app.schemas.report import ReportCreate
    report = ReportCreate(report_type='ventas', title=None)
    assert report.title is None
