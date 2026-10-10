"""0007 cuentas de la tienda y marca de pedido recibido.

Revisión ID: 0007
Depende de: 0006 (productos para la tienda)
"""
from __future__ import annotations

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

revision: str = '0007'
down_revision: Union[str, None] = '0006'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

_COLUMNS = (
    ('clientes', sa.Column('password_hash', sa.String(length=255), nullable=True)),
    ('ventas', sa.Column('received_at', sa.DateTime(timezone=True), nullable=True)),
)


def upgrade() -> None:
    inspector = sa.inspect(op.get_bind())
    for table, column in _COLUMNS:
        if not inspector.has_table(table):
            continue
        columns = {col['name'] for col in inspector.get_columns(table)}
        if column.name not in columns:
            op.add_column(table, column)


def downgrade() -> None:
    inspector = sa.inspect(op.get_bind())
    for table, column in _COLUMNS:
        if not inspector.has_table(table):
            continue
        columns = {col['name'] for col in inspector.get_columns(table)}
        if column.name in columns:
            op.drop_column(table, column.name)
