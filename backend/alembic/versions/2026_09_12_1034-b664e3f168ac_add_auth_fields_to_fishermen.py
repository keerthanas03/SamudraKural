"""add_auth_fields_to_fishermen

Revision ID: b664e3f168ac
Revises: 'e8b093cf8f2d'
Create Date: 2026-09-12 10:34:21.154236

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'b664e3f168ac'
down_revision: Union[str, None] = 'e8b093cf8f2d'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column('fishermen', sa.Column('email', sa.String(length=255), nullable=False))
    op.add_column('fishermen', sa.Column('password_hash', sa.String(length=255), nullable=False))
    op.add_column('fishermen', sa.Column('is_active', sa.Boolean(), server_default=sa.text('true'), nullable=False))
    op.create_index(op.f('ix_fishermen_email'), 'fishermen', ['email'], unique=True)


def downgrade() -> None:
    op.drop_index(op.f('ix_fishermen_email'), table_name='fishermen')
    op.drop_column('fishermen', 'is_active')
    op.drop_column('fishermen', 'password_hash')
    op.drop_column('fishermen', 'email')
