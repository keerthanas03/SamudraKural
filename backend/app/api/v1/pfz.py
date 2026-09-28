from fastapi import APIRouter, Query, HTTPException, status
from typing import List, Optional
from app.services.incois_service import (
    INCOIS_SECTORS,
    fetch_incois_sector_advisory,
    get_incois_wms_layer_urls,
    find_nearest_sector
)
from app.services.navigation_service import calculate_navigation
from app.schemas.pfz import (
    INCOISSector,
    SectorAdvisoryResponse,
    INCOISWMSLayersResponse,
    HotspotInfo
)

router = APIRouter()

@router.get("/pfz/sectors", response_model=List[INCOISSector])
def list_sectors() -> List[INCOISSector]:
    """List all 12 official INCOIS coastal sectors."""
    return [INCOISSector(**s) for s in INCOIS_SECTORS]

@router.get("/pfz/auto", response_model=SectorAdvisoryResponse)
async def auto_detect_pfz(
    latitude: float = Query(..., ge=-90.0, le=90.0, description="User GPS latitude"),
    longitude: float = Query(..., ge=-180.0, le=180.0, description="User GPS longitude")
) -> SectorAdvisoryResponse:
    """Auto-detect user location and return real INCOIS sector advisory for nearest coastal region."""
    matched_sec = find_nearest_sector(latitude, longitude)
    advisory_data = await fetch_incois_sector_advisory(matched_sec["id"])
    return SectorAdvisoryResponse(**advisory_data)

@router.get("/pfz/advisory/{sec_id}", response_model=SectorAdvisoryResponse)
async def get_sector_advisory(sec_id: str) -> SectorAdvisoryResponse:
    """Fetch real PFZ advisory data for a specific sector from INCOIS."""
    sec_id_upper = sec_id.upper()
    if not any(s["id"] == sec_id_upper for s in INCOIS_SECTORS):
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Sector ID '{sec_id}' not found."
        )
    advisory_data = await fetch_incois_sector_advisory(sec_id_upper)
    return SectorAdvisoryResponse(**advisory_data)

@router.get("/pfz/layers", response_model=INCOISWMSLayersResponse)
def get_wms_layers() -> INCOISWMSLayersResponse:
    """Get official INCOIS GeoServer WMS tile layer configuration."""
    layers = get_incois_wms_layer_urls()
    return INCOISWMSLayersResponse(**layers)

@router.get("/pfz/nearby", response_model=List[HotspotInfo])
async def get_nearby_pfz(
    latitude: float = Query(..., ge=-90.0, le=90.0, description="User current latitude"),
    longitude: float = Query(..., ge=-180.0, le=180.0, description="User current longitude"),
    sector_id: Optional[str] = Query(None, description="Optional Sector ID")
) -> List[HotspotInfo]:
    """Calculate distance, bearing, and cardinal direction from user position to active INCOIS PFZ hotspots."""
    if sector_id:
        sec_id = sector_id.upper()
    else:
        matched_sec = find_nearest_sector(latitude, longitude)
        sec_id = matched_sec["id"]

    advisory = await fetch_incois_sector_advisory(sec_id)
    hotspots = []

    for hs in advisory["hotspots"]:
        dist_m, bearing_deg, direction = calculate_navigation(
            latitude, longitude, hs["latitude"], hs["longitude"]
        )
        hs_copy = dict(hs)
        hs_copy["distance_meters"] = dist_m
        hs_copy["bearing_degrees"] = bearing_deg
        hs_copy["direction"] = direction
        hotspots.append(HotspotInfo(**hs_copy))

    hotspots.sort(key=lambda x: x.distance_meters if x.distance_meters is not None else float('inf'))
    return hotspots
