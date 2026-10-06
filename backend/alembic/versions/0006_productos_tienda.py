"""0006 productos para la tienda: precio mayorista, marca, imagen y destacado
(+ imagen de categoría).

Revisión ID: 0006
Depende de: 0005 (notificaciones automáticas)
"""
from __future__ import annotations

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

revision: str = '0006'
down_revision: Union[str, None] = '0005'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

_NEW_COLUMNS = (
    sa.Column('wholesale_price', sa.Numeric(precision=12, scale=2), nullable=True),
    sa.Column('brand', sa.String(length=100), nullable=True),
    sa.Column('image_url', sa.Text(), nullable=True),
    sa.Column('is_featured', sa.Boolean(), server_default=sa.false(), nullable=False),
)

_CATEGORY_COLUMNS = (
    sa.Column('image_url', sa.Text(), nullable=True),
)


def upgrade() -> None:
    inspector = sa.inspect(op.get_bind())

    if inspector.has_table('productos'):
        columns = {col['name'] for col in inspector.get_columns('productos')}
        for column in _NEW_COLUMNS:
            if column.name not in columns:
                op.add_column('productos', column)

    if inspector.has_table('categorias'):
        columns = {col['name'] for col in inspector.get_columns('categorias')}
        for column in _CATEGORY_COLUMNS:
            if column.name not in columns:
                op.add_column('categorias', column)


def downgrade() -> None:
    inspector = sa.inspect(op.get_bind())

    if inspector.has_table('productos'):
        columns = {col['name'] for col in inspector.get_columns('productos')}
        for column in _NEW_COLUMNS:
            if column.name in columns:
                op.drop_column('productos', column.name)

    if inspector.has_table('categorias'):
        columns = {col['name'] for col in inspector.get_columns('categorias')}
        for column in _CATEGORY_COLUMNS:
            if column.name in columns:
                op.drop_column('categorias', column.name)
