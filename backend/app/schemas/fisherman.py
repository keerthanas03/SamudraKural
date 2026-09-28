from datetime import datetime
from pydantic import BaseModel, Field, EmailStr, ConfigDict
from app.schemas.common import LocationPoint

class FishermanCreate(BaseModel):
    name: str = Field(..., min_length=1, max_length=255, description="Fisherman full name")
    email: EmailStr = Field(..., description="Unique email address")
    phone: str = Field(..., min_length=1, max_length=50, description="Contact phone number")
    password: str = Field(..., min_length=6, max_length=128, description="Password")
    shore_location: LocationPoint

class FishermanResponse(BaseModel):
    id: int
    name: str
    email: str
    phone: str
    is_active: bool
    shore_location: LocationPoint
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)
