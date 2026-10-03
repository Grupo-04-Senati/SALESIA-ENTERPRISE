"""RF-11 · media aritmética (docs/06 §3 · RN-40)."""

import pytest

from app.analytics.mean import describe, mean
from app.core.exceptions import BusinessRuleError


def test_media_caso_paradigma():
    assert mean([2, 4, 4, 4, 5, 5, 7, 9]) == 5.0


def test_media_con_decimales():
    assert mean([1.5, 2.5]) == 2.0


def test_media_acepta_2_observaciones():
    assert mean([10, 20]) == 15.0


def test_rn40_rechaza_una_sola_observacion():
    with pytest.raises(BusinessRuleError) as error:
        mean([7])
    assert error.value.code == 'DATOS_INSUFICIENTES'


def test_rn40_rechaza_lista_vacia():
    with pytest.raises(BusinessRuleError):
        mean([])


def test_describe_estadisticos_basicos():
    stats = describe([1, 2, 3, 4])
    assert stats['mean'] == 2.5
    assert stats['median'] == 2.5
    assert stats['min'] == 1.0
    assert stats['max'] == 4.0
    assert stats['count'] == 4.0
    assert stats['sum'] == 10.0
