import pytest
from tests.conftest import check_db_available

@pytest.mark.anyio
async def test_health_endpoint(client):
    response = await client.get("/api/v1/health")
    assert response.status_code == 200
    assert response.json() == {
        "status": "ok",
        "service": "samudra-kural-backend"
    }

@pytest.mark.anyio
async def test_db_health_endpoint(client):
    if not await check_db_available():
        pytest.skip("Database is not available")
    response = await client.get("/api/v1/health/db")
    assert response.status_code == 200
    assert response.json()["status"] == "ok"
    assert response.json()["database"] == "connected"

@pytest.mark.anyio
async def test_postgis_health_endpoint(client):
    if not await check_db_available():
        pytest.skip("Database is not available")
    response = await client.get("/api/v1/health/postgis")
    assert response.status_code == 200
    assert response.json()["status"] == "ok"
    assert response.json()["postgis"] == "available"
    assert "version" in response.json()
