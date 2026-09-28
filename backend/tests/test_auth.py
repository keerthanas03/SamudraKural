import pytest
from httpx import AsyncClient
from tests.conftest import check_db_available

@pytest.mark.anyio
async def test_register_fisherman_success(client: AsyncClient):
    if not await check_db_available():
        pytest.skip("Database is not available")
    payload = {
        "name": "Maran",
        "email": "maran_reg@example.com",
        "password": "SecretPassword123",
        "phone": "+919876543210",
        "shore_location": {
            "latitude": 13.0827,
            "longitude": 80.2707
        }
    }
    response = await client.post("/api/v1/auth/register", json=payload)
    assert response.status_code == 201
    data = response.json()
    assert data["email"] == "maran_reg@example.com"
    assert data["name"] == "Maran"
    assert data["phone"] == "+919876543210"
    assert data["is_active"] is True
    assert "password" not in data
    assert "password_hash" not in data
    assert data["shore_location"]["latitude"] == pytest.approx(13.0827)
    assert data["shore_location"]["longitude"] == pytest.approx(80.2707)

@pytest.mark.anyio
async def test_register_duplicate_email(client: AsyncClient):
    if not await check_db_available():
        pytest.skip("Database is not available")
    payload = {
        "name": "Maran",
        "email": "maran_dup@example.com",
        "password": "SecretPassword123",
        "phone": "+919876543210",
        "shore_location": {"latitude": 13.0827, "longitude": 80.2707}
    }
    res1 = await client.post("/api/v1/auth/register", json=payload)
    assert res1.status_code == 201

    res2 = await client.post("/api/v1/auth/register", json=payload)
    assert res2.status_code == 409
    assert res2.json()["detail"] == "Email already registered"

@pytest.mark.anyio
async def test_login_success(client: AsyncClient):
    if not await check_db_available():
        pytest.skip("Database is not available")
    reg_payload = {
        "name": "Maran",
        "email": "maran_login@example.com",
        "password": "SecretPassword123",
        "phone": "+919876543210",
        "shore_location": {"latitude": 13.0827, "longitude": 80.2707}
    }
    reg_res = await client.post("/api/v1/auth/register", json=reg_payload)
    assert reg_res.status_code == 201

    login_payload = {
        "email": "maran_login@example.com",
        "password": "SecretPassword123"
    }
    response = await client.post("/api/v1/auth/login", json=login_payload)
    assert response.status_code == 200
    data = response.json()
    assert "access_token" in data
    assert data["token_type"] == "bearer"

@pytest.mark.anyio
async def test_login_invalid_password(client: AsyncClient):
    if not await check_db_available():
        pytest.skip("Database is not available")
    reg_payload = {
        "name": "Maran",
        "email": "maran_invalidpwd@example.com",
        "password": "SecretPassword123",
        "phone": "+919876543210",
        "shore_location": {"latitude": 13.0827, "longitude": 80.2707}
    }
    reg_res = await client.post("/api/v1/auth/register", json=reg_payload)
    assert reg_res.status_code == 201

    login_payload = {
        "email": "maran_invalidpwd@example.com",
        "password": "WrongPassword"
    }
    response = await client.post("/api/v1/auth/login", json=login_payload)
    assert response.status_code == 401
    assert response.json()["detail"] == "Invalid credentials"

@pytest.mark.anyio
async def test_login_nonexistent_email(client: AsyncClient):
    if not await check_db_available():
        pytest.skip("Database is not available")
    login_payload = {
        "email": "nobody_nonexistent@example.com",
        "password": "SecretPassword123"
    }
    response = await client.post("/api/v1/auth/login", json=login_payload)
    assert response.status_code == 401

@pytest.mark.anyio
async def test_get_me_success(client: AsyncClient):
    if not await check_db_available():
        pytest.skip("Database is not available")
    reg_payload = {
        "name": "Maran",
        "email": "maran_me@example.com",
        "password": "SecretPassword123",
        "phone": "+919876543210",
        "shore_location": {"latitude": 13.0827, "longitude": 80.2707}
    }
    reg_res = await client.post("/api/v1/auth/register", json=reg_payload)
    assert reg_res.status_code == 201

    login_res = await client.post("/api/v1/auth/login", json={"email": "maran_me@example.com", "password": "SecretPassword123"})
    assert login_res.status_code == 200
    token = login_res.json()["access_token"]

    response = await client.get("/api/v1/auth/me", headers={"Authorization": f"Bearer {token}"})
    assert response.status_code == 200
    data = response.json()
    assert data["email"] == "maran_me@example.com"
    assert data["name"] == "Maran"

@pytest.mark.anyio
async def test_get_me_unauthorized(client: AsyncClient):
    response = await client.get("/api/v1/auth/me")
    assert response.status_code == 401

    response_invalid = await client.get("/api/v1/auth/me", headers={"Authorization": "Bearer invalid_token"})
    assert response_invalid.status_code == 401
