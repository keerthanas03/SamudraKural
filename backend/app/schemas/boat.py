from datetime import datetime
from pydantic import BaseModel, Field, ConfigDict

class BoatCreate(BaseModel):
    name: str = Field(..., min_length=1, max_length=255, description="Boat name")
    registration_number: str = Field(..., min_length=1, max_length=100, description="Registration number")
    boat_type: str = Field(..., min_length=1, max_length=100, description="Type of boat")

class BoatResponse(BaseModel):
    id: int
    fisherman_id: int
    name: str
    registration_number: str
    boat_type: str
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)
