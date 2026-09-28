import pytest
from httpx import AsyncClient
from tests.conftest import check_db_available

async def register_and_get_token(client: AsyncClient, name: str, email: str) -> tuple[int, str]:
    if not await check_db_available():
        pytest.skip("Database is not available")
    reg_payload = {
        "name": name,
        "email": email,
        "password": "Password123!",
        "phone": "+919000000000",
        "shore_location": {"latitude": 13.0827, "longitude": 80.2707}
    }
    res = await client.post("/api/v1/auth/register", json=reg_payload)
    assert res.status_code == 201
    user_id = res.json()["id"]

    login_res = await client.post("/api/v1/auth/login", json={"email": email, "password": "Password123!"})
    assert login_res.status_code == 200
    token = login_res.json()["access_token"]
    return user_id, token

@pytest.mark.anyio
async def test_fisherman_profile_access(client: AsyncClient):
    f1_id, token1 = await register_and_get_token(client, "Fisherman One", "f1_prof@example.com")
    f2_id, token2 = await register_and_get_token(client, "Fisherman Two", "f2_prof@example.com")

    # F1 accessing own profile
    res1 = await client.get(f"/api/v1/fishermen/{f1_id}", headers={"Authorization": f"Bearer {token1}"})
    assert res1.status_code == 200
    assert res1.json()["email"] == "f1_prof@example.com"

    # F1 accessing F2's profile -> 403 Forbidden
    res2 = await client.get(f"/api/v1/fishermen/{f2_id}", headers={"Authorization": f"Bearer {token1}"})
    assert res2.status_code == 403
    assert res2.json()["detail"] == "Forbidden: Cannot access another fisherman's data"

@pytest.mark.anyio
async def test_boat_ownership_enforcement(client: AsyncClient):
    f1_id, token1 = await register_and_get_token(client, "Fisherman One", "f1_boat@example.com")
    f2_id, token2 = await register_and_get_token(client, "Fisherman Two", "f2_boat@example.com")

    # F1 creates a boat (no fisherman_id in request body!)
    boat_payload = {
        "name": "Kural Express",
        "registration_number": "TN-01-F-1234",
        "boat_type": "Motorized Trawler"
    }
    create_res = await client.post(
        "/api/v1/boats",
        json=boat_payload,
        headers={"Authorization": f"Bearer {token1}"}
    )
    assert create_res.status_code == 201
    boat_data = create_res.json()
    boat_id = boat_data["id"]
    assert boat_data["fisherman_id"] == f1_id

    # F2 checks own boat -> 404 (F2 has no boat)
    list_res2 = await client.get(f"/api/v1/fishermen/{f2_id}/boat", headers={"Authorization": f"Bearer {token2}"})
    assert list_res2.status_code == 404

    # F1 checks own boat -> returns F1's boat
    list_res1 = await client.get(f"/api/v1/fishermen/{f1_id}/boat", headers={"Authorization": f"Bearer {token1}"})
    assert list_res1.status_code == 200
    assert list_res1.json()["id"] == boat_id

    # F2 tries to fetch F1's boat by ID -> 403 Forbidden
    get_res2 = await client.get(f"/api/v1/boats/{boat_id}", headers={"Authorization": f"Bearer {token2}"})
    assert get_res2.status_code == 403
    assert get_res2.json()["detail"] == "Forbidden: You do not own this boat"

@pytest.mark.anyio
async def test_location_ownership_enforcement(client: AsyncClient):
    f1_id, token1 = await register_and_get_token(client, "Fisherman One", "f1_loc@example.com")
    f2_id, token2 = await register_and_get_token(client, "Fisherman Two", "f2_loc@example.com")

    loc_payload = {
        "name": "F1 Secret Spot",
        "location": {"latitude": 13.1000, "longitude": 80.3000},
        "notes": "Rich fishing spot"
    }
    create_res = await client.post(
        "/api/v1/locations",
        json=loc_payload,
        headers={"Authorization": f"Bearer {token1}"}
    )
    assert create_res.status_code == 201
    loc_id = create_res.json()["id"]

    # F2 tries to GET F1's location -> 403
    get_res = await client.get(f"/api/v1/locations/{loc_id}", headers={"Authorization": f"Bearer {token2}"})
    assert get_res.status_code == 403

    # F2 tries to DELETE F1's location -> 403
    del_res = await client.delete(f"/api/v1/locations/{loc_id}", headers={"Authorization": f"Bearer {token2}"})
    assert del_res.status_code == 403

    # F2 checks nearby locations near (13.1000, 80.3000) -> returns empty list since F2 has no saved locations
    nearby_res = await client.get(
        "/api/v1/locations/nearby?latitude=13.1000&longitude=80.3000&radius_meters=10000",
        headers={"Authorization": f"Bearer {token2}"}
    )
    assert nearby_res.status_code == 200
    assert len(nearby_res.json()) == 0

    # F1 checks nearby locations -> returns F1's location
    nearby_res_f1 = await client.get(
        "/api/v1/locations/nearby?latitude=13.1000&longitude=80.3000&radius_meters=10000",
        headers={"Authorization": f"Bearer {token1}"}
    )
    assert nearby_res_f1.status_code == 200
    assert len(nearby_res_f1.json()) == 1
    assert nearby_res_f1.json()[0]["id"] == loc_id
