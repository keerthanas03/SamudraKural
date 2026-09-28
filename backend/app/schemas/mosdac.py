from pydantic import BaseModel, Field
from typing import List, Dict, Any, Optional

class MOSDACLayerInfo(BaseModel):
    name: str
    satellite: str
    sensor: str
    url: str
    layer_name: str
    legend_url: Optional[str] = None
    format: str = "image/png"
    transparent: bool = True
    opacity: float = 0.75
    description: str

class MOSDACWMSLayersResponse(BaseModel):
    insat_rapid_scan_wms: MOSDACLayerInfo
    oceansat_chlorophyll_wms: MOSDACLayerInfo
    scatsat_winds_wms: MOSDACLayerInfo
    insat_sst_wms: MOSDACLayerInfo
    source: str = "ISRO Space Applications Centre (SAC) - MOSDAC"

class MOSDACCycloneAlert(BaseModel):
    alert_id: str
    severity: str  # 'NORMAL', 'WARNING', 'ALERT', 'CYCLONIC_STORM'
    cyclone_name: Optional[str] = None
    location_basin: str  # 'Bay of Bengal', 'Arabian Sea'
    center_latitude: float
    center_longitude: float
    estimated_central_pressure_hpa: float
    max_sustained_wind_knots: float
    movement_speed_kmh: float
    movement_direction: str
    distance_from_user_km: Optional[float] = None
    warning_text: str
    satellite_source: str
    timestamp: str

class MOSDACOceanWindVector(BaseModel):
    latitude: float
    longitude: float
    wind_speed_knots: float
    wind_direction_degrees: float
    wind_cardinal: str
    surface_roughness: str
    scatterometer_source: str

class MOSDACAdvisoryResponse(BaseModel):
    sector_id: str
    sector_name: str
    state: str
    timestamp: str
    satellite_platform: str
    is_live_satellite_feed: bool
    sst_celsius: float
    chlorophyll_a_mg_m3: float
    ocean_winds_knots: float
    wind_direction: str
    cyclone_alert: Optional[MOSDACCycloneAlert] = None
    cross_validation_confidence: str
    validation_status: str
    source_attribution: str = "ISRO MOSDAC (Meteorological & Oceanographic Satellite Data Archival Centre)"
