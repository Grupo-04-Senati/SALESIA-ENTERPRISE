"""RF-16 · probabilidad básica (docs/06 §7)."""

import pytest

from app.analytics.probability import basic
from app.core.exceptions import ValidationAppError


def test_conjunta_complementaria_union_condicional():
    result = basic(p_a=0.5, p_b=0.4, p_intersection=0.2)
    assert result['p_a'] == 0.5
    assert result['p_b'] == 0.4
    assert result['p_a_complement'] == 0.5
    assert result['p_b_complement'] == 0.6
    assert result['p_union'] == 0.7          # P(A)+P(B)-P(A∩B)
    assert result['p_b_given_a'] == 0.4      # 0.2/0.5


def test_union_no_supera_a_la_unidad():
    result = basic(p_a=0.9, p_b=0.8, p_intersection=0.7)
    assert result['p_union'] <= 1.0


def test_interseccion_no_puede_superar_a_p_a():
    with pytest.raises(ValidationAppError):
        basic(p_a=0.3, p_b=0.5, p_intersection=0.4)


def test_probabilidad_fuera_de_rango():
    with pytest.raises(ValidationAppError):
        basic(p_a=-0.1, p_b=0.5, p_intersection=0.1)


def test_condicional_cuando_p_a_es_cero():
    result = basic(p_a=0.0, p_b=0.5, p_intersection=0.0)
    assert result['p_b_given_a'] == 0.0
