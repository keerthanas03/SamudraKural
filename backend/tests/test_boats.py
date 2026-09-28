import pytest
from httpx import AsyncClient
from tests.conftest import check_db_available

async def register_and_login(client: AsyncClient, email: str) -> tuple[int, str]:
    if not await check_db_available():
        pytest.skip("Database is not available")
    reg_res = await client.post("/api/v1/auth/register", json={
        "name": "Boat Owner",
        "email": email,
        "password": "Password123!",
        "phone": "9876543210",
        "shore_location": {"latitude": 13.0, "longitude": 80.0}
    })
    fm_id = reg_res.json()["id"]
    login_res = await client.post("/api/v1/auth/login", json={"email": email, "password": "Password123!"})
    token = login_res.json()["access_token"]
    return fm_id, token

@pytest.mark.anyio
async def test_create_and_get_boat(client: AsyncClient):
    fisherman_id, token = await register_and_login(client, "createboat@example.com")

    boat_payload = {
        "name": "Boat 01",
        "registration_number": "TN-XX-1234",
        "boat_type": "small_fishing_boat"
    }
    headers = {"Authorization": f"Bearer {token}"}
    create_res = await client.post("/api/v1/boats", json=boat_payload, headers=headers)
    assert create_res.status_code == 201
    boat_data = create_res.json()
    assert boat_data["id"] is not None
    assert boat_data["fisherman_id"] == fisherman_id
    assert boat_data["name"] == "Boat 01"
    assert boat_data["registration_number"] == "TN-XX-1234"
    assert boat_data["boat_type"] == "small_fishing_boat"

    boat_id = boat_data["id"]
    get_res = await client.get(f"/api/v1/boats/{boat_id}", headers=headers)
    assert get_res.status_code == 200
    assert get_res.json()["id"] == boat_id

    fm_boat_res = await client.get(f"/api/v1/fishermen/{fisherman_id}/boat", headers=headers)
    assert fm_boat_res.status_code == 200
    assert fm_boat_res.json()["id"] == boat_id

@pytest.mark.anyio
async def test_get_nonexistent_boat_returns_404(client: AsyncClient):
    _, token = await register_and_login(client, "nonexistentboat@example.com")
    headers = {"Authorization": f"Bearer {token}"}
    response = await client.get("/api/v1/boats/999999", headers=headers)
    assert response.status_code == 404
    assert response.json()["detail"] == "Boat not found"

@pytest.mark.anyio
async def test_get_boat_for_fisherman_without_boat_returns_404(client: AsyncClient):
    fisherman_id, token = await register_and_login(client, "noboat@example.com")
    headers = {"Authorization": f"Bearer {token}"}

    response = await client.get(f"/api/v1/fishermen/{fisherman_id}/boat", headers=headers)
    assert response.status_code == 404
    assert response.json()["detail"] == "No boat found for this fisherman"

@pytest.mark.anyio
async def test_get_boat_for_other_fisherman_returns_403(client: AsyncClient):
    f1_id, token1 = await register_and_login(client, "owner1@example.com")
    f2_id, token2 = await register_and_login(client, "owner2@example.com")

    # F2 tries to fetch F1's boat endpoint
    response = await client.get(f"/api/v1/fishermen/{f1_id}/boat", headers={"Authorization": f"Bearer {token2}"})
    assert response.status_code == 403
    assert response.json()["detail"] == "Forbidden: Cannot access another fisherman's boat"
