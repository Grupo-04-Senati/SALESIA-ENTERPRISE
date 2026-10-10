"""Schemas del storefront público de la tienda web (sin autenticación)."""

from __future__ import annotations

from typing import ClassVar, List, Literal, Optional

from pydantic import EmailStr, Field, field_validator, model_validator

from app.schemas.base import NormalizedModel


class StoreCustomer(NormalizedModel):
    letter_required: ClassVar[frozenset[str]] = frozenset({'name'})
    name: str = Field(min_length=3, max_length=150)
    phone: Optional[str] = Field(default=None, max_length=20, pattern=r'^(\+?\d{7,15})?$')
    email: Optional[EmailStr] = Field(default=None, max_length=160)

    @field_validator('email', mode='before')
    @classmethod
    def _empty_email_to_none(cls, value: object) -> object:
        if isinstance(value, str) and not value.strip():
            return None
        return value

    @model_validator(mode='after')
    def _require_contact(self) -> 'StoreCustomer':
        if not self.phone and not self.email:
            raise ValueError('Indica tu teléfono o tu correo para poder contactarte.')
        return self


class StoreQuoteItem(NormalizedModel):
    product_id: int = Field(ge=1)
    quantity: int = Field(gt=0, le=10_000)


class StoreQuoteCreate(NormalizedModel):
    """Pedido de la tienda: la identidad la da la sesión; ``customer`` es opcional."""

    customer: Optional[StoreCustomer] = None
    items: List[StoreQuoteItem] = Field(min_length=1, max_length=50)
    notes: Optional[str] = Field(default=None, max_length=500)


class StoreContactCreate(NormalizedModel):
    """Mensaje del formulario de contacto público de la tienda."""

    letter_required: ClassVar[frozenset[str]] = frozenset({'name'})
    name: str = Field(min_length=3, max_length=80)
    email: EmailStr = Field(max_length=50)
    phone: str = Field(max_length=15, pattern=r'^\d{7,15}$')
    message: str = Field(min_length=10, max_length=2000)


class StoreRegisterInput(NormalizedModel):
    """Alta de cuenta de cliente en la tienda (sesión con contraseña)."""

    letter_required: ClassVar[frozenset[str]] = frozenset({'name'})
    name: str = Field(min_length=3, max_length=150)
    email: EmailStr = Field(max_length=160)
    phone: Optional[str] = Field(default=None, max_length=20, pattern=r'^(\+?\d{7,15})?$')
    password: str = Field(min_length=8, max_length=72)


class StoreLoginInput(NormalizedModel):
    email: EmailStr = Field(max_length=160)
    password: str = Field(min_length=1, max_length=72)


class StoreClaimCreate(NormalizedModel):
    """Reclamo de un pedido de la tienda (no llegó o tuvo problemas)."""

    description: str = Field(min_length=10, max_length=1000)


class StorePaymentCreate(NormalizedModel):
    """Cobro de la pasarela simulada de la tienda (solo el dueño del pedido)."""

    method: Literal['card', 'yape', 'plin'] = 'card'
    reference: Optional[str] = Field(default=None, max_length=64)
