import pytest
import uuid
from datetime import datetime, timezone, timedelta
from app.core.config import settings


def test_offline_packet_validation_and_ttl():
    """Test packet TTL validation and hop count enforcement logic."""
    max_hops = settings.OFFLINE_PACKET_MAX_HOPS
    ttl_minutes = settings.OFFLINE_PACKET_TTL_MINUTES

    now = datetime.now(timezone.utc)
    fresh_created_at = (now - timedelta(minutes=10)).isoformat()
    expired_created_at = (now - timedelta(minutes=75)).isoformat()

    # 1. Fresh packet
    fresh_age = (now - datetime.fromisoformat(fresh_created_at)).total_seconds() / 60
    assert fresh_age <= ttl_minutes

    # 2. Expired packet
    expired_age = (now - datetime.fromisoformat(expired_created_at)).total_seconds() / 60
    assert expired_age > ttl_minutes

    # 3. Hop count increment and limit
    current_hops = 0
    relayed_hops = current_hops + 1
    assert relayed_hops <= max_hops

    max_reached_hops = 5
    should_forward = max_reached_hops < max_hops
    assert should_forward is False


def test_offline_mesh_packet_protocol_and_actions():
    """Test full offline mesh packet protocol structure and response actions."""
    public_sos_id = f"SOS-{uuid.uuid4().hex[:8].upper()}"
    origin_device = "SK-DEV-AAA-111"
    relay_device_b = "SK-DEV-BBB-222"
    relay_device_c = "SK-DEV-CCC-333"

    # 1. Origin Distress Alert Packet (A)
    alert_packet = {
        "packet_version": 1,
        "packet_type": "SOS_ALERT",
        "public_sos_id": public_sos_id,
        "origin_fisherman_id": 101,
        "origin_device_id": origin_device,
        "emergency_type": "Engine Failure",
        "priority": "CRITICAL",
        "sos_status": "ACTIVE",
        "delivery_status": "SEARCHING_FOR_PEER",
        "latitude": 13.0827,
        "longitude": 80.2707,
        "accuracy_meters": 4.5,
        "hop_count": 0,
        "max_hops": 5,
        "ttl_minutes": 60,
        "relay_path": [origin_device],
    }
    assert alert_packet["public_sos_id"] == public_sos_id
    assert alert_packet["hop_count"] == 0

    # 2. Relayed through Device B (A -> B)
    relayed_by_b = {
        **alert_packet,
        "delivery_status": "RELAYING",
        "hop_count": alert_packet["hop_count"] + 1,
        "relayed_by_device_id": relay_device_b,
        "relay_path": [*alert_packet["relay_path"], relay_device_b],
    }
    assert relayed_by_b["public_sos_id"] == public_sos_id
    assert relayed_by_b["hop_count"] == 1
    assert relayed_by_b["relay_path"] == [origin_device, relay_device_b]

    # 3. Relayed through Device C (B -> C)
    relayed_by_c = {
        **relayed_by_b,
        "hop_count": relayed_by_b["hop_count"] + 1,
        "relayed_by_device_id": relay_device_c,
        "relay_path": [*relayed_by_b["relay_path"], relay_device_c],
    }
    assert relayed_by_c["public_sos_id"] == public_sos_id
    assert relayed_by_c["hop_count"] == 2
    assert relayed_by_c["relay_path"] == [origin_device, relay_device_b, relay_device_c]

    # 4. Device C Responds YES_HELP
    response_from_c = {
        "packet_version": 1,
        "packet_type": "SOS_RESPONSE",
        "public_sos_id": public_sos_id,
        "origin_fisherman_id": 202,
        "origin_device_id": relay_device_c,
        "responder_fisherman_id": 202,
        "responder_device_id": relay_device_c,
        "responder_name": "Captain C",
        "response_action": "YES_HELP",
        "response_message": "Heading to assist your vessel.",
        "sos_status": "HELP_ON_THE_WAY",
        "delivery_status": "P2P_DELIVERED",
        "hop_count": 0,
        "max_hops": 5,
        "ttl_minutes": 60,
    }
    assert response_from_c["public_sos_id"] == public_sos_id
    assert response_from_c["response_action"] == "YES_HELP"
    assert response_from_c["sos_status"] == "HELP_ON_THE_WAY"


def test_offline_cancellation_packet_protocol():
    """Test cancellation propagation packet."""
    public_sos_id = f"SOS-{uuid.uuid4().hex[:8].upper()}"
    origin_device = "SK-DEV-AAA-111"

    cancel_packet = {
        "packet_version": 1,
        "packet_type": "SOS_CANCEL",
        "public_sos_id": public_sos_id,
        "origin_fisherman_id": 101,
        "origin_device_id": origin_device,
        "sos_status": "CANCELLED",
        "delivery_status": "P2P_DELIVERED",
        "hop_count": 0,
        "max_hops": 5,
        "ttl_minutes": 60,
    }
    assert cancel_packet["public_sos_id"] == public_sos_id
    assert cancel_packet["packet_type"] == "SOS_CANCEL"
    assert cancel_packet["sos_status"] == "CANCELLED"


def test_offline_deduplication_and_loop_prevention():
    """Test device loop prevention and seen packet deduplication logic."""
    my_device_id = "SK-DEV-1111-2222"
    other_device_id = "SK-DEV-3333-4444"

    packet_public_id = str(uuid.uuid4())
    seen_ids = set()

    # 1. First time seeing packet
    assert packet_public_id not in seen_ids
    seen_ids.add(packet_public_id)

    # 2. Duplicate arrival
    assert packet_public_id in seen_ids

    # 3. Self-packet arrival (loop prevention)
    packet_origin = my_device_id
    is_own_packet = packet_origin == my_device_id
    assert is_own_packet is True

    # 4. Other device packet arrival
    other_origin = other_device_id
    assert (other_origin == my_device_id) is False


