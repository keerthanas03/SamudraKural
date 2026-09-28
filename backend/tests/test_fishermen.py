import pytest
from httpx import AsyncClient
from tests.conftest import check_db_available

@pytest.mark.anyio
async def test_get_fisherman_success(client: AsyncClient):
    if not await check_db_available():
        pytest.skip("Database is not available")
    reg_payload = {
        "name": "Raman",
        "email": "raman_success@example.com",
        "password": "Password123!",
        "phone": "9123456789",
        "shore_location": {
            "latitude": 12.9000,
            "longitude": 80.1000
        }
    }
    reg_res = await client.post("/api/v1/auth/register", json=reg_payload)
    assert reg_res.status_code == 201
    fisherman_id = reg_res.json()["id"]

    login_res = await client.post("/api/v1/auth/login", json={"email": "raman_success@example.com", "password": "Password123!"})
    token = login_res.json()["access_token"]

    get_res = await client.get(
        f"/api/v1/fishermen/{fisherman_id}",
        headers={"Authorization": f"Bearer {token}"}
    )
    assert get_res.status_code == 200
    data = get_res.json()
    assert data["id"] == fisherman_id
    assert data["name"] == "Raman"
    assert data["email"] == "raman_success@example.com"
    assert data["shore_location"]["latitude"] == pytest.approx(12.9000)
    assert data["shore_location"]["longitude"] == pytest.approx(80.1000)

@pytest.mark.anyio
async def test_get_other_fisherman_returns_403(client: AsyncClient):
    if not await check_db_available():
        pytest.skip("Database is not available")
    reg_payload = {
        "name": "Raman",
        "email": "raman_other@example.com",
        "password": "Password123!",
        "phone": "9123456789",
        "shore_location": {"latitude": 12.9000, "longitude": 80.1000}
    }
    reg_res = await client.post("/api/v1/auth/register", json=reg_payload)
    assert reg_res.status_code == 201
    token = (await client.post("/api/v1/auth/login", json={"email": "raman_other@example.com", "password": "Password123!"})).json()["access_token"]

    response = await client.get("/api/v1/fishermen/999999", headers={"Authorization": f"Bearer {token}"})
    assert response.status_code == 403
    assert response.json()["detail"] == "Forbidden: Cannot access another fisherman's data"

@pytest.mark.anyio
async def test_register_invalid_coordinates(client: AsyncClient):
    payload = {
        "name": "Invalid Location",
        "email": "invalid_coords@example.com",
        "password": "Password123!",
        "phone": "9876543210",
        "shore_location": {
            "latitude": 195.0,
            "longitude": 80.2824
        }
    }
    response = await client.post("/api/v1/auth/register", json=payload)
    assert response.status_code == 422
