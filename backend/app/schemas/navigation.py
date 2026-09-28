from pydantic import BaseModel, Field
from typing import Literal

class NavigationPoint(BaseModel):
    latitude: float = Field(..., ge=-90.0, le=90.0, description="Latitude in degrees (-90 to 90)")
    longitude: float = Field(..., ge=-180.0, le=180.0, description="Longitude in degrees (-180 to 180)")

class TargetLocationInfo(BaseModel):
    id: int = Field(..., description="Unique ID of target location")
    name: str = Field(..., description="Name of target location")

class ShoreNavigationResponse(BaseModel):
    target: Literal["shore"] = Field("shore", description="Target identifier")
    current_location: NavigationPoint
    target_location: NavigationPoint
    distance_meters: float = Field(..., description="Distance to target in meters")
    bearing_degrees: float = Field(..., description="Initial geographic bearing in degrees (0 to 360)")
    direction: str = Field(..., description="8-direction cardinal string (N, NE, E, SE, S, SW, W, NW)")

class LocationNavigationResponse(BaseModel):
    target: TargetLocationInfo
    current_location: NavigationPoint
    target_location: NavigationPoint
    distance_meters: float = Field(..., description="Distance to target in meters")
    bearing_degrees: float = Field(..., description="Initial geographic bearing in degrees (0 to 360)")
    direction: str = Field(..., description="8-direction cardinal string (N, NE, E, SE, S, SW, W, NW)")

class NavigationStatusResponse(BaseModel):
    distance_to_shore_meters: float = Field(..., description="Distance to shore in meters")
    bearing_to_shore_degrees: float = Field(..., description="Bearing to shore in degrees (0 to 360)")
    direction_to_shore: str = Field(..., description="8-direction cardinal direction to shore")
