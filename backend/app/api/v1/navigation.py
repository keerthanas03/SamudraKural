from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, cast
from geoalchemy2 import Geometry
from app.db.session import get_db
from app.models.fisherman import Fisherman
from app.models.location import FishingLocation
from app.schemas.navigation import (
    NavigationPoint,
    TargetLocationInfo,
    ShoreNavigationResponse,
    LocationNavigationResponse,
    NavigationStatusResponse,
)
from app.services.spatial import spatial_to_location_point, wkt_from_lat_lon
from app.services.navigation_service import (
    calculate_navigation,
    calculate_initial_bearing,
    bearing_to_cardinal,
)
from app.api.deps import get_current_fisherman

router = APIRouter(prefix="/navigation", tags=["Navigation"])

@router.get("/to-shore", response_model=ShoreNavigationResponse)
async def navigate_to_shore(
    latitude: float = Query(..., ge=-90.0, le=90.0, description="Current latitude (-90 to 90)"),
    longitude: float = Query(..., ge=-180.0, le=180.0, description="Current longitude (-180 to 180)"),
    current_user: Fisherman = Depends(get_current_fisherman),
) -> ShoreNavigationResponse:
    if not current_user.shore_location:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Shore location not set for this fisherman"
        )

    shore_pt = spatial_to_location_point(current_user.shore_location)
    dist_m, bearing_deg, direction = calculate_navigation(
        latitude, longitude, shore_pt.latitude, shore_pt.longitude
    )

    return ShoreNavigationResponse(
        target="shore",
        current_location=NavigationPoint(latitude=latitude, longitude=longitude),
        target_location=NavigationPoint(latitude=shore_pt.latitude, longitude=shore_pt.longitude),
        distance_meters=dist_m,
        bearing_degrees=bearing_deg,
        direction=direction,
    )

@router.get("/to-location/{location_id}", response_model=LocationNavigationResponse)
async def navigate_to_location(
    location_id: int,
    latitude: float = Query(..., ge=-90.0, le=90.0, description="Current latitude (-90 to 90)"),
    longitude: float = Query(..., ge=-180.0, le=180.0, description="Current longitude (-180 to 180)"),
    current_user: Fisherman = Depends(get_current_fisherman),
    db: AsyncSession = Depends(get_db),
) -> LocationNavigationResponse:
    result = await db.execute(select(FishingLocation).where(FishingLocation.id == location_id))
    db_location = result.scalar_one_or_none()

    if not db_location:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Fishing location not found"
        )

    if db_location.fisherman_id != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Forbidden: You do not own this fishing location"
        )

    target_pt = spatial_to_location_point(db_location.location)
    dist_m, bearing_deg, direction = calculate_navigation(
        latitude, longitude, target_pt.latitude, target_pt.longitude
    )

    return LocationNavigationResponse(
        target=TargetLocationInfo(id=db_location.id, name=db_location.name),
        current_location=NavigationPoint(latitude=latitude, longitude=longitude),
        target_location=NavigationPoint(latitude=target_pt.latitude, longitude=target_pt.longitude),
        distance_meters=dist_m,
        bearing_degrees=bearing_deg,
        direction=direction,
    )

@router.get("/nearest-location", response_model=LocationNavigationResponse)
async def navigate_to_nearest_location(
    latitude: float = Query(..., ge=-90.0, le=90.0, description="Current latitude (-90 to 90)"),
    longitude: float = Query(..., ge=-180.0, le=180.0, description="Current longitude (-180 to 180)"),
    radius_meters: float = Query(..., gt=0.0, description="Search radius in meters"),
    current_user: Fisherman = Depends(get_current_fisherman),
    db: AsyncSession = Depends(get_db),
) -> LocationNavigationResponse:
    ref_point = wkt_from_lat_lon(latitude, longitude)
    distance_expr = func.ST_Distance(FishingLocation.location, ref_point).label("distance_meters")
    lat_expr = func.ST_Y(cast(FishingLocation.location, Geometry)).label("latitude")
    lon_expr = func.ST_X(cast(FishingLocation.location, Geometry)).label("longitude")

    query = (
        select(
            FishingLocation.id,
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
        .limit(1)
    )

    result = await db.execute(query)
    row = result.first()

    if not row:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="No saved fishing location found within the specified radius"
        )

    target_lat = float(row.latitude)
    target_lon = float(row.longitude)
    dist_m = round(float(row.distance_meters), 2)
    bearing_deg = calculate_initial_bearing(latitude, longitude, target_lat, target_lon)
    direction = bearing_to_cardinal(bearing_deg)

    return LocationNavigationResponse(
        target=TargetLocationInfo(id=row.id, name=row.name),
        current_location=NavigationPoint(latitude=latitude, longitude=longitude),
        target_location=NavigationPoint(latitude=target_lat, longitude=target_lon),
        distance_meters=dist_m,
        bearing_degrees=bearing_deg,
        direction=direction,
    )

@router.get("/status", response_model=NavigationStatusResponse)
async def get_navigation_status(
    latitude: float = Query(..., ge=-90.0, le=90.0, description="Current latitude (-90 to 90)"),
    longitude: float = Query(..., ge=-180.0, le=180.0, description="Current longitude (-180 to 180)"),
    current_user: Fisherman = Depends(get_current_fisherman),
) -> NavigationStatusResponse:
    if not current_user.shore_location:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Shore location not set for this fisherman"
        )

    shore_pt = spatial_to_location_point(current_user.shore_location)
    dist_m, bearing_deg, direction = calculate_navigation(
        latitude, longitude, shore_pt.latitude, shore_pt.longitude
    )

    return NavigationStatusResponse(
        distance_to_shore_meters=dist_m,
        bearing_to_shore_degrees=bearing_deg,
        direction_to_shore=direction,
    )
