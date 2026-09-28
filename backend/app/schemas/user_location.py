from datetime import datetime
from typing import Optional
from pydantic import BaseModel, Field, ConfigDict
from app.schemas.common import LocationPoint

class UserLocationHeartbeat(BaseModel):
    latitude: float = Field(..., ge=-90.0, le=90.0, description="Current latitude")
    longitude: float = Field(..., ge=-180.0, le=180.0, description="Current longitude")
    accuracy_meters: Optional[float] = Field(15.0, ge=0.0, description="GPS accuracy in meters")
    speed_mps: Optional[float] = Field(0.0, ge=0.0, description="Current speed in m/s")
    heading_degrees: Optional[float] = Field(0.0, ge=0.0, le=360.0, description="Compass heading in degrees")
    battery_percent: Optional[int] = Field(100, ge=0, le=100, description="Phone battery percentage")
    recorded_at: Optional[datetime] = Field(None, description="Client GPS recording timestamp (UTC)")

class UserLocationResponse(BaseModel):
    id: int
    fisherman_id: int
    latitude: float
    longitude: float
    location: LocationPoint
    accuracy_meters: Optional[float] = 15.0
    speed_mps: Optional[float] = 0.0
    heading_degrees: Optional[float] = 0.0
    battery_percent: Optional[int] = 100
    is_active: bool
    recorded_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)

class NearbyFishermanResponse(BaseModel):
    fisherman_id: int
    fisherman_name: str
    phone: str
    boat_name: Optional[str] = None
    boat_registration: Optional[str] = None
    latitude: float
    longitude: float
    distance_meters: float
    battery_percent: Optional[int] = 100
    last_seen_seconds_ago: Optional[int] = 0

    model_config = ConfigDict(from_attributes=True)
