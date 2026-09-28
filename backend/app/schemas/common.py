from pydantic import BaseModel, Field

class LocationPoint(BaseModel):
    latitude: float = Field(..., ge=-90.0, le=90.0, description="Latitude value between -90 and 90")
    longitude: float = Field(..., ge=-180.0, le=180.0, description="Longitude value between -180 and 180")
