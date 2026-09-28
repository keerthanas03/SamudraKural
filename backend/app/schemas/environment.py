from typing import Optional, Dict, Any, List
from datetime import datetime
from pydantic import BaseModel, Field

class EnvironmentalState(BaseModel):
    timestamp_utc: datetime
    latitude: float
    longitude: float

    # Surface Ocean Current
    current_u: float = Field(0.0, description="Eastward sea water velocity in m/s")
    current_v: float = Field(0.0, description="Northward sea water velocity in m/s")
    current_speed_mps: float = Field(0.0, description="Total current speed in m/s")
    current_direction_deg: float = Field(0.0, description="Current flow direction in degrees")
    current_direction_cardinal: str = Field("Calm", description="Current cardinal direction")

    # Surface Wind
    wind_u: float = Field(0.0, description="Eastward 10m wind velocity in m/s")
    wind_v: float = Field(0.0, description="Northward 10m wind velocity in m/s")
    wind_speed_mps: float = Field(0.0, description="Wind speed in m/s")
    wind_speed_kmh: float = Field(0.0, description="Wind speed in km/h")
    wind_direction_deg: float = Field(0.0, description="Wind direction (meteorological) in degrees")
    wind_direction_cardinal: str = Field("Calm", description="Wind cardinal direction")

    # Waves & Stokes Drift
    wave_height: float = Field(0.0, description="Significant wave height in meters (VHM0)")
    wave_direction: float = Field(0.0, description="Mean wave direction in degrees (VMDR)")
    wave_period: float = Field(0.0, description="Wave peak/mean period in seconds (VTPK)")
    sea_state: str = Field("Calm", description="Sea state classification (WMO)")

    stokes_u: float = Field(0.0, description="Stokes drift X velocity in m/s (VSDX)")
    stokes_v: float = Field(0.0, description="Stokes drift Y velocity in m/s (VSDY)")
    stokes_speed_mps: float = Field(0.0, description="Stokes drift speed in m/s")
    stokes_direction_deg: float = Field(0.0, description="Stokes drift direction in degrees")

    # Swell
    swell_height: Optional[float] = Field(None, description="Swell wave height in meters")
    swell_period: Optional[float] = Field(None, description="Swell period in seconds")

    # INCOIS Reference specific fields
    incois_current_speed: Optional[float] = Field(None, description="INCOIS current speed in m/s")
    incois_current_direction: Optional[float] = Field(None, description="INCOIS current direction in degrees")
    incois_wave_height: Optional[float] = Field(None, description="INCOIS wave height in meters")
    incois_wave_direction: Optional[float] = Field(None, description="INCOIS wave direction in degrees")
    incois_wind_speed: Optional[float] = Field(None, description="INCOIS wind speed in m/s")
    incois_wind_direction: Optional[float] = Field(None, description="INCOIS wind direction in degrees")

    # Metadata & Provenance
    data_sources: List[str] = Field(default_factory=list, description="List of providers contributing to this state")
    data_timestamp: Optional[datetime] = Field(None, description="Original observation/forecast reference timestamp")
    retrieved_at: datetime = Field(default_factory=datetime.utcnow, description="Time data was fetched")
    data_age_minutes: int = Field(0, description="Age of data in minutes relative to request")
    availability_status: str = Field("available", description="Status: available, cached, degraded, unavailable")
    forecast_status: str = Field("forecast", description="analysis or forecast")


class ProviderStatus(BaseModel):
    status: str
    dataset_id: Optional[str] = None
    timestamp: Optional[str] = None
    data_age_minutes: Optional[int] = None
    current: Dict[str, Any] = Field(default_factory=dict)
    wind: Optional[Dict[str, Any]] = None
    wave: Optional[Dict[str, Any]] = None
    stokes_drift: Optional[Dict[str, Any]] = None
    units: Dict[str, str] = Field(default_factory=dict)
    error: Optional[str] = None


class AgreementComparison(BaseModel):
    current_agreement: str = Field("HIGH", description="HIGH, MEDIUM, LOW")
    current_speed_difference_mps: Optional[float] = None
    current_direction_difference_deg: Optional[float] = None
    wave_agreement: str = Field("HIGH", description="HIGH, MEDIUM, LOW")
    wave_height_difference_m: Optional[float] = None
    overall_confidence_modifier: float = Field(1.0, description="Multiplier for uncertainty based on agreement")
    notes: str = Field("", description="Comparison summary for verification")


class EnvironmentTestResponse(BaseModel):
    location: Dict[str, float]
    timestamp: str
    demo_mode: bool
    incois: ProviderStatus
    copernicus: ProviderStatus
    comparison: AgreementComparison
    normalized_state: Optional[EnvironmentalState] = None
