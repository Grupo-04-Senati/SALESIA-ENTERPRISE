"""0009 kits de producto y línea comercial del cliente.

Revisión ID: 0009
Depende de: 0008 (reclamaciones)
"""
from __future__ import annotations

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

revision: str = '0009'
down_revision: Union[str, None] = '0008'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

_KITS = 'kits_producto'


def upgrade() -> None:
    inspector = sa.inspect(op.get_bind())

    cols = {c['name'] for c in inspector.get_columns('clientes')}
    if 'linea_comercial' not in cols:
        op.add_column('clientes', sa.Column('linea_comercial', sa.String(length=80), nullable=True))

    if inspector.has_table(_KITS):
        return
    op.create_table(
        _KITS,
        sa.Column('id', sa.BigInteger(), autoincrement=True, nullable=False),
        sa.Column('company_id', sa.BigInteger(), nullable=False),
        sa.Column('product_id', sa.BigInteger(), nullable=False),
        sa.Column('component_id', sa.BigInteger(), nullable=False),
        sa.Column('quantity', sa.Integer(), nullable=False, server_default='1'),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.ForeignKeyConstraint(['company_id'], ['empresas.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['product_id'], ['productos.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['component_id'], ['productos.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('product_id', 'component_id', name='uq_kits_producto_product_component'),
    )
    op.create_index('ix_kits_producto_company_id', _KITS, ['company_id'], unique=False)
    op.create_index('ix_kits_producto_product_id', _KITS, ['product_id'], unique=False)
    op.create_index('ix_kits_producto_component_id', _KITS, ['component_id'], unique=False)


def downgrade() -> None:
    inspector = sa.inspect(op.get_bind())
    if inspector.has_table(_KITS):
        op.drop_table(_KITS)
    cols = {c['name'] for c in inspector.get_columns('clientes')}
    if 'linea_comercial' in cols:
        op.drop_column('clientes', 'linea_comercial')
