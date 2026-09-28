"""create_sos_and_live_locations

Revision ID: c7e192f4185a
Revises: b664e3f168ac
Create Date: 2026-09-15 13:18:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
import geoalchemy2


# revision identifiers, used by Alembic.
revision: str = 'c7e192f4185a'
down_revision: Union[str, None] = 'b664e3f168ac'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # 1. Create user_current_locations table
    op.create_table('user_current_locations',
        sa.Column('id', sa.Integer(), autoincrement=True, nullable=False),
        sa.Column('fisherman_id', sa.Integer(), nullable=False),
        sa.Column('latitude', sa.Float(), nullable=False),
        sa.Column('longitude', sa.Float(), nullable=False),
        sa.Column('location', geoalchemy2.types.Geography(geometry_type='POINT', srid=4326, dimension=2, spatial_index=False, from_text='ST_GeogFromText', name='geography', nullable=False), nullable=False),
        sa.Column('accuracy_meters', sa.Float(), server_default='15.0', nullable=True),
        sa.Column('speed_mps', sa.Float(), server_default='0.0', nullable=True),
        sa.Column('heading_degrees', sa.Float(), server_default='0.0', nullable=True),
        sa.Column('battery_percent', sa.Integer(), server_default='100', nullable=True),
        sa.Column('is_active', sa.Boolean(), server_default=sa.text('true'), nullable=False),
        sa.Column('recorded_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.ForeignKeyConstraint(['fisherman_id'], ['fishermen.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('fisherman_id', name='uq_user_current_locations_fisherman_id')
    )
    op.create_index('idx_user_current_locations_location', 'user_current_locations', ['location'], unique=False, postgresql_using='gist')
    op.create_index(op.f('ix_user_current_locations_id'), 'user_current_locations', ['id'], unique=False)
    op.create_index(op.f('ix_user_current_locations_fisherman_id'), 'user_current_locations', ['fisherman_id'], unique=True)

    # 2. Create sos_alerts table
    op.create_table('sos_alerts',
        sa.Column('id', sa.Integer(), autoincrement=True, nullable=False),
        sa.Column('public_sos_id', sa.String(length=36), nullable=False),
        sa.Column('fisherman_id', sa.Integer(), nullable=True),
        sa.Column('boat_id', sa.Integer(), nullable=True),
        sa.Column('emergency_type', sa.String(length=100), server_default='General Emergency', nullable=False),
        sa.Column('priority', sa.String(length=50), server_default='CRITICAL', nullable=False),
        sa.Column('status', sa.String(length=50), server_default='ACTIVE', nullable=False),
        sa.Column('delivery_status', sa.String(length=50), server_default='ONLINE', nullable=False),
        sa.Column('latitude', sa.Float(), nullable=False),
        sa.Column('longitude', sa.Float(), nullable=False),
        sa.Column('location', geoalchemy2.types.Geography(geometry_type='POINT', srid=4326, dimension=2, spatial_index=False, from_text='ST_GeogFromText', name='geography', nullable=False), nullable=False),
        sa.Column('location_accuracy_meters', sa.Float(), server_default='15.0', nullable=True),
        sa.Column('battery_percent', sa.Integer(), server_default='100', nullable=True),
        sa.Column('description', sa.String(length=1000), nullable=True),
        sa.Column('people_affected', sa.Integer(), server_default='1', nullable=False),
        sa.Column('relay_hops', sa.Integer(), server_default='0', nullable=False),
        sa.Column('relayed_by_device_id', sa.String(length=255), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.Column('last_known_location_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.Column('acknowledged_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('resolved_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('cancelled_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('cancellation_reason', sa.String(length=500), nullable=True),
        sa.ForeignKeyConstraint(['fisherman_id'], ['fishermen.id'], ondelete='SET NULL'),
        sa.ForeignKeyConstraint(['boat_id'], ['boats.id'], ondelete='SET NULL'),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index('idx_sos_alerts_location', 'sos_alerts', ['location'], unique=False, postgresql_using='gist')
    op.create_index(op.f('ix_sos_alerts_id'), 'sos_alerts', ['id'], unique=False)
    op.create_index(op.f('ix_sos_alerts_public_sos_id'), 'sos_alerts', ['public_sos_id'], unique=True)
    op.create_index(op.f('ix_sos_alerts_fisherman_id'), 'sos_alerts', ['fisherman_id'], unique=False)
    op.create_index(op.f('ix_sos_alerts_boat_id'), 'sos_alerts', ['boat_id'], unique=False)

    # 3. Create sos_responses table
    op.create_table('sos_responses',
        sa.Column('id', sa.Integer(), autoincrement=True, nullable=False),
        sa.Column('sos_alert_id', sa.Integer(), nullable=False),
        sa.Column('responder_fisherman_id', sa.Integer(), nullable=False),
        sa.Column('response', sa.String(length=50), server_default='YES_HELP', nullable=False),
        sa.Column('latitude', sa.Float(), nullable=True),
        sa.Column('longitude', sa.Float(), nullable=True),
        sa.Column('location', geoalchemy2.types.Geography(geometry_type='POINT', srid=4326, dimension=2, spatial_index=False, from_text='ST_GeogFromText', name='geography', nullable=True), nullable=True),
        sa.Column('distance_meters', sa.Float(), nullable=True),
        sa.Column('eta_minutes', sa.Integer(), nullable=True),
        sa.Column('message', sa.String(length=500), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.ForeignKeyConstraint(['sos_alert_id'], ['sos_alerts.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['responder_fisherman_id'], ['fishermen.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('sos_alert_id', 'responder_fisherman_id', name='uq_sos_response_alert_responder')
    )
    op.create_index(op.f('ix_sos_responses_id'), 'sos_responses', ['id'], unique=False)
    op.create_index(op.f('ix_sos_responses_sos_alert_id'), 'sos_responses', ['sos_alert_id'], unique=False)
    op.create_index(op.f('ix_sos_responses_responder_fisherman_id'), 'sos_responses', ['responder_fisherman_id'], unique=False)

    # 4. Create rescue_missions table
    op.create_table('rescue_missions',
        sa.Column('id', sa.Integer(), autoincrement=True, nullable=False),
        sa.Column('sos_alert_id', sa.Integer(), nullable=False),
        sa.Column('assigned_officer_id', sa.Integer(), nullable=True),
        sa.Column('officer_name', sa.String(length=255), server_default='Officer Command HQ', nullable=False),
        sa.Column('rescue_team', sa.String(length=255), nullable=False),
        sa.Column('rescue_vessel', sa.String(length=255), nullable=False),
        sa.Column('status', sa.String(length=50), server_default='ASSIGNED', nullable=False),
        sa.Column('eta_minutes', sa.Integer(), server_default='25', nullable=False),
        sa.Column('notes', sa.String(length=2000), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.Column('started_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('completed_at', sa.DateTime(timezone=True), nullable=True),
        sa.ForeignKeyConstraint(['sos_alert_id'], ['sos_alerts.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('sos_alert_id', name='uq_rescue_missions_sos_alert_id')
    )
    op.create_index(op.f('ix_rescue_missions_id'), 'rescue_missions', ['id'], unique=False)
    op.create_index(op.f('ix_rescue_missions_sos_alert_id'), 'rescue_missions', ['sos_alert_id'], unique=True)


def downgrade() -> None:
    op.drop_index(op.f('ix_rescue_missions_sos_alert_id'), table_name='rescue_missions')
    op.drop_index(op.f('ix_rescue_missions_id'), table_name='rescue_missions')
    op.drop_table('rescue_missions')

    op.drop_index(op.f('ix_sos_responses_responder_fisherman_id'), table_name='sos_responses')
    op.drop_index(op.f('ix_sos_responses_sos_alert_id'), table_name='sos_responses')
    op.drop_index(op.f('ix_sos_responses_id'), table_name='sos_responses')
    op.drop_table('sos_responses')

    op.drop_index(op.f('ix_sos_alerts_boat_id'), table_name='sos_alerts')
    op.drop_index(op.f('ix_sos_alerts_fisherman_id'), table_name='sos_alerts')
    op.drop_index(op.f('ix_sos_alerts_public_sos_id'), table_name='sos_alerts')
    op.drop_index(op.f('ix_sos_alerts_id'), table_name='sos_alerts')
    op.drop_index('idx_sos_alerts_location', table_name='sos_alerts', postgresql_using='gist')
    op.drop_table('sos_alerts')

    op.drop_index(op.f('ix_user_current_locations_fisherman_id'), table_name='user_current_locations')
    op.drop_index(op.f('ix_user_current_locations_id'), table_name='user_current_locations')
    op.drop_index('idx_user_current_locations_location', table_name='user_current_locations', postgresql_using='gist')
    op.drop_table('user_current_locations')
