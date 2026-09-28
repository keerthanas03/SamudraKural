from datetime import datetime, timezone, timedelta
from typing import List, Dict, Any, Optional
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, delete, cast
from geoalchemy2 import Geometry
from app.core.config import settings
from app.db.session import get_db
from app.models.fisherman import Fisherman
from app.models.boat import Boat
from app.models.location import FishingLocation
from app.models.user_location import UserCurrentLocation
from app.schemas.location import FishingLocationCreate, FishingLocationResponse, NearbyLocationResponse
from app.schemas.user_location import (
    UserLocationHeartbeat,
    UserLocationResponse,
    NearbyFishermanResponse,
)
from app.schemas.common import LocationPoint
from app.services.spatial import location_to_wkt, spatial_to_location_point, wkt_from_lat_lon
from app.api.deps import get_current_fisherman

router = APIRouter(prefix="/locations", tags=["Locations"])

# ============================================================================
# PHASE 2B: REAL LIVE GPS HEARTBEAT & NEARBY FISHERMEN DISCOVERY
# ============================================================================

@router.post("/live", response_model=UserLocationResponse, status_code=status.HTTP_200_OK)
async def update_live_location(
    heartbeat: UserLocationHeartbeat,
    current_user: Fisherman = Depends(get_current_fisherman),
    db: AsyncSession = Depends(get_db)
) -> UserLocationResponse:
    """
    Ingest real live GPS heartbeat from the authenticated fisherman.
    Upserts exactly ONE row in user_current_locations per fisherman.
    Updates PostGIS Geography POINT, telemetry, is_active=True, and timestamps.
    """
    now_utc = datetime.now(timezone.utc)
    recorded_at = heartbeat.recorded_at if heartbeat.recorded_at is not None else now_utc
    if recorded_at.tzinfo is None:
        recorded_at = recorded_at.replace(tzinfo=timezone.utc)

    # Normalize heading to 0.0 - 360.0
    heading = heartbeat.heading_degrees
    if heading is not None:
        heading = heading % 360.0

    wkt_point = wkt_from_lat_lon(heartbeat.latitude, heartbeat.longitude)

    # Fetch existing current location row
    stmt = select(UserCurrentLocation).where(UserCurrentLocation.fisherman_id == current_user.id)
    result = await db.execute(stmt)
    current_loc = result.scalar_one_or_none()

    if current_loc:
        current_loc.latitude = heartbeat.latitude
        current_loc.longitude = heartbeat.longitude
        current_loc.location = wkt_point
        current_loc.accuracy_meters = heartbeat.accuracy_meters
        current_loc.speed_mps = heartbeat.speed_mps
        current_loc.heading_degrees = heading
        current_loc.battery_percent = heartbeat.battery_percent
        current_loc.is_active = True
        current_loc.recorded_at = recorded_at
        current_loc.updated_at = now_utc
    else:
        current_loc = UserCurrentLocation(
            fisherman_id=current_user.id,
            latitude=heartbeat.latitude,
            longitude=heartbeat.longitude,
            location=wkt_point,
            accuracy_meters=heartbeat.accuracy_meters,
            speed_mps=heartbeat.speed_mps,
            heading_degrees=heading,
            battery_percent=heartbeat.battery_percent,
            is_active=True,
            recorded_at=recorded_at,
            updated_at=now_utc,
        )
        db.add(current_loc)

    await db.commit()
    await db.refresh(current_loc)

    return UserLocationResponse(
        id=current_loc.id,
        fisherman_id=current_loc.fisherman_id,
        latitude=current_loc.latitude,
        longitude=current_loc.longitude,
        location=LocationPoint(latitude=current_loc.latitude, longitude=current_loc.longitude),
        accuracy_meters=current_loc.accuracy_meters,
        speed_mps=current_loc.speed_mps,
        heading_degrees=current_loc.heading_degrees,
        battery_percent=current_loc.battery_percent,
        is_active=current_loc.is_active,
        recorded_at=current_loc.recorded_at,
        updated_at=current_loc.updated_at,
    )

@router.post("/live/deactivate", status_code=status.HTTP_200_OK)
async def deactivate_live_location(
    current_user: Fisherman = Depends(get_current_fisherman),
    db: AsyncSession = Depends(get_db)
) -> Dict[str, Any]:
    """
    Deactivates live location tracking for the authenticated fisherman.
    Sets is_active=False without deleting the record.
    """
    stmt = select(UserCurrentLocation).where(UserCurrentLocation.fisherman_id == current_user.id)
    result = await db.execute(stmt)
    current_loc = result.scalar_one_or_none()

    if not current_loc:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="No live location record found for current user"
        )

    current_loc.is_active = False
    current_loc.updated_at = datetime.now(timezone.utc)
    await db.commit()

    return {
        "status": "deactivated",
        "fisherman_id": current_user.id,
        "is_active": False,
        "message": "Live location deactivated successfully"
    }

@router.get("/nearby-fishermen", response_model=List[NearbyFishermanResponse])
async def get_nearby_fishermen(
    radius_km: float = Query(25.0, ge=0.1, le=100.0, description="Discovery radius in kilometers (0.1 - 100.0 km)"),
    current_user: Fisherman = Depends(get_current_fisherman),
    db: AsyncSession = Depends(get_db)
) -> List[NearbyFishermanResponse]:
    """
    Discover nearby live fishermen using PostGIS spatial queries (ST_DWithin & ST_Distance).
    Excludes the authenticated fisherman, inactive fishermen, and stale locations.
    Returns results sorted nearest first.
    """
    # 1. Retrieve the authenticated fisherman's current live location
    my_loc_stmt = select(UserCurrentLocation).where(UserCurrentLocation.fisherman_id == current_user.id)
    my_loc_res = await db.execute(my_loc_stmt)
    my_loc = my_loc_res.scalar_one_or_none()

    if not my_loc or my_loc.latitude is None or my_loc.longitude is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="CURRENT LOCATION UNAVAILABLE: Live GPS location not found for the current fisherman. Please send a live location heartbeat first."
        )

    # 2. Build PostGIS reference point and freshness cutoff
    ref_point = wkt_from_lat_lon(my_loc.latitude, my_loc.longitude)
    radius_meters = radius_km * 1000.0
    now_utc = datetime.now(timezone.utc)
    stale_cutoff = now_utc - timedelta(seconds=settings.LIVE_LOCATION_STALE_SECONDS)

    # 3. Query user_current_locations using PostGIS spatial functions
    distance_expr = func.ST_Distance(UserCurrentLocation.location, ref_point).label("distance_meters")

    query = (
        select(
            UserCurrentLocation.fisherman_id,
            Fisherman.name.label("fisherman_name"),
            Fisherman.phone.label("phone"),
            UserCurrentLocation.latitude,
            UserCurrentLocation.longitude,
            UserCurrentLocation.battery_percent,
            UserCurrentLocation.updated_at,
            distance_expr,
            Boat.name.label("boat_name"),
            Boat.registration_number.label("boat_registration"),
        )
        .join(Fisherman, Fisherman.id == UserCurrentLocation.fisherman_id)
        .outerjoin(Boat, Boat.fisherman_id == Fisherman.id)
        .where(
            UserCurrentLocation.fisherman_id != current_user.id,
            UserCurrentLocation.is_active == True,
            UserCurrentLocation.updated_at >= stale_cutoff,
            func.ST_DWithin(UserCurrentLocation.location, ref_point, radius_meters)
        )
        .order_by(distance_expr.asc())
    )

    result = await db.execute(query)
    rows = result.all()

    # 4. Map query results to NearbyFishermanResponse schema
    nearby_list: List[NearbyFishermanResponse] = []
    for row in rows:
        last_seen = 0
        if row.updated_at:
            row_updated = row.updated_at
            if row_updated.tzinfo is None:
                row_updated = row_updated.replace(tzinfo=timezone.utc)
            last_seen = max(0, int((now_utc - row_updated).total_seconds()))

        nearby_list.append(
            NearbyFishermanResponse(
                fisherman_id=row.fisherman_id,
                fisherman_name=row.fisherman_name,
                phone=row.phone,
                boat_name=row.boat_name,
                boat_registration=row.boat_registration,
                latitude=float(row.latitude),
                longitude=float(row.longitude),
                distance_meters=round(float(row.distance_meters), 1),
                battery_percent=row.battery_percent or 100,
                last_seen_seconds_ago=last_seen,
            )
        )

    return nearby_list

# ============================================================================
# SAVED FISHING LOCATIONS (HISTORICAL SPOTS)
# ============================================================================

@router.post("", response_model=FishingLocationResponse, status_code=status.HTTP_201_CREATED)
async def create_location(
    location_in: FishingLocationCreate,
    current_user: Fisherman = Depends(get_current_fisherman),
    db: AsyncSession = Depends(get_db)
) -> FishingLocationResponse:
    loc_pt = location_in.location
    wkt_loc = location_to_wkt(loc_pt)
    db_location = FishingLocation(
        fisherman_id=current_user.id,
        name=location_in.name,
        location=wkt_loc,
        notes=location_in.notes,
    )
    db.add(db_location)
    await db.flush()
    res_id = db_location.id
    res_created = db_location.created_at
    res_updated = db_location.updated_at
    await db.commit()

    return FishingLocationResponse(
        id=res_id,
        fisherman_id=current_user.id,
        name=location_in.name,
        location=loc_pt,
        notes=location_in.notes,
        created_at=res_created,
        updated_at=res_updated,
    )

@router.get("/nearby", response_model=List[NearbyLocationResponse])
async def get_nearby_locations(
    latitude: float = Query(..., ge=-90.0, le=90.0, description="Center point latitude"),
    longitude: float = Query(..., ge=-180.0, le=180.0, description="Center point longitude"),
    radius_meters: float = Query(..., gt=0.0, description="Search radius in meters"),
    current_user: Fisherman = Depends(get_current_fisherman),
    db: AsyncSession = Depends(get_db)
) -> List[NearbyLocationResponse]:
    ref_point = wkt_from_lat_lon(latitude, longitude)
    
    distance_expr = func.ST_Distance(FishingLocation.location, ref_point).label("distance_meters")
    lat_expr = func.ST_Y(cast(FishingLocation.location, Geometry)).label("latitude")
    lon_expr = func.ST_X(cast(FishingLocation.location, Geometry)).label("longitude")

    query = (
        select(
            FishingLocation.id,
            FishingLocation.fisherman_id,
            FishingLocation.name,
            lat_expr,
            lon_expr,
            distance_expr
        )
        .where(
            FishingLocation.fisherman_id == current_user.id,
            func.ST_DWithin(FishingLocation.location, ref_point, radius_meters)
        )
        .order_by(distance_expr.asc())
    )

    result = await db.execute(query)
    rows = result.all()

    return [
        NearbyLocationResponse(
            id=row.id,
            fisherman_id=row.fisherman_id,
            name=row.name,
            latitude=float(row.latitude),
            longitude=float(row.longitude),
            distance_meters=float(row.distance_meters),
        )
        for row in rows
    ]

@router.get("/{location_id}", response_model=FishingLocationResponse)
async def get_location(
    location_id: int,
    current_user: Fisherman = Depends(get_current_fisherman),
    db: AsyncSession = Depends(get_db)
) -> FishingLocationResponse:
    result = await db.execute(select(FishingLocation).where(FishingLocation.id == location_id))
    db_location = result.scalar_one_or_none()
    if not db_location:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Fishing location not found")

    if db_location.fisherman_id != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Forbidden: You do not own this fishing location"
        )

    return FishingLocationResponse(
        id=db_location.id,
        fisherman_id=db_location.fisherman_id,
        name=db_location.name,
        location=spatial_to_location_point(db_location.location),
        notes=db_location.notes,
        created_at=db_location.created_at,
        updated_at=db_location.updated_at,
    )

@router.delete("/{location_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_location(
    location_id: int,
    current_user: Fisherman = Depends(get_current_fisherman),
    db: AsyncSession = Depends(get_db)
):
    result = await db.execute(select(FishingLocation).where(FishingLocation.id == location_id))
    db_location = result.scalar_one_or_none()
    if not db_location:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Fishing location not found")

    if db_location.fisherman_id != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Forbidden: You do not own this fishing location"
        )

    await db.execute(delete(FishingLocation).where(FishingLocation.id == location_id))
    await db.commit()
    return None
