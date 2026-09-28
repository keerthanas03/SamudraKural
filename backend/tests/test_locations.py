import pytest
from httpx import AsyncClient
from tests.conftest import check_db_available

async def register_and_login(client: AsyncClient, email: str) -> tuple[int, str]:
    if not await check_db_available():
        pytest.skip("Database is not available")
    reg_res = await client.post("/api/v1/auth/register", json={
        "name": "Location Owner",
        "email": email,
        "password": "Password123!",
        "phone": "9876543210",
        "shore_location": {"latitude": 13.0475, "longitude": 80.2824}
    })
    fm_id = reg_res.json()["id"]
    login_res = await client.post("/api/v1/auth/login", json={"email": email, "password": "Password123!"})
    token = login_res.json()["access_token"]
    return fm_id, token

@pytest.mark.anyio
async def test_create_and_get_location(client: AsyncClient):
    fisherman_id, token = await register_and_login(client, "createloc@example.com")

    loc_payload = {
        "name": "My Fishing Point 1",
        "location": {
            "latitude": 13.0200,
            "longitude": 80.3500
        },
        "notes": "Good fishing area"
    }
    headers = {"Authorization": f"Bearer {token}"}
    create_res = await client.post("/api/v1/locations", json=loc_payload, headers=headers)
    assert create_res.status_code == 201
    loc_data = create_res.json()
    assert loc_data["id"] is not None
    assert loc_data["fisherman_id"] == fisherman_id
    assert loc_data["name"] == "My Fishing Point 1"
    assert loc_data["location"]["latitude"] == pytest.approx(13.0200)
    assert loc_data["location"]["longitude"] == pytest.approx(80.3500)
    assert loc_data["notes"] == "Good fishing area"

    loc_id = loc_data["id"]
    get_res = await client.get(f"/api/v1/locations/{loc_id}", headers=headers)
    assert get_res.status_code == 200
    assert get_res.json()["id"] == loc_id

@pytest.mark.anyio
async def test_get_fisherman_locations(client: AsyncClient):
    fisherman_id, token = await register_and_login(client, "multi@example.com")
    headers = {"Authorization": f"Bearer {token}"}

    await client.post("/api/v1/locations", json={
        "name": "Point A",
        "location": {"latitude": 13.01, "longitude": 80.01}
    }, headers=headers)
    await client.post("/api/v1/locations", json={
        "name": "Point B",
        "location": {"latitude": 13.02, "longitude": 80.02}
    }, headers=headers)

    list_res = await client.get(f"/api/v1/fishermen/{fisherman_id}/locations", headers=headers)
    assert list_res.status_code == 200
    locations = list_res.json()
    assert len(locations) == 2
    names = [loc["name"] for loc in locations]
    assert "Point A" in names
    assert "Point B" in names

@pytest.mark.anyio
async def test_delete_location(client: AsyncClient):
    fisherman_id, token = await register_and_login(client, "deleteowner@example.com")
    headers = {"Authorization": f"Bearer {token}"}

    create_res = await client.post("/api/v1/locations", json={
        "name": "To Delete Point",
        "location": {"latitude": 13.03, "longitude": 80.03}
    }, headers=headers)
    loc_id = create_res.json()["id"]

    del_res = await client.delete(f"/api/v1/locations/{loc_id}", headers=headers)
    assert del_res.status_code == 204

    get_res = await client.get(f"/api/v1/locations/{loc_id}", headers=headers)
    assert get_res.status_code == 404

@pytest.mark.anyio
async def test_get_nonexistent_location_returns_404(client: AsyncClient):
    _, token = await register_and_login(client, "nonexistentloc1@example.com")
    headers = {"Authorization": f"Bearer {token}"}
    res = await client.get("/api/v1/locations/999999", headers=headers)
    assert res.status_code == 404
    assert res.json()["detail"] == "Fishing location not found"

@pytest.mark.anyio
async def test_delete_nonexistent_location_returns_404(client: AsyncClient):
    _, token = await register_and_login(client, "nonexistentloc2@example.com")
    headers = {"Authorization": f"Bearer {token}"}
    res = await client.delete("/api/v1/locations/999999", headers=headers)
    assert res.status_code == 404
    assert res.json()["detail"] == "Fishing location not found"
