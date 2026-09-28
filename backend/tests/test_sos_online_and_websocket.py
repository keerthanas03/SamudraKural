import pytest
import uuid
from httpx import AsyncClient
from tests.conftest import check_db_available
from app.websockets.manager import ws_manager


@pytest.mark.asyncio
async def test_websocket_manager_registration():
    """Test connection manager adds, targets, and removes connections safely."""
    class DummyWS:
        def __init__(self):
            self.sent = []
        async def send_text(self, data):
            self.sent.append(data)

    dummy_ws = DummyWS()
    await ws_manager.connect(dummy_ws, user_id=42, is_coastal_guard=True)

    assert 42 in ws_manager.active_connections
    assert dummy_ws in ws_manager.coastal_guard_connections

    # Targeted send to user
    await ws_manager.send_to_user(42, "TEST_EVENT", {"msg": "hello"})
    assert len(dummy_ws.sent) == 1
    assert "TEST_EVENT" in dummy_ws.sent[0]

    # Targeted send to coastal guard
    await ws_manager.broadcast_to_coastal_guard("CG_EVENT", {"alert_id": 99})
    assert len(dummy_ws.sent) == 2
    assert "CG_EVENT" in dummy_ws.sent[1]

    # Disconnect
    ws_manager.disconnect(dummy_ws, user_id=42)
    assert 42 not in ws_manager.active_connections
    assert dummy_ws not in ws_manager.coastal_guard_connections


@pytest.mark.asyncio
async def test_online_sos_creation_and_idempotency(client: AsyncClient):
    """Test creating an SOS online, idempotency by public_sos_id, response, and cancellation."""
    db_avail = await check_db_available()
    if not db_avail:
        pytest.skip("PostgreSQL DB not reachable in test runner environment.")

    # 1. Register a fisherman
    reg_res = await client.post(
        "/api/v1/auth/register",
        json={
            "phone": "9876543210",
            "email": "captain.velu@example.com",
            "password": "securepassword123",
            "name": "Captain Velu",
        },
    )
    assert reg_res.status_code == 201

    # Login to get JWT
    login_res = await client.post(
        "/api/v1/auth/login",
        json={"email": "captain.velu@example.com", "password": "securepassword123"},
    )
    assert login_res.status_code == 200
    token = login_res.json()["access_token"]
    headers = {"Authorization": f"Bearer {token}"}

    # 2. Create online SOS with unique public_sos_id
    public_id = str(uuid.uuid4())
    sos_payload = {
        "public_sos_id": public_id,
        "latitude": 13.0827,
        "longitude": 80.2707,
        "location_accuracy_meters": 10.0,
        "battery_percent": 88,
        "emergency_type": "Boat problem",
        "description": "Engine failure near Kasimedu harbor",
        "people_affected": 3,
        "priority": "CRITICAL",
        "delivery_status": "ONLINE",
    }

    create_res = await client.post("/api/v1/sos", json=sos_payload, headers=headers)
    assert create_res.status_code == 201
    data = create_res.json()
    assert data["public_sos_id"] == public_id
    assert data["status"] == "ACTIVE"
    assert data["delivery_status"] == "ONLINE"
    assert data["fisherman"]["name"] == "Captain Velu"
    sos_id = data["id"]

    # 3. Test Idempotency: submitting same public_sos_id returns existing record without duplicate
    dup_res = await client.post("/api/v1/sos", json=sos_payload, headers=headers)
    assert dup_res.status_code == 200
    dup_data = dup_res.json()
    assert dup_data["id"] == sos_id
    assert dup_data["public_sos_id"] == public_id

    # 4. Register a second fisherman to respond
    reg2_res = await client.post(
        "/api/v1/auth/register",
        json={
            "phone": "9876543211",
            "email": "captain.murugan@example.com",
            "password": "securepassword123",
            "name": "Captain Murugan",
        },
    )
    assert reg2_res.status_code == 201
    token2 = (
        await client.post(
            "/api/v1/auth/login",
            json={"email": "captain.murugan@example.com", "password": "securepassword123"},
        )
    ).json()["access_token"]
    headers2 = {"Authorization": f"Bearer {token2}"}

    # Second fisherman responds YES_HELP
    resp_res = await client.post(
        f"/api/v1/sos/{public_id}/respond",
        json={
            "response": "YES_HELP",
            "latitude": 13.0900,
            "longitude": 80.2800,
            "message": "Heading your way!",
        },
        headers=headers2,
    )
    assert resp_res.status_code == 200
    assert resp_res.json()["response"] == "YES_HELP"
    assert resp_res.json()["sos_alert_status"] == "HELP_ON_THE_WAY"

    # Duplicate response from same fisherman updates rather than crashing
    resp_res2 = await client.post(
        f"/api/v1/sos/{public_id}/respond",
        json={"response": "YES_HELP", "message": "Updated ETA 5 mins"},
        headers=headers2,
    )
    assert resp_res2.status_code == 200

    # 5. Patch SOS Location
    loc_patch = await client.patch(
        f"/api/v1/sos/{public_id}/location",
        json={"latitude": 13.0850, "longitude": 80.2720, "accuracy_meters": 5.0},
        headers=headers,
    )
    assert loc_patch.status_code == 200
    assert loc_patch.json()["latitude"] == 13.0850

    # 6. Cancel SOS
    cancel_res = await client.post(
        f"/api/v1/sos/{public_id}/cancel",
        json={"reason": "Resolved safely by nearby vessel"},
        headers=headers,
    )
    assert cancel_res.status_code == 200
    assert cancel_res.json()["status"] == "CANCELLED"
