"""0008 reclamaciones: la tienda reporta pedidos no recibidos.

Revisión ID: 0008
Depende de: 0007 (cuentas de la tienda y marca de pedido recibido)
"""
from __future__ import annotations

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

revision: str = '0008'
down_revision: Union[str, None] = '0007'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

_TABLE = 'reclamaciones'


def upgrade() -> None:
    inspector = sa.inspect(op.get_bind())
    if inspector.has_table(_TABLE):
        return

    op.create_table(
        _TABLE,
        sa.Column('id', sa.BigInteger(), autoincrement=True, nullable=False),
        sa.Column('company_id', sa.BigInteger(), nullable=False),
        sa.Column('sale_id', sa.BigInteger(), nullable=False),
        sa.Column('customer_id', sa.BigInteger(), nullable=True),
        sa.Column('description', sa.Text(), nullable=False),
        sa.Column('status', sa.String(length=20), nullable=False, server_default='pendiente'),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.Column('resolved_at', sa.DateTime(timezone=True), nullable=True),
        sa.ForeignKeyConstraint(['company_id'], ['empresas.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['sale_id'], ['ventas.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['customer_id'], ['clientes.id'], ondelete='SET NULL'),
        sa.PrimaryKeyConstraint('id'),
        sa.CheckConstraint("status IN ('pendiente', 'atendida')", name='ck_reclamaciones_status'),
    )
    op.create_index('ix_reclamaciones_company_id', _TABLE, ['company_id'], unique=False)
    op.create_index('ix_reclamaciones_sale_id', _TABLE, ['sale_id'], unique=False)
    op.create_index('ix_reclamaciones_customer_id', _TABLE, ['customer_id'], unique=False)
    op.create_index('ix_reclamaciones_status', _TABLE, ['status'], unique=False)


def downgrade() -> None:
    inspector = sa.inspect(op.get_bind())
    if inspector.has_table(_TABLE):
        op.drop_table(_TABLE)
