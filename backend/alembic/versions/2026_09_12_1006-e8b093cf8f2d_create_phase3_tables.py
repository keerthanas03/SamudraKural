"""create_phase3_tables

Revision ID: e8b093cf8f2d
Revises: None
Create Date: 2026-09-12 10:06:43.577022

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
import geoalchemy2


# revision identifiers, used by Alembic.
revision: str = 'e8b093cf8f2d'
down_revision: Union[str, None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Create fishermen table
    op.create_table('fishermen',
        sa.Column('id', sa.Integer(), autoincrement=True, nullable=False),
        sa.Column('name', sa.String(length=255), nullable=False),
        sa.Column('phone', sa.String(length=50), nullable=False),
        sa.Column('shore_location', geoalchemy2.types.Geography(geometry_type='POINT', srid=4326, dimension=2, spatial_index=False, from_text='ST_GeogFromText', name='geography', nullable=False), nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index('idx_fishermen_shore_location', 'fishermen', ['shore_location'], unique=False, postgresql_using='gist')
    op.create_index(op.f('ix_fishermen_id'), 'fishermen', ['id'], unique=False)

    # Create boats table
    op.create_table('boats',
        sa.Column('id', sa.Integer(), autoincrement=True, nullable=False),
        sa.Column('fisherman_id', sa.Integer(), nullable=False),
        sa.Column('name', sa.String(length=255), nullable=False),
        sa.Column('registration_number', sa.String(length=100), nullable=False),
        sa.Column('boat_type', sa.String(length=100), nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.ForeignKeyConstraint(['fisherman_id'], ['fishermen.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_boats_fisherman_id'), 'boats', ['fisherman_id'], unique=False)
    op.create_index(op.f('ix_boats_id'), 'boats', ['id'], unique=False)

    # Create fishing_locations table
    op.create_table('fishing_locations',
        sa.Column('id', sa.Integer(), autoincrement=True, nullable=False),
        sa.Column('fisherman_id', sa.Integer(), nullable=False),
        sa.Column('name', sa.String(length=255), nullable=False),
        sa.Column('location', geoalchemy2.types.Geography(geometry_type='POINT', srid=4326, dimension=2, spatial_index=False, from_text='ST_GeogFromText', name='geography', nullable=False), nullable=False),
        sa.Column('notes', sa.Text(), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.ForeignKeyConstraint(['fisherman_id'], ['fishermen.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index('idx_fishing_locations_location', 'fishing_locations', ['location'], unique=False, postgresql_using='gist')
    op.create_index(op.f('ix_fishing_locations_fisherman_id'), 'fishing_locations', ['fisherman_id'], unique=False)
    op.create_index(op.f('ix_fishing_locations_id'), 'fishing_locations', ['id'], unique=False)


def downgrade() -> None:
    op.drop_index(op.f('ix_fishing_locations_id'), table_name='fishing_locations')
    op.drop_index(op.f('ix_fishing_locations_fisherman_id'), table_name='fishing_locations')
    op.drop_index('idx_fishing_locations_location', table_name='fishing_locations', postgresql_using='gist')
    op.drop_table('fishing_locations')

    op.drop_index(op.f('ix_boats_id'), table_name='boats')
    op.drop_index(op.f('ix_boats_fisherman_id'), table_name='boats')
    op.drop_table('boats')

    op.drop_index(op.f('ix_fishermen_id'), table_name='fishermen')
    op.drop_index('idx_fishermen_shore_location', table_name='fishermen', postgresql_using='gist')
    op.drop_table('fishermen')
