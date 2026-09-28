from pydantic import BaseModel, Field, ConfigDict
from typing import Optional
from datetime import datetime

class MissionCreate(BaseModel):
    sos_alert_id: int = Field(...)
    assigned_officer_id: Optional[int] = None
    officer_name: str = Field("Officer Command HQ")
    rescue_team: str = Field(...)
    rescue_vessel: str = Field(...)
    eta_minutes: int = Field(25, ge=1)
    notes: Optional[str] = Field(None)

class MissionStatusUpdate(BaseModel):
    status: str = Field(...) # ASSIGNED, DEPARTED, APPROACHING, VICTIM_LOCATED, RETURNING, COMPLETED, CANCELLED
    notes: Optional[str] = Field(None)
    eta_minutes: Optional[int] = Field(None)

class MissionResponse(BaseModel):
    id: int
    sos_alert_id: int
    assigned_officer_id: Optional[int] = None
    officer_name: str
    rescue_team: str
    rescue_vessel: str
    status: str
    eta_minutes: int
    notes: Optional[str] = None
    created_at: datetime
    updated_at: datetime
    started_at: Optional[datetime] = None
    completed_at: Optional[datetime] = None

    model_config = ConfigDict(from_attributes=True)
