import pytest
import uuid
from httpx import AsyncClient
from tests.conftest import check_db_available


@pytest.mark.asyncio
async def test_coastal_guard_rescue_mission_lifecycle(client: AsyncClient):
    """Test Coastal Guard dashboard, SOS alert listing, rescue mission assignment, and lifecycle transitions."""
    db_avail = await check_db_available()
    if not db_avail:
        pytest.skip("PostgreSQL DB not reachable in test runner environment.")

    # 1. Register fisherman & create SOS
    reg_res = await client.post(
        "/api/v1/auth/register",
        json={
            "phone": "9998887776",
            "email": "deepsea.fisherman@example.com",
            "password": "pass123456password",
            "name": "Deep Sea Fisherman",
        },
    )
    assert reg_res.status_code == 201
    token = (
        await client.post(
            "/api/v1/auth/login",
            json={"email": "deepsea.fisherman@example.com", "password": "pass123456password"},
        )
    ).json()["access_token"]
    headers = {"Authorization": f"Bearer {token}"}

    public_id = str(uuid.uuid4())
    sos_res = await client.post(
        "/api/v1/sos",
        json={
            "public_sos_id": public_id,
            "latitude": 13.1200,
            "longitude": 80.3100,
            "emergency_type": "Medical emergency",
            "priority": "CRITICAL",
            "description": "Crew member severe head trauma",
        },
        headers=headers,
    )
    assert sos_res.status_code == 201
    sos_id = sos_res.json()["id"]

    # 2. Coastal Guard Dashboard
    dash_res = await client.get("/api/v1/coastal-guard/dashboard")
    assert dash_res.status_code == 200
    dash_data = dash_res.json()
    assert dash_data["active_sos_count"] >= 1
    assert dash_data["critical_alerts_count"] >= 1

    # 3. List Coastal Guard SOS alerts with filter
    list_res = await client.get("/api/v1/coastal-guard/sos?priority=CRITICAL")
    assert list_res.status_code == 200
    alerts = list_res.json()
    assert any(a["id"] == sos_id for a in alerts)

    # 4. Create Rescue Mission
    mission_res = await client.post(
        "/api/v1/coastal-guard/missions",
        json={
            "sos_alert_id": sos_id,
            "officer_name": "Cmdr. V. Raman (ICG)",
            "rescue_team": "ICG Tactical Squadron 04",
            "rescue_vessel": "ICGS C-438 Fast Patrol Boat",
            "eta_minutes": 20,
            "notes": "Medical kit and paramedic deployed.",
        },
    )
    assert mission_res.status_code == 201
    mission_data = mission_res.json()
    assert mission_data["status"] == "ASSIGNED"
    assert mission_data["rescue_vessel"] == "ICGS C-438 Fast Patrol Boat"
    mission_id = mission_data["id"]

    # Verify SOS status updated to RESCUE_ASSIGNED
    sos_detail = await client.get(f"/api/v1/coastal-guard/sos/{sos_id}")
    assert sos_detail.status_code == 200
    assert sos_detail.json()["status"] == "RESCUE_ASSIGNED"

    # 5. Transition Mission: DEPARTED
    update_res1 = await client.patch(
        f"/api/v1/coastal-guard/missions/{mission_id}",
        json={"status": "DEPARTED", "notes": "Vessel left harbor"},
    )
    assert update_res1.status_code == 200
    assert update_res1.json()["status"] == "DEPARTED"

    # 6. Complete Mission -> Automatically marks SOS as RESOLVED
    update_res2 = await client.patch(
        f"/api/v1/coastal-guard/missions/{mission_id}",
        json={"status": "COMPLETED", "notes": "Patient transferred to hospital safely."},
    )
    assert update_res2.status_code == 200
    assert update_res2.json()["status"] == "COMPLETED"

    # Check that SOS status is now RESOLVED
    sos_resolved = await client.get(f"/api/v1/coastal-guard/sos/{sos_id}")
    assert sos_resolved.status_code == 200
    assert sos_resolved.json()["status"] == "RESOLVED"
