"""0005 notificaciones automáticas: columnas de origen + lecturas por usuario.

Revisión ID: 0005
Depende de: 0004 (avatar de usuario)
"""
from __future__ import annotations

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

revision: str = '0005'
down_revision: Union[str, None] = '0004'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

_NEW_COLUMNS = (
    sa.Column('module', sa.String(length=60), nullable=True),
    sa.Column('entity', sa.String(length=60), nullable=True),
    sa.Column('entity_id', sa.BigInteger(), nullable=True),
    sa.Column('link', sa.String(length=255), nullable=True),
    sa.Column('target_role', sa.String(length=30), nullable=True),
    sa.Column('group_id', sa.String(length=36), nullable=True),
    sa.Column('detail', sa.JSON(), nullable=True),
    sa.Column('actor_name', sa.String(length=150), nullable=True),
)


def upgrade() -> None:
    inspector = sa.inspect(op.get_bind())
    if not inspector.has_table('notificaciones'):
        return

    columns = {col['name'] for col in inspector.get_columns('notificaciones')}
    for column in _NEW_COLUMNS:
        if column.name not in columns:
            op.add_column('notificaciones', column)

    indexes = {index['name'] for index in inspector.get_indexes('notificaciones')}
    for name, column in (
        ('ix_notificaciones_module', 'module'),
        ('ix_notificaciones_target_role', 'target_role'),
        ('ix_notificaciones_group_id', 'group_id'),
    ):
        if name not in indexes:
            op.create_index(name, 'notificaciones', [column], unique=False)

    if not inspector.has_table('notificaciones_leidas'):
        op.create_table(
            'notificaciones_leidas',
            sa.Column('notification_id', sa.BigInteger(), nullable=False),
            sa.Column('user_id', sa.BigInteger(), nullable=False),
            sa.Column('read_at', sa.DateTime(timezone=True), nullable=False),
            sa.Column('id', sa.BigInteger(), autoincrement=True, nullable=False),
            sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
            sa.ForeignKeyConstraint(['notification_id'], ['notificaciones.id'], ondelete='CASCADE'),
            sa.ForeignKeyConstraint(['user_id'], ['usuarios.id'], ondelete='CASCADE'),
            sa.PrimaryKeyConstraint('id'),
            sa.UniqueConstraint('notification_id', 'user_id', name='uq_notif_reads_notification_user'),
        )
        op.create_index('ix_notificaciones_leidas_notification_id', 'notificaciones_leidas', ['notification_id'], unique=False)
        op.create_index('ix_notificaciones_leidas_user_id', 'notificaciones_leidas', ['user_id'], unique=False)


def downgrade() -> None:
    inspector = sa.inspect(op.get_bind())
    if inspector.has_table('notificaciones_leidas'):
        op.drop_index('ix_notificaciones_leidas_user_id', table_name='notificaciones_leidas')
        op.drop_index('ix_notificaciones_leidas_notification_id', table_name='notificaciones_leidas')
        op.drop_table('notificaciones_leidas')

    if not inspector.has_table('notificaciones'):
        return
    indexes = {index['name'] for index in inspector.get_indexes('notificaciones')}
    for name in ('ix_notificaciones_module', 'ix_notificaciones_target_role', 'ix_notificaciones_group_id'):
        if name in indexes:
            op.drop_index(name, table_name='notificaciones')
    columns = {col['name'] for col in inspector.get_columns('notificaciones')}
    for column in _NEW_COLUMNS:
        if column.name in columns:
            op.drop_column('notificaciones', column.name)
