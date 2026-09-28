from pydantic import BaseModel, Field
from typing import List, Dict, Any, Optional

class SectorCenterPoint(BaseModel):
    lat: float
    lon: float

class INCOISSector(BaseModel):
    id: str = Field(..., description="Official INCOIS sector ID e.g. SEC007")
    name: str = Field(..., description="Sector name e.g. NORTH TAMIL NADU")
    state: str = Field(..., description="State name e.g. Tamil Nadu")
    center: SectorCenterPoint

class HotspotInfo(BaseModel):
    id: str
    name: str
    latitude: float
    longitude: float
    sst_celsius: float
    chlorophyll_mg_m3: float
    depth_meters: int
    target_species: List[str]
    reliability_score: str
    valid_until: str
    distance_meters: Optional[float] = None
    bearing_degrees: Optional[float] = None
    direction: Optional[str] = None

class OceanographicIndicators(BaseModel):
    sea_surface_temperature: str
    chlorophyll_a: str
    wind_speed_knots: str
    sea_state: str
    wave_height_meters: str

class SectorAdvisoryResponse(BaseModel):
    sector_id: str
    sector_name: str
    state: str
    incois_url: str
    status_code: int
    is_live_data: bool
    source: str
    advisory_summary: str
    oceanographic_indicators: OceanographicIndicators
    hotspots: List[HotspotInfo]
    raw_text_snippet: str

class WMSLayerInfo(BaseModel):
    name: str
    url: str
    layer_name: str
    legend_url: str
    format: str
    transparent: bool
    opacity: float

class INCOISWMSLayersResponse(BaseModel):
    chlorophyll_wms: WMSLayerInfo
    sst_wms: WMSLayerInfo
    bathymetry_wms: WMSLayerInfo
