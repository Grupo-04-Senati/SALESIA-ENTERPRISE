"""Schemas de probabilidad y variables aleatorias (docs/05 §2.9 · RF-15…RF-17)."""

from __future__ import annotations

from typing import List, Literal, Optional

from pydantic import BaseModel, Field, model_validator


class BayesRequest(BaseModel):
    """Acepta la nomenclatura del contrato (p_a…) y la del frontend (prior…)."""

    label: Optional[str] = Field(default=None, max_length=200)

    prior: Optional[float] = None
    likelihood: Optional[float] = None
    evidence: Optional[float] = None

    p_a: Optional[float] = None
    p_b_given_a: Optional[float] = None
    p_b: Optional[float] = None

    save_history: bool = True

    @model_validator(mode='after')
    def _resolve_aliases(self) -> 'BayesRequest':
        self.p_a = self.p_a if self.p_a is not None else self.prior
        self.p_b_given_a = self.p_b_given_a if self.p_b_given_a is not None else self.likelihood
        self.p_b = self.p_b if self.p_b is not None else self.evidence
        if self.p_a is None or self.p_b_given_a is None or self.p_b is None:
            raise ValueError('Se requieren P(A), P(B|A) y P(B).')
        return self


class BayesResponse(BaseModel):
    posterior: float
    prior: float
    likelihood: float
    evidence: float
    joint: float
    steps: List[str]
    p_a: float
    p_b_given_a: float
    p_b: float
    p_a_given_b: float
    formula: str
    explanation: str
    change_pct: float
    analysis_id: Optional[int] = None


class BasicProbabilityRequest(BaseModel):
    p_a: float = Field(ge=0, le=1)
    p_b: float = Field(ge=0, le=1)
    p_intersection: float = Field(ge=0, le=1)
    save_history: bool = False


class BasicProbabilityResponse(BaseModel):
    p_a: float
    p_b: float
    p_a_complement: float
    p_b_complement: float
    p_intersection: float
    p_union: float
    p_b_given_a: float
    summary: str


class EventCreate(BaseModel):
    """Evento definido sobre un dataset (docs/05 §2.9)."""

    name: str = Field(min_length=2, max_length=150)
    description: Optional[str] = Field(default=None, max_length=300)
    probability: float = Field(ge=0, le=1)
    dataset_id: Optional[int] = None


class RandomVariableRequest(BaseModel):
    values: Optional[List[float]] = None
    dataset_id: Optional[int] = None
    field: Optional[str] = None
    distribution: Literal['discrete', 'continuous'] = 'discrete'
    save_history: bool = True


class RandomVariableResponse(BaseModel):
    field: str = 'variable'
    distribution: str
    count: int
    possible_values: List[float]
    probabilities: List[float]
    expected_value: float
    mean: float
    median: float
    variance: float
    summary: str
    analysis_id: Optional[int] = None
