from typing import Optional, Dict, Any
from datetime import datetime, timezone
from fastapi import APIRouter, Query, HTTPException
from app.schemas.environment import EnvironmentTestResponse
from app.services.environment_service import environment_service
from app.services.copernicus_service import copernicus_service
from app.services.incois_service import incois_service
from app.utils.time import ensure_utc

router = APIRouter(tags=["Environment & Data Sources"])

@router.get("/environment/test", response_model=EnvironmentTestResponse)
async def test_ocean_environment(
    latitude: float = Query(..., ge=-90.0, le=90.0, description="Latitude coordinate", openapi_examples={"chennai": {"value": 13.05}}),
    longitude: float = Query(..., ge=-180.0, le=180.0, description="Longitude coordinate", openapi_examples={"chennai": {"value": 80.35}}),
    target_time: Optional[datetime] = Query(None, description="Target datetime (ISO format)", alias="datetime")
):
    """
    CRITICAL REAL-DATA VALIDATION ENDPOINT
    
    Tests live operational data retrieval from:
    1. Copernicus Marine Service (Physics currents uo/vo, Stokes drift, wave height/period/direction)
    2. INCOIS (Ocean State Forecast & RSMC NetCDF files)
    
    Performs cross-validation comparison (HIGH / MEDIUM / LOW agreement)
    and returns product IDs, dataset IDs, variables, units, timestamps, and data age.
    """
    try:
        dt = ensure_utc(target_time)
        _, test_response = await environment_service.get_normalized_environment(latitude, longitude, dt)
        return test_response
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Failed to retrieve environmental ocean data: {str(e)}"
        )

@router.get("/data-sources/status")
async def get_data_sources_status() -> Dict[str, Any]:
    """
    DATA SOURCE HEALTH MONITOR
    
    Returns connection and catalogue status for:
    - Copernicus Marine Service (Physics and Wave Products)
    - INCOIS Operational Ocean State Forecast Services
    """
    cop_validation = copernicus_service.validate_datasets()
    inc_status = incois_service.get_status()

    return {
        "status": "HEALTHY" if "ERROR" not in str(cop_validation) else "DEGRADED",
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "providers": {
            "copernicus_marine": {
                "status": "CONNECTED" if cop_validation["physics_product"]["status"] == "ACCESSIBLE" else "ERROR",
                "authentication": "AUTHENTICATED" if copernicus_service.ensure_authenticated() else "UNAUTHENTICATED",
                "physics_product_id": copernicus_service.phy_product_id,
                "physics_dataset_id": copernicus_service.phy_dataset_id,
                "wave_product_id": copernicus_service.wav_product_id,
                "wave_dataset_id": copernicus_service.wav_dataset_id,
                "catalogue_validation": cop_validation
            },
            "incois": inc_status
        }
    }
