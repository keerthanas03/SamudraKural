import pytest
from datetime import datetime, timezone, timedelta
from httpx import AsyncClient
from sqlalchemy import select, func, text
from app.db.session import AsyncSessionLocal
from app.models.user_location import UserCurrentLocation
from app.models.fisherman import Fisherman
from app.models.boat import Boat
from app.services.spatial import wkt_from_lat_lon
from tests.conftest import check_db_available

async def register_and_login(client: AsyncClient, email: str, name: str = "Test Fisherman", phone: str = "9876543210") -> tuple[int, str]:
    reg_res = await client.post("/api/v1/auth/register", json={
        "name": name,
        "email": email,
        "password": "Password123!",
        "phone": phone,
        "shore_location": {"latitude": 13.0827, "longitude": 80.2707}
    })
    fm_id = reg_res.json()["id"]
    login_res = await client.post("/api/v1/auth/login", json={"email": email, "password": "Password123!"})
    token = login_res.json()["access_token"]
    return fm_id, token

@pytest.mark.anyio
async def test_live_location_unauthenticated_rejected(client: AsyncClient):
    """Test 2: Unauthenticated POST is rejected with 401."""
    res = await client.post("/api/v1/locations/live", json={
        "latitude": 13.0827,
        "longitude": 80.2707,
        "accuracy_meters": 10.0,
    })
    assert res.status_code == 401

@pytest.mark.anyio
async def test_live_location_invalid_coordinates_and_battery(client: AsyncClient):
    """Test 6, 7, 8: Invalid latitude, longitude, and battery rejected with 422."""
    is_db = await check_db_available()
    if not is_db:
        pytest.skip("Database is not available")

    _, token = await register_and_login(client, "validation_user@example.com")
    headers = {"Authorization": f"Bearer {token}"}

    # Invalid latitude (> 90)
    res_lat = await client.post("/api/v1/locations/live", json={
        "latitude": 95.0,
        "longitude": 80.0,
    }, headers=headers)
    assert res_lat.status_code == 422

    # Invalid longitude (< -180)
    res_lon = await client.post("/api/v1/locations/live", json={
        "latitude": 13.0,
        "longitude": -185.0,
    }, headers=headers)
    assert res_lon.status_code == 422

    # Invalid battery (> 100)
    res_batt = await client.post("/api/v1/locations/live", json={
        "latitude": 13.0,
        "longitude": 80.0,
        "battery_percent": 150,
    }, headers=headers)
    assert res_batt.status_code == 422

@pytest.mark.anyio
async def test_live_location_insert_and_upsert_single_row(client: AsyncClient):
    """Test 1, 3, 4, 5, 19: Insert live location and ensure subsequent heartbeats update the same row."""
    is_db = await check_db_available()
    if not is_db:
        pytest.skip("Database is not available")

    fm_id, token = await register_and_login(client, "single_row_user@example.com")
    headers = {"Authorization": f"Bearer {token}"}

    # 1. First heartbeat
    res1 = await client.post("/api/v1/locations/live", json={
        "latitude": 13.0827,
        "longitude": 80.2707,
        "accuracy_meters": 12.0,
        "speed_mps": 2.5,
        "heading_degrees": 90.0,
        "battery_percent": 90,
    }, headers=headers)
    assert res1.status_code == 200
    data1 = res1.json()
    assert data1["fisherman_id"] == fm_id
    assert data1["latitude"] == pytest.approx(13.0827)
    assert data1["longitude"] == pytest.approx(80.2707)
    assert data1["is_active"] is True
    first_id = data1["id"]

    # 2. Second heartbeat (different coords)
    res2 = await client.post("/api/v1/locations/live", json={
        "latitude": 13.0900,
        "longitude": 80.2800,
        "accuracy_meters": 8.0,
        "speed_mps": 4.0,
        "heading_degrees": 120.0,
        "battery_percent": 85,
    }, headers=headers)
    assert res2.status_code == 200
    data2 = res2.json()
    assert data2["id"] == first_id  # Must be the exact same row ID
    assert data2["latitude"] == pytest.approx(13.0900)
    assert data2["longitude"] == pytest.approx(80.2800)
    assert data2["speed_mps"] == pytest.approx(4.0)

    # 3. Third heartbeat
    res3 = await client.post("/api/v1/locations/live", json={
        "latitude": 13.0950,
        "longitude": 80.2850,
    }, headers=headers)
    assert res3.status_code == 200
    assert res3.json()["id"] == first_id

    # Verify directly in database that exactly ONE row exists for this fisherman
    async with AsyncSessionLocal() as session:
        result = await session.execute(
            select(func.count(UserCurrentLocation.id)).where(UserCurrentLocation.fisherman_id == fm_id)
        )
        count = result.scalar()
        assert count == 1

@pytest.mark.anyio
async def test_live_location_deactivate(client: AsyncClient):
    """Test 18: Deactivate endpoint marks is_active=False only for current user."""
    is_db = await check_db_available()
    if not is_db:
        pytest.skip("Database is not available")

    fm_id1, token1 = await register_and_login(client, "user_deact1@example.com")
    fm_id2, token2 = await register_and_login(client, "user_deact2@example.com")

    # Both send live location
    await client.post("/api/v1/locations/live", json={"latitude": 13.08, "longitude": 80.27}, headers={"Authorization": f"Bearer {token1}"})
    await client.post("/api/v1/locations/live", json={"latitude": 13.09, "longitude": 80.28}, headers={"Authorization": f"Bearer {token2}"})

    # User 1 deactivates
    res_deact = await client.post("/api/v1/locations/live/deactivate", headers={"Authorization": f"Bearer {token1}"})
    assert res_deact.status_code == 200
    assert res_deact.json()["is_active"] is False

    # Check database state
    async with AsyncSessionLocal() as session:
        loc1 = (await session.execute(select(UserCurrentLocation).where(UserCurrentLocation.fisherman_id == fm_id1))).scalar_one()
        loc2 = (await session.execute(select(UserCurrentLocation).where(UserCurrentLocation.fisherman_id == fm_id2))).scalar_one()
        assert loc1.is_active is False
        assert loc2.is_active is True

@pytest.mark.anyio
async def test_nearby_endpoint_requires_auth(client: AsyncClient):
    """Test 10: Nearby endpoint requires authentication."""
    res = await client.get("/api/v1/locations/nearby-fishermen")
    assert res.status_code == 401

@pytest.mark.anyio
async def test_nearby_endpoint_invalid_radius(client: AsyncClient):
    """Test 9: Invalid radius rejected with 422."""
    is_db = await check_db_available()
    if not is_db:
        pytest.skip("Database is not available")

    _, token = await register_and_login(client, "radius_user@example.com")
    headers = {"Authorization": f"Bearer {token}"}

    # Radius < 0.1
    res_low = await client.get("/api/v1/locations/nearby-fishermen?radius_km=0.05", headers=headers)
    assert res_low.status_code == 422

    # Radius > 100
    res_high = await client.get("/api/v1/locations/nearby-fishermen?radius_km=150", headers=headers)
    assert res_high.status_code == 422

@pytest.mark.anyio
async def test_user_without_live_location_returns_404(client: AsyncClient):
    """Test 17: User without current location receives clear 404 response."""
    is_db = await check_db_available()
    if not is_db:
        pytest.skip("Database is not available")

    _, token = await register_and_login(client, "no_loc_user@example.com")
    headers = {"Authorization": f"Bearer {token}"}

    res = await client.get("/api/v1/locations/nearby-fishermen", headers=headers)
    assert res.status_code == 404
    assert "CURRENT LOCATION UNAVAILABLE" in res.json()["detail"]

@pytest.mark.anyio
async def test_nearby_fishermen_discovery_and_filtering(client: AsyncClient):
    """
    Test 11, 12, 13, 14, 15, 16:
    - Current fisherman is excluded.
    - Nearby active fisherman is returned.
    - Far-away fisherman is excluded.
    - Stale fisherman is excluded.
    - Inactive fisherman is excluded.
    - Results are ordered nearest first.
    """
    is_db = await check_db_available()
    if not is_db:
        pytest.skip("Database is not available")

    # 1. Main user (Caller at Chennai Port: 13.0827, 80.2707)
    fm_main, token_main = await register_and_login(client, "caller_main@example.com", name="Main Caller", phone="9000000001")
    headers_main = {"Authorization": f"Bearer {token_main}"}
    await client.post("/api/v1/locations/live", json={"latitude": 13.0827, "longitude": 80.2707}, headers=headers_main)

    # 2. Peer 1: Close neighbor (approx ~1.5 km away at 13.0900, 80.2800)
    fm_p1, token_p1 = await register_and_login(client, "peer1_near@example.com", name="Near Boat Captain", phone="9000000002")
    headers_p1 = {"Authorization": f"Bearer {token_p1}"}
    await client.post("/api/v1/locations/live", json={"latitude": 13.0900, "longitude": 80.2800}, headers=headers_p1)

    # 3. Peer 2: Medium distance (~6 km away at 13.1200, 80.3100)
    fm_p2, token_p2 = await register_and_login(client, "peer2_med@example.com", name="Med Boat Captain", phone="9000000003")
    headers_p2 = {"Authorization": f"Bearer {token_p2}"}
    await client.post("/api/v1/locations/live", json={"latitude": 13.1200, "longitude": 80.3100}, headers=headers_p2)

    # 4. Peer 3: Far away (~60 km away at 13.5000, 80.5000)
    fm_p3, token_p3 = await register_and_login(client, "peer3_far@example.com", name="Far Boat Captain", phone="9000000004")
    headers_p3 = {"Authorization": f"Bearer {token_p3}"}
    await client.post("/api/v1/locations/live", json={"latitude": 13.5000, "longitude": 80.5000}, headers=headers_p3)

    # 5. Peer 4: Inactive neighbor (close by at 13.0850, 80.2750, but deactivated)
    fm_p4, token_p4 = await register_and_login(client, "peer4_inactive@example.com", name="Inactive Captain", phone="9000000005")
    headers_p4 = {"Authorization": f"Bearer {token_p4}"}
    await client.post("/api/v1/locations/live", json={"latitude": 13.0850, "longitude": 80.2750}, headers=headers_p4)
    await client.post("/api/v1/locations/live/deactivate", headers=headers_p4)

    # 6. Peer 5: Stale neighbor (close by at 13.0860, 80.2760, but updated 5 minutes ago)
    fm_p5, token_p5 = await register_and_login(client, "peer5_stale@example.com", name="Stale Captain", phone="9000000006")
    headers_p5 = {"Authorization": f"Bearer {token_p5}"}
    await client.post("/api/v1/locations/live", json={"latitude": 13.0860, "longitude": 80.2760}, headers=headers_p5)
    # Manually age the record in DB to simulate staleness
    async with AsyncSessionLocal() as session:
        stale_time = datetime.now(timezone.utc) - timedelta(seconds=300)
        await session.execute(
            text("UPDATE user_current_locations SET updated_at = :stale_time WHERE fisherman_id = :fid"),
            {"stale_time": stale_time, "fid": fm_p5}
        )
        await session.commit()

    # Query nearby with radius = 10 km
    res = await client.get("/api/v1/locations/nearby-fishermen?radius_km=10", headers=headers_main)
    assert res.status_code == 200
    results = res.json()

    # Verify results:
    # - Must contain Peer 1 and Peer 2
    # - Must NOT contain caller (Test 11)
    # - Must NOT contain Peer 3 (Far away > 10 km, Test 13)
    # - Must NOT contain Peer 4 (Inactive, Test 15)
    # - Must NOT contain Peer 5 (Stale, Test 14)
    result_ids = [r["fisherman_id"] for r in results]
    assert fm_main not in result_ids
    assert fm_p1 in result_ids
    assert fm_p2 in result_ids
    assert fm_p3 not in result_ids
    assert fm_p4 not in result_ids
    assert fm_p5 not in result_ids

    # Verify nearest first ordering (Test 16)
    assert len(results) == 2
    assert results[0]["fisherman_id"] == fm_p1
    assert results[1]["fisherman_id"] == fm_p2
    assert results[0]["distance_meters"] < results[1]["distance_meters"]
