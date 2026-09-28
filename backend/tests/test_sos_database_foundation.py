import pytest
import uuid
from sqlalchemy import select, text
from app.db.session import AsyncSessionLocal
from app.models.fisherman import Fisherman
from app.models.boat import Boat
from app.models.user_location import UserCurrentLocation
from app.models.sos import SOSAlert
from app.models.sos_response import SOSResponse
from app.models.rescue_mission import RescueMission
from app.models.enums import EmergencyType, SOSStatus, SOSDeliveryStatus, SOSPriority, SOSResponseType, RescueMissionStatus
from app.services.spatial import location_to_wkt, wkt_from_lat_lon, spatial_to_location_point
from app.schemas.common import LocationPoint

@pytest.mark.anyio
async def test_user_current_location_model():
    """Verify UserCurrentLocation entity instantiation, fields, and default values."""
    loc_point = location_to_wkt(LocationPoint(latitude=13.0827, longitude=80.2707))
    user_loc = UserCurrentLocation(
        fisherman_id=1,
        latitude=13.0827,
        longitude=80.2707,
        location=loc_point,
        accuracy_meters=10.5,
        speed_mps=3.2,
        heading_degrees=45.0,
        battery_percent=88,
        is_active=True
    )
    assert user_loc.fisherman_id == 1
    assert user_loc.latitude == 13.0827
    assert user_loc.longitude == 80.2707
    assert user_loc.accuracy_meters == 10.5
    assert user_loc.battery_percent == 88
    assert user_loc.is_active is True

@pytest.mark.anyio
async def test_sos_alert_uuid_and_enums():
    """Verify SOSAlert globally unique UUID generation, status vs delivery_status separation, and enums."""
    generated_uuid = str(uuid.uuid4())
    loc_point = location_to_wkt(LocationPoint(latitude=13.1250, longitude=80.4120))
    
    alert = SOSAlert(
        public_sos_id=generated_uuid,
        fisherman_id=10,
        boat_id=5,
        emergency_type=EmergencyType.ENGINE_FAILURE.value,
        priority=SOSPriority.CRITICAL.value,
        status=SOSStatus.ACTIVE.value,
        delivery_status=SOSDeliveryStatus.OFFLINE_RELAYED.value,
        latitude=13.1250,
        longitude=80.4120,
        location=loc_point,
        location_accuracy_meters=8.0,
        battery_percent=65,
        description="Main diesel stopped. Relayed via mesh peer.",
        people_affected=3,
        relay_hops=2,
        relayed_by_device_id="DEV-NODE-883"
    )

    assert alert.public_sos_id == generated_uuid
    assert alert.emergency_type == "Engine Failure"
    assert alert.priority == "CRITICAL"
    assert alert.status == "ACTIVE"
    assert alert.delivery_status == "OFFLINE_RELAYED"
    assert alert.relay_hops == 2
    assert alert.relayed_by_device_id == "DEV-NODE-883"

@pytest.mark.anyio
async def test_sos_response_model():
    """Verify SOSResponse entity for responder YES_HELP feedback."""
    loc_point = location_to_wkt(LocationPoint(latitude=13.1300, longitude=80.4000))
    response = SOSResponse(
        sos_alert_id=1,
        responder_fisherman_id=20,
        response=SOSResponseType.YES_HELP.value,
        latitude=13.1300,
        longitude=80.4000,
        location=loc_point,
        distance_meters=1450.0,
        eta_minutes=12,
        message="Heading towards you now with tow cable."
    )

    assert response.sos_alert_id == 1
    assert response.responder_fisherman_id == 20
    assert response.response == "YES_HELP"
    assert response.distance_meters == 1450.0
    assert response.eta_minutes == 12

@pytest.mark.anyio
async def test_rescue_mission_model():
    """Verify RescueMission entity referencing an SOS alert."""
    mission = RescueMission(
        sos_alert_id=1,
        assigned_officer_id=2,
        officer_name="Cmdr. Rajesh Kumar (ICG)",
        rescue_team="ICG Tactical Rescue Unit 04",
        rescue_vessel="ICGS C-438 Fast Patrol Boat",
        status=RescueMissionStatus.DEPARTED.value,
        eta_minutes=18,
        notes="Departed base with trauma paramedic."
    )

    assert mission.sos_alert_id == 1
    assert mission.officer_name == "Cmdr. Rajesh Kumar (ICG)"
    assert mission.rescue_vessel == "ICGS C-438 Fast Patrol Boat"
    assert mission.status == "DEPARTED"
    assert mission.eta_minutes == 18

@pytest.mark.anyio
async def test_postgis_geography_point_helpers():
    """Verify spatial conversions to/from PostGIS Geography point."""
    point = LocationPoint(latitude=13.0827, longitude=80.2707)
    wkt = location_to_wkt(point)
    assert "POINT(80.2707 13.0827)" in str(wkt)

    wkt2 = wkt_from_lat_lon(13.0827, 80.2707)
    assert "POINT(80.2707 13.0827)" in str(wkt2)

@pytest.mark.anyio
async def test_alembic_migration_metadata_discovery():
    """Verify that all new models are registered in Base.metadata for Alembic."""
    from app.db.base import Base
    import app.models # noqa

    tables = Base.metadata.tables.keys()
    assert "fishermen" in tables
    assert "boats" in tables
    assert "fishing_locations" in tables
    assert "user_current_locations" in tables
    assert "sos_alerts" in tables
    assert "sos_responses" in tables
    assert "rescue_missions" in tables
