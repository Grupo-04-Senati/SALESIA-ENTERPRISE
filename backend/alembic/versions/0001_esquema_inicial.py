"""Esquema inicial — 22 entidades de docs/04_modelo_er.md.

Crea el esquema completo con PK serial/bigint (alineado con `id: number`
del frontend). Si la base ya contiene tablas de un esquema anterior
(claves UUID de una instalación previa), se eliminan antes de crear el
esquema nuevo: este proyecto decide recrear el esquema según el plan.

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


def _public_tables(bind) -> list[str]:
    inspector = sa.inspect(bind)
    # Se conserva alembic_version: Alembic la gestiona dentro de esta misma transacción.
    return [
        table
        for table in inspector.get_table_names(schema='public')
        if table != 'alembic_version'
    ]


def upgrade() -> None:
    bind = op.get_bind()

    # Limpieza del esquema anterior (incluye alembic_version de otra herramienta).
    for table in _public_tables(bind):
        op.execute(sa.text(f'DROP TABLE IF EXISTS public."{table}" CASCADE'))

    Base.metadata.create_all(bind=bind)


def downgrade() -> None:
    bind = op.get_bind()
    Base.metadata.drop_all(bind=bind)
