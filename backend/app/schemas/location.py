from typing import Optional
from datetime import datetime
from pydantic import BaseModel, Field, ConfigDict
from app.schemas.common import LocationPoint

class FishingLocationCreate(BaseModel):
    name: str = Field(..., min_length=1, max_length=255, description="Fishing location name")
    location: LocationPoint
    notes: Optional[str] = Field(None, description="Optional notes")

class FishingLocationResponse(BaseModel):
    id: int
    fisherman_id: int
    name: str
    location: LocationPoint
    notes: Optional[str] = None
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)

class NearbyLocationResponse(BaseModel):
    id: int
    fisherman_id: int
    name: str
    latitude: float
    longitude: float
    distance_meters: float

    model_config = ConfigDict(from_attributes=True)
