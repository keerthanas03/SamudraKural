from pydantic import BaseModel, Field, EmailStr
from typing import Optional
from app.schemas.common import LocationPoint

class FishermanRegister(BaseModel):
    name: str = Field(..., min_length=1, max_length=255, description="Full name")
    email: Optional[EmailStr] = Field(None, description="Unique login email address")
    phone: str = Field(..., min_length=1, max_length=50, description="Contact phone number")
    password: Optional[str] = Field(None, description="Secure account password")
    pin: Optional[str] = Field(None, description="6-digit PIN")
    shore_location: Optional[LocationPoint] = None

class FishermanLogin(BaseModel):
    email: Optional[EmailStr] = Field(None, description="Login email address")
    phone: Optional[str] = Field(None, description="Phone number")
    password: Optional[str] = Field(None, description="Account password")
    pin: Optional[str] = Field(None, description="6-digit PIN")

class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
