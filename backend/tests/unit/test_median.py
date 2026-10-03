"""RF-12 · mediana (docs/06 §4 · RN-41)."""

import pytest

from app.analytics.median import median
from app.core.exceptions import BusinessRuleError


def test_mediana_impar():
    assert median([1, 3, 5, 7, 9]) == 5.0


def test_mediana_par_promedia_centrales():
    assert median([1, 2, 3, 4]) == 2.5


def test_mediana_no_requiere_orden():
    assert median([9, 1, 5, 3, 7]) == 5.0


def test_mediana_dos_valores():
    assert median([4, 8]) == 6.0


def test_rn41_rechaza_menos_de_dos():
    with pytest.raises(BusinessRuleError) as error:
        median([3])
    assert error.value.code == 'DATOS_INSUFICIENTES'
