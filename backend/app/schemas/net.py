from typing import Optional, List, Dict, Any
from datetime import datetime
from pydantic import BaseModel, Field, ConfigDict
from app.schemas.prediction import TrajectoryPointSchema, SearchAreaSchema, TrajectoryResponse
from app.schemas.environment import EnvironmentalState

class NetBase(BaseModel):
    name: str = Field(..., json_schema_extra={"example": "Net 01 - Deep Gill"})
    net_type: str = Field(default="FLOATING_GILL_NET", json_schema_extra={"example": "FLOATING_GILL_NET"})
    release_latitude: float = Field(..., ge=-90.0, le=90.0, json_schema_extra={"example": 13.05})
    release_longitude: float = Field(..., ge=-180.0, le=180.0, json_schema_extra={"example": 80.35})
    release_time: datetime = Field(..., description="Release time (UTC or ISO string)")
    expected_retrieval_time: datetime = Field(..., description="Expected retrieval time (UTC or ISO string)")
    notes: Optional[str] = None

class NetCreate(NetBase):
    pass

class NetSimulationRequest(BaseModel):
    net_name: Optional[str] = "Simulation Net"
    net_type: str = Field(default="FLOATING_GILL_NET", json_schema_extra={"example": "FLOATING_GILL_NET"})
    release_latitude: float = Field(default=13.05, ge=-90.0, le=90.0, json_schema_extra={"example": 13.05})
    release_longitude: float = Field(default=80.35, ge=-180.0, le=180.0, json_schema_extra={"example": 80.35})
    release_time: datetime = Field(..., description="Release time (UTC or ISO string)")
    duration_hours: float = Field(default=2.0, ge=0.25, le=48.0, description="Prediction horizon in hours")
    timestep_minutes: int = Field(default=15, ge=5, le=60, description="Numerical integration step in minutes")

class NetUpdate(BaseModel):
    name: Optional[str] = None
    net_type: Optional[str] = None
    expected_retrieval_time: Optional[datetime] = None
    status: Optional[str] = None  # ACTIVE, RETRIEVED, LOST, ARCHIVED
    notes: Optional[str] = None

class NetSummaryResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    user_id: int
    name: str
    net_type: str
    net_type_display: str
    status: str
    release_latitude: float
    release_longitude: float
    release_time_utc: datetime
    release_time_ist: str
    expected_retrieval_time_utc: datetime
    expected_retrieval_time_ist: str
    elapsed_time_formatted: str
    
    # Latest Prediction Highlights (for fisherman card)
    latest_predicted_lat: Optional[float] = None
    latest_predicted_lon: Optional[float] = None
    estimated_movement_km: Optional[float] = None
    drift_direction_cardinal: Optional[str] = None
    search_area_description: Optional[str] = None
    confidence: Optional[str] = "MEDIUM"
    data_updated_ago_formatted: Optional[str] = None
    created_at: datetime
    updated_at: datetime

class NetDetailResponse(NetSummaryResponse):
    trajectory: Optional[TrajectoryResponse] = None
    current_environment: Optional[EnvironmentalState] = None
