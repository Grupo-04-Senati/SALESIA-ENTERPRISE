"""RF-17 · teorema de Bayes (docs/06 §8 · RN-43, RN-49)."""

import pytest

from app.analytics.bayes import bayes
from app.core.exceptions import BayesPorCero, ValidationAppError


def test_posterior_enfermedad_clasica():
    # P(enfermedad)=0.01 · P(+|enfermedad)=0.9 · P(+)=0.108
    result = bayes(prior=0.01, likelihood=0.9, evidence=0.108)
    assert result['posterior'] == 0.0833
    assert result['p_a_given_b'] == 0.0833
    assert result['prior'] == 0.01
    assert result['likelihood'] == 0.9
    assert result['evidence'] == 0.108


def test_posterior_aumenta_cuando_evidencia_favorable():
    result = bayes(prior=0.2, likelihood=0.9, evidence=0.26)
    assert result['posterior'] == 0.6923  # 0.18 / 0.26
    assert result['change_pct'] == 49.23
    assert 'aumenta' in result['explanation']


def test_rn43_evidencia_cero_es_error():
    with pytest.raises(BayesPorCero) as error:
        bayes(prior=0.5, likelihood=0.5, evidence=0.0)
    assert error.value.code == 'BAYES_POR_CERO'


def test_probabilidad_fuera_de_rango():
    with pytest.raises(ValidationAppError):
        bayes(prior=1.5, likelihood=0.5, evidence=0.5)


def test_incluye_formula_y_pasos():
    result = bayes(prior=0.3, likelihood=0.8, evidence=0.5)
    assert 'P(A|B)' in result['formula']
    assert len(result['steps']) >= 2
