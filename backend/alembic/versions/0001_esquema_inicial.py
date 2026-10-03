"""Esquema inicial — 22 entidades de docs/04_modelo_er.md.

Crea el esquema completo con PK serial/bigint (alineado con `id: number`
del frontend) mediante `create_all`, que **solo añade las tablas que
faltan y nunca borra datos existentes**. Si la base ya contiene tablas
de un esquema anterior, se conservan intactas.

Revisión ID: 0001
Creada: 2026-10-02
"""
from __future__ import annotations

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

from app.core.database import Base
import app.models  # noqa: F401 — registra los modelos en Base.metadata

revision: str = '0001'
down_revision: Union[str, None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Nunca se ejecutan DROP: create_all es idempotente y solo crea lo que falta.
    Base.metadata.create_all(bind=op.get_bind())


def downgrade() -> None:
    bind = op.get_bind()
    Base.metadata.drop_all(bind=bind)
