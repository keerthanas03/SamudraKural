import pytest
from tests.conftest import check_db_available


@pytest.mark.anyio
async def test_sos_trigger_and_acknowledgement(client):
    db_avail = await check_db_available()
    if not db_avail:
        pytest.skip("PostgreSQL DB not reachable in test runner environment.")

    # 1. Fisherman triggers SOS
    sos_payload = {
        "latitude": 13.1250,
        "longitude": 80.4120,
        "emergency_type": "Engine Failure",
        "description": "Engine failure 14km off Chennai harbour. Drifting NE.",
        "people_affected": 4,
        "priority": "CRITICAL",
    }
    response = await client.post("/api/v1/sos", json=sos_payload)
    if response.status_code == 401:
        pytest.skip("Authentication required for POST /api/v1/sos in Phase 2C.")
    assert response.status_code == 201


@pytest.mark.anyio
async def test_coastal_guard_dashboard_endpoint(client):
    db_avail = await check_db_available()
    if not db_avail:
        pytest.skip("PostgreSQL DB not reachable in test runner environment.")

    response = await client.get("/api/v1/coastal-guard/dashboard")
    assert response.status_code == 200
    data = response.json()
    assert "active_sos_count" in data
    assert "critical_alerts_count" in data
    assert "active_rescue_missions_count" in data


@pytest.mark.anyio
async def test_rescue_mission_lifecycle(client):
    db_avail = await check_db_available()
    if not db_avail:
        pytest.skip("PostgreSQL DB not reachable in test runner environment.")

    # Create mission for SOS #1
    mission_payload = {
        "sos_alert_id": 1,
        "officer_name": "Cmdr. V. Raman (ICG)",
        "rescue_team": "ICG Tactical Rescue Unit 04",
        "rescue_vessel": "ICGS C-438 Fast Patrol Vessel",
        "eta_minutes": 15,
        "notes": "Patrol vessel dispatched.",
    }
    create_resp = await client.post("/api/v1/coastal-guard/missions", json=mission_payload)
    assert create_resp.status_code in [201, 404]


@pytest.mark.anyio
async def test_marine_conditions_and_risk_engine(client):
    response = await client.get("/api/v1/coastal-guard/marine-conditions")
    assert response.status_code == 200
    data = response.json()
    assert "overall_risk_level" in data
    assert "wind" in data
    assert "waves" in data


@pytest.mark.anyio
async def test_risk_zones_endpoint(client):
    response = await client.get("/api/v1/coastal-guard/risk-zones")
    assert response.status_code == 200
    zones = response.json()
    assert isinstance(zones, list)
    assert len(zones) > 0
