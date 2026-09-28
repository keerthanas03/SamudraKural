import pytest
from httpx import AsyncClient
from tests.conftest import check_db_available

async def register_and_login(client: AsyncClient, email: str = "spatial@example.com") -> tuple[int, str]:
    if not await check_db_available():
        pytest.skip("Database is not available")
    reg_res = await client.post("/api/v1/auth/register", json={
        "name": "Spatial Fisherman",
        "email": email,
        "password": "Password123!",
        "phone": "9876543210",
        "shore_location": {"latitude": 13.0200, "longitude": 80.3500}
    })
    fm_id = reg_res.json()["id"]
    login_res = await client.post("/api/v1/auth/login", json={"email": email, "password": "Password123!"})
    token = login_res.json()["access_token"]
    return fm_id, token

@pytest.mark.anyio
async def test_postgis_nearby_locations(client: AsyncClient):
    fisherman_id, token = await register_and_login(client)
    headers = {"Authorization": f"Bearer {token}"}

    await client.post("/api/v1/locations", json={
        "name": "Center Spot",
        "location": {"latitude": 13.0200, "longitude": 80.3500}
    }, headers=headers)

    await client.post("/api/v1/locations", json={
        "name": "1.1km Spot",
        "location": {"latitude": 13.0300, "longitude": 80.3500}
    }, headers=headers)

    await client.post("/api/v1/locations", json={
        "name": "3.3km Spot",
        "location": {"latitude": 13.0500, "longitude": 80.3500}
    }, headers=headers)

    await client.post("/api/v1/locations", json={
        "name": "55km Spot Far Away",
        "location": {"latitude": 13.5000, "longitude": 80.3500}
    }, headers=headers)

    response = await client.get("/api/v1/locations/nearby?latitude=13.0200&longitude=80.3500&radius_meters=5000", headers=headers)
    assert response.status_code == 200
    results = response.json()

    assert len(results) == 3

    distances = [res["distance_meters"] for res in results]
    assert distances == sorted(distances)

    names = [res["name"] for res in results]
    assert names == ["Center Spot", "1.1km Spot", "3.3km Spot"]

    assert abs(results[0]["distance_meters"] - 0.0) < 1.0
    assert 1000.0 < results[1]["distance_meters"] < 1300.0
    assert 3000.0 < results[2]["distance_meters"] < 3600.0

@pytest.mark.anyio
async def test_nearby_locations_invalid_radius(client: AsyncClient):
    _, token = await register_and_login(client, "invalidradius@example.com")
    headers = {"Authorization": f"Bearer {token}"}
    res = await client.get("/api/v1/locations/nearby?latitude=13.02&longitude=80.35&radius_meters=-50", headers=headers)
    assert res.status_code == 422
