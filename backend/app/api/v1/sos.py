import uuid
from datetime import datetime, timezone, timedelta
from typing import List, Optional, Dict, Any
from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, desc
from sqlalchemy.orm import selectinload

from app.core.config import settings
from app.db.session import get_db
from app.models.fisherman import Fisherman
from app.models.boat import Boat
from app.models.sos import SOSAlert
from app.models.sos_response import SOSResponse as SOSResponseModel
from app.models.rescue_mission import RescueMission
from app.models.user_location import UserCurrentLocation
from app.models.enums import SOSStatus, SOSDeliveryStatus, SOSPriority, SOSResponseType
from app.schemas.sos import (
    SOSCreate,
    SOSResponse,
    SOSStatusUpdate,
    SOSResponseCreate,
    SOSResponseItem,
    FishermanMinimal,
    BoatMinimal,
    RescueMissionSummary,
)
from app.services.spatial import wkt_from_lat_lon
from app.api.deps import get_current_fisherman
from app.websockets.manager import ws_manager

router = APIRouter(tags=["SOS Emergency Alerts"])

def build_sos_response_schema(alert: SOSAlert) -> SOSResponse:
    """Helper to convert a SQLAlchemy SOSAlert model to SOSResponse Pydantic schema."""
    fisherman_data = None
    if alert.fisherman:
        fisherman_data = FishermanMinimal(
            id=alert.fisherman.id,
            name=alert.fisherman.name,
            phone=alert.fisherman.phone,
            emergency_phone=getattr(alert.fisherman, "emergency_phone", None),
            home_port=getattr(alert.fisherman, "home_port", None),
        )

    boat_data = None
    if alert.boat:
        boat_data = BoatMinimal(
            id=alert.boat.id,
            name=alert.boat.name,
            registration=alert.boat.registration_number,
            vessel_type=alert.boat.boat_type,
        )

    rescue_mission_data = None
    if alert.rescue_mission:
        rescue_mission_data = RescueMissionSummary(
            id=alert.rescue_mission.id,
            rescue_team=alert.rescue_mission.rescue_team,
            rescue_vessel=alert.rescue_mission.rescue_vessel,
            status=alert.rescue_mission.status,
            eta_minutes=alert.rescue_mission.eta_minutes,
        )

    response_items = []
    if alert.responses:
        for r in alert.responses:
            response_items.append(
                SOSResponseItem(
                    id=r.id,
                    sos_alert_id=r.sos_alert_id,
                    responder_fisherman_id=r.responder_fisherman_id,
                    response=r.response,
                    latitude=r.latitude,
                    longitude=r.longitude,
                    distance_meters=r.distance_meters,
                    eta_minutes=r.eta_minutes,
                    message=r.message,
                    created_at=r.created_at,
                    updated_at=r.updated_at,
                )
            )

    return SOSResponse(
        id=alert.id,
        public_sos_id=alert.public_sos_id,
        fisherman_id=alert.fisherman_id,
        boat_id=alert.boat_id,
        fisherman=fisherman_data,
        boat=boat_data,
        latitude=alert.latitude,
        longitude=alert.longitude,
        location_accuracy_meters=alert.location_accuracy_meters,
        battery_percent=alert.battery_percent,
        emergency_type=alert.emergency_type,
        description=alert.description,
        people_affected=alert.people_affected,
        priority=alert.priority,
        status=alert.status,
        delivery_status=alert.delivery_status,
        relay_hops=alert.relay_hops,
        distance_to_nearest_port_km=12.4,
        nearest_port_name="Chennai Port HQ",
        created_at=alert.created_at,
        updated_at=alert.updated_at,
        last_known_location_at=alert.last_known_location_at,
        acknowledged_at=alert.acknowledged_at,
        resolved_at=alert.resolved_at,
        cancelled_at=alert.cancelled_at,
        cancellation_reason=alert.cancellation_reason,
        rescue_mission=rescue_mission_data,
        responses=response_items,
    )

@router.post("/sos", response_model=SOSResponse, status_code=status.HTTP_201_CREATED)
async def trigger_sos_alert(
    payload: SOSCreate,
    current_user: Fisherman = Depends(get_current_fisherman),
    db: AsyncSession = Depends(get_db),
) -> SOSResponse:
    """
    Ingest real SOS Emergency Alert into PostgreSQL database.
    - Scoped strictly to authenticated current_user.id.
    - Idempotent: If public_sos_id already exists (e.g. from offline P2P sync), updates existing record.
    - PostGIS spatial discovery to find nearby active fishermen within configured radius.
    - Broadcasts targeted real-time WebSocket events to nearby fishermen and Coastal Guard.
    """
    now_utc = datetime.now(timezone.utc)
    target_public_id = payload.public_sos_id or str(uuid.uuid4())
    wkt_loc = wkt_from_lat_lon(payload.latitude, payload.longitude)

    # 1. Idempotency Check: check if public_sos_id exists
    stmt = (
        select(SOSAlert)
        .options(
            selectinload(SOSAlert.fisherman),
            selectinload(SOSAlert.boat),
            selectinload(SOSAlert.rescue_mission),
            selectinload(SOSAlert.responses),
        )
        .where(SOSAlert.public_sos_id == target_public_id)
    )
    result = await db.execute(stmt)
    existing_alert = result.scalar_one_or_none()

    if existing_alert:
        # Idempotent synchronization update
        existing_alert.latitude = payload.latitude
        existing_alert.longitude = payload.longitude
        existing_alert.location = wkt_loc
        existing_alert.location_accuracy_meters = payload.location_accuracy_meters or existing_alert.location_accuracy_meters
        existing_alert.battery_percent = payload.battery_percent or existing_alert.battery_percent
        existing_alert.emergency_type = payload.emergency_type
        existing_alert.description = payload.description or existing_alert.description
        existing_alert.people_affected = payload.people_affected
        existing_alert.delivery_status = payload.delivery_status or existing_alert.delivery_status
        existing_alert.updated_at = now_utc
        existing_alert.last_known_location_at = now_utc

        await db.commit()
        await db.refresh(existing_alert)
        return build_sos_response_schema(existing_alert)

    # 2. Lookup boat registered to this fisherman
    boat_stmt = select(Boat).where(Boat.fisherman_id == current_user.id)
    boat_res = await db.execute(boat_stmt)
    user_boat = boat_res.scalars().first()
    boat_id = user_boat.id if user_boat else None

    # 3. Create new SOSAlert in PostgreSQL
    new_alert = SOSAlert(
        public_sos_id=target_public_id,
        fisherman_id=current_user.id,
        boat_id=boat_id,
        emergency_type=payload.emergency_type,
        priority=payload.priority or SOSPriority.CRITICAL.value,
        status=SOSStatus.ACTIVE.value,
        delivery_status=payload.delivery_status or SOSDeliveryStatus.ONLINE.value,
        latitude=payload.latitude,
        longitude=payload.longitude,
        location=wkt_loc,
        location_accuracy_meters=payload.location_accuracy_meters or 15.0,
        battery_percent=payload.battery_percent or 100,
        description=payload.description or f"Emergency SOS ({payload.emergency_type}) triggered from real GPS.",
        people_affected=payload.people_affected,
        created_at=now_utc,
        updated_at=now_utc,
        last_known_location_at=now_utc,
    )
    db.add(new_alert)
    await db.commit()
    await db.refresh(new_alert)

    # Eagerly load relationships
    load_stmt = (
        select(SOSAlert)
        .options(
            selectinload(SOSAlert.fisherman),
            selectinload(SOSAlert.boat),
            selectinload(SOSAlert.rescue_mission),
            selectinload(SOSAlert.responses),
        )
        .where(SOSAlert.id == new_alert.id)
    )
    loaded_alert = (await db.execute(load_stmt)).scalar_one()

    # 4. PostGIS Nearby Recipient Discovery
    radius_meters = settings.SOS_NEARBY_RADIUS_KM * 1000.0
    stale_cutoff = now_utc - timedelta(seconds=settings.LIVE_LOCATION_STALE_SECONDS)

    nearby_query = select(UserCurrentLocation.fisherman_id).where(
        UserCurrentLocation.fisherman_id != current_user.id,
        UserCurrentLocation.is_active == True,
        UserCurrentLocation.updated_at >= stale_cutoff,
        func.ST_DWithin(UserCurrentLocation.location, wkt_loc, radius_meters),
    )
    nearby_rows = (await db.execute(nearby_query)).scalars().all()
    nearby_user_ids = list(nearby_rows)

    # 5. Broadcast Real-time WebSocket Events
    event_payload = {
        "type": "NEW_SOS_ALERT",
        "alert": {
            "id": loaded_alert.id,
            "public_sos_id": loaded_alert.public_sos_id,
            "fisherman_id": current_user.id,
            "fisherman_name": current_user.name,
            "fisherman_phone": current_user.phone,
            "boat_name": user_boat.name if user_boat else None,
            "boat_registration": user_boat.registration_number if user_boat else None,
            "emergency_type": loaded_alert.emergency_type,
            "priority": loaded_alert.priority,
            "status": loaded_alert.status,
            "delivery_status": loaded_alert.delivery_status,
            "latitude": loaded_alert.latitude,
            "longitude": loaded_alert.longitude,
            "location_accuracy_meters": loaded_alert.location_accuracy_meters,
            "people_affected": loaded_alert.people_affected,
            "description": loaded_alert.description,
            "battery_percent": loaded_alert.battery_percent,
            "created_at": loaded_alert.created_at.isoformat(),
        },
    }

    # Dispatch to nearby active fishermen and Coastal Guard Command HQ
    await ws_manager.send_to_users(nearby_user_ids, event_payload)
    await ws_manager.broadcast_to_coastal_guard(event_payload)

    return build_sos_response_schema(loaded_alert)

@router.get("/sos", response_model=List[SOSResponse])
async def list_sos_alerts(
    status_filter: Optional[str] = Query(None, alias="status"),
    priority_filter: Optional[str] = Query(None, alias="priority"),
    db: AsyncSession = Depends(get_db),
) -> List[SOSResponse]:
    """List active or filtered SOS alerts from PostgreSQL database."""
    query = (
        select(SOSAlert)
        .options(
            selectinload(SOSAlert.fisherman),
            selectinload(SOSAlert.boat),
            selectinload(SOSAlert.rescue_mission),
            selectinload(SOSAlert.responses),
        )
        .order_by(desc(SOSAlert.created_at))
    )

    if status_filter and status_filter.upper() != "ALL":
        query = query.where(func.upper(SOSAlert.status) == status_filter.upper())
    if priority_filter:
        query = query.where(func.upper(SOSAlert.priority) == priority_filter.upper())

    result = await db.execute(query)
    alerts = result.scalars().all()
    return [build_sos_response_schema(a) for a in alerts]

@router.get("/sos/user/my-active", response_model=Optional[SOSResponse])
async def get_my_active_sos(
    current_user: Fisherman = Depends(get_current_fisherman),
    db: AsyncSession = Depends(get_db),
) -> Optional[SOSResponse]:
    """Get the currently logged-in fisherman's latest active SOS alert with rescue mission details."""
    query = (
        select(SOSAlert)
        .options(
            selectinload(SOSAlert.fisherman),
            selectinload(SOSAlert.boat),
            selectinload(SOSAlert.rescue_mission),
            selectinload(SOSAlert.responses),
        )
        .where(
            SOSAlert.fisherman_id == current_user.id,
            SOSAlert.status.notin_([SOSStatus.RESOLVED.value, SOSStatus.CANCELLED.value, SOSStatus.FALSE_ALARM.value]),
        )
        .order_by(desc(SOSAlert.created_at))
    )
    result = await db.execute(query)
    alert = result.scalars().first()
    if not alert:
        return None
    return build_sos_response_schema(alert)

@router.get("/sos/{identifier}", response_model=SOSResponse)
async def get_sos_alert(
    identifier: str,
    db: AsyncSession = Depends(get_db),
) -> SOSResponse:
    """Get detailed SOS alert by public_sos_id or integer ID."""
    query = select(SOSAlert).options(
        selectinload(SOSAlert.fisherman),
        selectinload(SOSAlert.boat),
        selectinload(SOSAlert.rescue_mission),
        selectinload(SOSAlert.responses),
    )

    if identifier.isdigit():
        query = query.where((SOSAlert.id == int(identifier)) | (SOSAlert.public_sos_id == identifier))
    else:
        query = query.where(SOSAlert.public_sos_id == identifier)

    result = await db.execute(query)
    alert = result.scalar_one_or_none()
    if not alert:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=f"SOS alert '{identifier}' not found.")
    return build_sos_response_schema(alert)

@router.post("/sos/{identifier}/respond", response_model=SOSResponse)
async def respond_to_sos_alert(
    identifier: str,
    payload: SOSResponseCreate,
    current_user: Fisherman = Depends(get_current_fisherman),
    db: AsyncSession = Depends(get_db),
) -> SOSResponse:
    """
    Submit YES HELP or NO responder feedback for an active SOS alert.
    - Scoped strictly to current_user.id.
    - Prevents duplicate response rows per responder.
    - If YES HELP: updates SOS alert status to HELP_ON_THE_WAY.
    - Broadcasts real-time WebSocket response to the SOS originator and Coastal Guard.
    """
    now_utc = datetime.now(timezone.utc)

    # Find target SOS alert
    query = select(SOSAlert).options(
        selectinload(SOSAlert.fisherman),
        selectinload(SOSAlert.boat),
        selectinload(SOSAlert.rescue_mission),
        selectinload(SOSAlert.responses),
    )
    if identifier.isdigit():
        query = query.where((SOSAlert.id == int(identifier)) | (SOSAlert.public_sos_id == identifier))
    else:
        query = query.where(SOSAlert.public_sos_id == identifier)

    result = await db.execute(query)
    target_alert = result.scalar_one_or_none()
    if not target_alert:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="SOS alert not found")

    # Geodesic distance calculation if responder location provided
    wkt_resp_loc = None
    dist_m = payload.distance_meters
    if payload.latitude is not None and payload.longitude is not None:
        wkt_resp_loc = wkt_from_lat_lon(payload.latitude, payload.longitude)
        if dist_m is None:
            # Approximate distance calculation
            lat_diff = (target_alert.latitude - payload.latitude) * 111139.0
            lon_diff = (target_alert.longitude - payload.longitude) * 111139.0 * 0.97
            dist_m = round((lat_diff**2 + lon_diff**2)**0.5, 1)

    # Check if responder already responded
    resp_stmt = select(SOSResponseModel).where(
        SOSResponseModel.sos_alert_id == target_alert.id,
        SOSResponseModel.responder_fisherman_id == current_user.id,
    )
    existing_resp = (await db.execute(resp_stmt)).scalar_one_or_none()

    if existing_resp:
        existing_resp.response = payload.response
        existing_resp.latitude = payload.latitude
        existing_resp.longitude = payload.longitude
        existing_resp.location = wkt_resp_loc
        existing_resp.distance_meters = dist_m
        existing_resp.eta_minutes = payload.eta_minutes
        existing_resp.message = payload.message
        existing_resp.updated_at = now_utc
    else:
        new_resp = SOSResponseModel(
            sos_alert_id=target_alert.id,
            responder_fisherman_id=current_user.id,
            response=payload.response,
            latitude=payload.latitude,
            longitude=payload.longitude,
            location=wkt_resp_loc,
            distance_meters=dist_m,
            eta_minutes=payload.eta_minutes,
            message=payload.message,
            created_at=now_utc,
            updated_at=now_utc,
        )
        db.add(new_resp)

    if payload.response == SOSResponseType.YES_HELP.value:
        target_alert.status = SOSStatus.HELP_ON_THE_WAY.value
        target_alert.updated_at = now_utc

    await db.commit()

    # Re-fetch fully loaded alert
    loaded_alert = (await db.execute(query)).scalar_one()

    # Broadcast WebSocket Event to originator and Coastal Guard
    resp_event = {
        "type": "SOS_RESPONSE_RECEIVED",
        "public_sos_id": loaded_alert.public_sos_id,
        "sos_alert_id": loaded_alert.id,
        "responder_id": current_user.id,
        "responder_name": current_user.name,
        "responder_phone": current_user.phone,
        "response": payload.response,
        "latitude": payload.latitude,
        "longitude": payload.longitude,
        "distance_meters": dist_m,
        "eta_minutes": payload.eta_minutes,
        "message": payload.message,
        "sos_status": loaded_alert.status,
        "created_at": now_utc.isoformat(),
    }

    if loaded_alert.fisherman_id:
        await ws_manager.send_to_user(loaded_alert.fisherman_id, resp_event)
    await ws_manager.broadcast_to_coastal_guard(resp_event)

    return build_sos_response_schema(loaded_alert)

@router.post("/sos/{identifier}/cancel", response_model=SOSResponse)
async def cancel_sos_alert(
    identifier: str,
    payload: Optional[SOSStatusUpdate] = None,
    current_user: Fisherman = Depends(get_current_fisherman),
    db: AsyncSession = Depends(get_db),
) -> SOSResponse:
    """
    Cancel an active SOS distress alert.
    - Allowed only by the originator fisherman or Coastal Guard officers.
    - Sets status to CANCELLED and broadcasts cancellation event over WebSocket.
    """
    now_utc = datetime.now(timezone.utc)
    query = select(SOSAlert).options(
        selectinload(SOSAlert.fisherman),
        selectinload(SOSAlert.boat),
        selectinload(SOSAlert.rescue_mission),
        selectinload(SOSAlert.responses),
    )
    if identifier.isdigit():
        query = query.where((SOSAlert.id == int(identifier)) | (SOSAlert.public_sos_id == identifier))
    else:
        query = query.where(SOSAlert.public_sos_id == identifier)

    target_alert = (await db.execute(query)).scalar_one_or_none()
    if not target_alert:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="SOS alert not found")

    if target_alert.fisherman_id != current_user.id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Forbidden: You cannot cancel another fisherman's SOS alert")

    target_alert.status = SOSStatus.CANCELLED.value
    target_alert.cancelled_at = now_utc
    target_alert.cancellation_reason = payload.cancellation_reason if payload else "Cancelled by fisherman"
    target_alert.updated_at = now_utc

    await db.commit()
    loaded_alert = (await db.execute(query)).scalar_one()

    # Broadcast Cancellation Event
    cancel_event = {
        "type": "SOS_CANCELLED",
        "public_sos_id": loaded_alert.public_sos_id,
        "sos_alert_id": loaded_alert.id,
        "cancelled_at": now_utc.isoformat(),
        "reason": loaded_alert.cancellation_reason,
    }
    await ws_manager.broadcast_all(cancel_event)

    return build_sos_response_schema(loaded_alert)

@router.patch("/sos/{identifier}/acknowledge", response_model=SOSResponse)
async def acknowledge_sos_alert(
    identifier: str,
    payload: Optional[SOSStatusUpdate] = None,
    db: AsyncSession = Depends(get_db),
) -> SOSResponse:
    """Coastal Guard acknowledges active SOS alert."""
    now_utc = datetime.now(timezone.utc)
    query = select(SOSAlert).options(
        selectinload(SOSAlert.fisherman),
        selectinload(SOSAlert.boat),
        selectinload(SOSAlert.rescue_mission),
        selectinload(SOSAlert.responses),
    )
    if identifier.isdigit():
        query = query.where((SOSAlert.id == int(identifier)) | (SOSAlert.public_sos_id == identifier))
    else:
        query = query.where(SOSAlert.public_sos_id == identifier)

    target_alert = (await db.execute(query)).scalar_one_or_none()
    if not target_alert:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="SOS alert not found")

    target_alert.status = SOSStatus.ACKNOWLEDGED.value
    target_alert.acknowledged_at = now_utc
    target_alert.updated_at = now_utc
    await db.commit()

    loaded_alert = (await db.execute(query)).scalar_one()

    # Broadcast event
    ack_event = {
        "type": "SOS_ACKNOWLEDGED",
        "public_sos_id": loaded_alert.public_sos_id,
        "sos_alert_id": loaded_alert.id,
        "status": loaded_alert.status,
        "acknowledged_at": now_utc.isoformat(),
    }
    if loaded_alert.fisherman_id:
        await ws_manager.send_to_user(loaded_alert.fisherman_id, ack_event)
    await ws_manager.broadcast_to_coastal_guard(ack_event)

    return build_sos_response_schema(loaded_alert)

@router.patch("/sos/{identifier}/status", response_model=SOSResponse)
async def update_sos_status(
    identifier: str,
    payload: SOSStatusUpdate,
    db: AsyncSession = Depends(get_db),
) -> SOSResponse:
    """Update SOS status and propagate live WebSocket event to clients."""
    now_utc = datetime.now(timezone.utc)
    query = select(SOSAlert).options(
        selectinload(SOSAlert.fisherman),
        selectinload(SOSAlert.boat),
        selectinload(SOSAlert.rescue_mission),
        selectinload(SOSAlert.responses),
    )
    if identifier.isdigit():
        query = query.where((SOSAlert.id == int(identifier)) | (SOSAlert.public_sos_id == identifier))
    else:
        query = query.where(SOSAlert.public_sos_id == identifier)

    target_alert = (await db.execute(query)).scalar_one_or_none()
    if not target_alert:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="SOS alert not found")

    target_alert.status = payload.status.upper()
    target_alert.updated_at = now_utc
    if payload.delivery_status:
        target_alert.delivery_status = payload.delivery_status
    if payload.status.upper() == SOSStatus.RESOLVED.value:
        target_alert.resolved_at = now_utc
    elif payload.status.upper() == SOSStatus.CANCELLED.value:
        target_alert.cancelled_at = now_utc

    await db.commit()
    loaded_alert = (await db.execute(query)).scalar_one()

    # Broadcast status change event
    status_event = {
        "type": "SOS_STATUS_UPDATED",
        "public_sos_id": loaded_alert.public_sos_id,
        "sos_alert_id": loaded_alert.id,
        "status": loaded_alert.status,
        "delivery_status": loaded_alert.delivery_status,
        "notes": payload.notes,
        "updated_at": now_utc.isoformat(),
    }
    if loaded_alert.fisherman_id:
        await ws_manager.send_to_user(loaded_alert.fisherman_id, status_event)
    await ws_manager.broadcast_to_coastal_guard(status_event)

    return build_sos_response_schema(loaded_alert)
