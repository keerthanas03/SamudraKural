import pytest
from httpx import AsyncClient
from tests.conftest import check_db_available

async def register_and_login(
    client: AsyncClient,
    email: str,
    shore_lat: float = 13.0827,
    shore_lon: float = 80.2707
) -> tuple[int, str]:
    if not await check_db_available():
        pytest.skip("Database is not available")
    reg_res = await client.post("/api/v1/auth/register", json={
        "name": "Navigation Fisherman",
        "email": email,
        "password": "Password123!",
        "phone": "9876543210",
        "shore_location": {"latitude": shore_lat, "longitude": shore_lon}
    })
    fm_id = reg_res.json()["id"]
    login_res = await client.post("/api/v1/auth/login", json={"email": email, "password": "Password123!"})
    token = login_res.json()["access_token"]
    return fm_id, token

@pytest.mark.anyio
async def test_navigate_to_shore_success(client: AsyncClient):
    _, token = await register_and_login(client, "navshore@example.com")
    headers = {"Authorization": f"Bearer {token}"}

    res = await client.get(
        "/api/v1/navigation/to-shore?latitude=13.0827&longitude=80.3707",
        headers=headers
    )
    assert res.status_code == 200
    data = res.json()
    assert data["target"] == "shore"
    assert data["current_location"] == {"latitude": 13.0827, "longitude": 80.3707}
    assert data["target_location"] == {"latitude": 13.0827, "longitude": 80.2707}
    assert 10000.0 < data["distance_meters"] < 12000.0
    assert 0.0 <= data["bearing_degrees"] < 360.0
    assert 260.0 < data["bearing_degrees"] < 280.0
    assert data["direction"] == "W"

@pytest.mark.anyio
async def test_navigate_to_own_location_success(client: AsyncClient):
    _, token = await register_and_login(client, "navownloc@example.com")
    headers = {"Authorization": f"Bearer {token}"}

    loc_res = await client.post("/api/v1/locations", json={
        "name": "Secret Reef",
        "location": {"latitude": 13.1000, "longitude": 80.3000},
        "notes": "Good tuna spot"
    }, headers=headers)
    loc_id = loc_res.json()["id"]

    res = await client.get(
        f"/api/v1/navigation/to-location/{loc_id}?latitude=13.0000&longitude=80.3000",
        headers=headers
    )
    assert res.status_code == 200
    data = res.json()
    assert data["target"] == {"id": loc_id, "name": "Secret Reef"}
    assert data["target_location"] == {"latitude": 13.1000, "longitude": 80.3000}
    assert 10000.0 < data["distance_meters"] < 12000.0
    assert (355.0 <= data["bearing_degrees"] or data["bearing_degrees"] <= 5.0)
    assert data["direction"] == "N"

@pytest.mark.anyio
async def test_navigate_to_other_fisherman_location_returns_403(client: AsyncClient):
    _, token1 = await register_and_login(client, "navf1@example.com")
    _, token2 = await register_and_login(client, "navf2@example.com")

    loc_res = await client.post("/api/v1/locations", json={
        "name": "F1 Secret Spot",
        "location": {"latitude": 13.1000, "longitude": 80.3000}
    }, headers={"Authorization": f"Bearer {token1}"})
    loc_id = loc_res.json()["id"]

    res = await client.get(
        f"/api/v1/navigation/to-location/{loc_id}?latitude=13.0000&longitude=80.3000",
        headers={"Authorization": f"Bearer {token2}"}
    )
    assert res.status_code == 403
    assert res.json()["detail"] == "Forbidden: You do not own this fishing location"

@pytest.mark.anyio
async def test_navigate_nearest_location(client: AsyncClient):
    _, token = await register_and_login(client, "navnearest@example.com")
    headers = {"Authorization": f"Bearer {token}"}

    await client.post("/api/v1/locations", json={
        "name": "Far Spot (15km)",
        "location": {"latitude": 13.2000, "longitude": 80.3000}
    }, headers=headers)

    near_res = await client.post("/api/v1/locations", json={
        "name": "Nearest Spot (2km)",
        "location": {"latitude": 13.0200, "longitude": 80.3000}
    }, headers=headers)
    near_id = near_res.json()["id"]

    res = await client.get(
        "/api/v1/navigation/nearest-location?latitude=13.0000&longitude=80.3000&radius_meters=10000",
        headers=headers
    )
    assert res.status_code == 200
    data = res.json()
    assert data["target"] == {"id": near_id, "name": "Nearest Spot (2km)"}
    assert 2000.0 < data["distance_meters"] < 2500.0

@pytest.mark.anyio
async def test_navigate_nearest_location_outside_radius_returns_404(client: AsyncClient):
    _, token = await register_and_login(client, "navoutradius@example.com")
    headers = {"Authorization": f"Bearer {token}"}

    await client.post("/api/v1/locations", json={
        "name": "Far Spot",
        "location": {"latitude": 13.2000, "longitude": 80.3000}
    }, headers=headers)

    res = await client.get(
        "/api/v1/navigation/nearest-location?latitude=13.0000&longitude=80.3000&radius_meters=1000",
        headers=headers
    )
    assert res.status_code == 404
    assert res.json()["detail"] == "No saved fishing location found within the specified radius"

@pytest.mark.anyio
async def test_navigation_status(client: AsyncClient):
    _, token = await register_and_login(client, "navstatus@example.com", shore_lat=13.0000, shore_lon=80.0000)
    headers = {"Authorization": f"Bearer {token}"}

    res = await client.get(
        "/api/v1/navigation/status?latitude=13.0000&longitude=80.1000",
        headers=headers
    )
    assert res.status_code == 200
    data = res.json()
    assert "distance_to_shore_meters" in data
    assert "bearing_to_shore_degrees" in data
    assert data["direction_to_shore"] == "W"

@pytest.mark.anyio
async def test_navigation_nonexistent_location_returns_404(client: AsyncClient):
    _, token = await register_and_login(client, "navnonexist@example.com")
    headers = {"Authorization": f"Bearer {token}"}

    res = await client.get(
        "/api/v1/navigation/to-location/999999?latitude=13.0000&longitude=80.0000",
        headers=headers
    )
    assert res.status_code == 404
    assert res.json()["detail"] == "Fishing location not found"

@pytest.mark.anyio
async def test_navigation_invalid_coordinates(client: AsyncClient):
    _, token = await register_and_login(client, "navinvalidcoords@example.com")
    headers = {"Authorization": f"Bearer {token}"}

    res_lat = await client.get(
        "/api/v1/navigation/to-shore?latitude=95.0&longitude=80.0",
        headers=headers
    )
    assert res_lat.status_code == 422

    res_lon = await client.get(
        "/api/v1/navigation/to-shore?latitude=13.0&longitude=-190.0",
        headers=headers
    )
    assert res_lon.status_code == 422

@pytest.mark.anyio
async def test_navigation_missing_auth_returns_401(client: AsyncClient):
    res = await client.get("/api/v1/navigation/to-shore?latitude=13.0&longitude=80.0")
    assert res.status_code == 401
