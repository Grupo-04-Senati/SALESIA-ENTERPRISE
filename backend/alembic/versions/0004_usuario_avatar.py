"""0004 agrega usuarios.avatar (foto de perfil, data-URI).

Revisión ID: 0004
Depende de: 0003 (renombrar tablas)
"""
from __future__ import annotations

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

revision: str = '0004'
down_revision: Union[str, None] = '0003'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    inspector = sa.inspect(op.get_bind())
    if not inspector.has_table('usuarios'):
        return
    columns = {col['name'] for col in inspector.get_columns('usuarios')}
    if 'avatar' in columns:
        return
    op.add_column('usuarios', sa.Column('avatar', sa.Text(), nullable=True))


def downgrade() -> None:
    inspector = sa.inspect(op.get_bind())
    if not inspector.has_table('usuarios'):
        return
    columns = {col['name'] for col in inspector.get_columns('usuarios')}
    if 'avatar' in columns:
        op.drop_column('usuarios', 'avatar')
