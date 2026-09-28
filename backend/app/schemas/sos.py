from pydantic import BaseModel, Field, ConfigDict
from typing import Optional, List
from datetime import datetime

class SOSCreate(BaseModel):
    latitude: float = Field(..., description="Current latitude (-90 to 90)")
    longitude: float = Field(..., description="Current longitude (-180 to 180)")
    emergency_type: str = Field("General Emergency", description="Type of emergency")
    description: Optional[str] = Field(None, description="Distress description")
    people_affected: int = Field(1, ge=1, description="Number of crew onboard")
    priority: Optional[str] = Field("CRITICAL", description="Priority level")
    delivery_status: Optional[str] = Field("ONLINE", description="Transport delivery status")
    public_sos_id: Optional[str] = Field(None, description="Client-generated unique SOS UUID")
    location_accuracy_meters: Optional[float] = Field(15.0, description="GPS accuracy in meters")
    battery_percent: Optional[int] = Field(100, ge=0, le=100, description="Battery level percentage")
    fisherman_name: Optional[str] = Field(None, description="Captain/Fisherman name")
    fisherman_phone: Optional[str] = Field(None, description="Phone number")
    boat_name: Optional[str] = Field(None, description="Vessel name")
    boat_registration: Optional[str] = Field(None, description="Vessel registration number")
    home_port: Optional[str] = Field(None, description="Home harbor/port")

class SOSStatusUpdate(BaseModel):
    status: str = Field(..., description="Target SOS status")
    notes: Optional[str] = Field(None, description="Status update notes")
    delivery_status: Optional[str] = Field(None, description="Updated delivery status")
    cancellation_reason: Optional[str] = Field(None, description="Reason for cancellation if applicable")

class SOSResponseCreate(BaseModel):
    response: str = Field(..., description="YES_HELP or NO response")
    latitude: Optional[float] = Field(None, description="Responder current latitude")
    longitude: Optional[float] = Field(None, description="Responder current longitude")
    distance_meters: Optional[float] = Field(None, description="Calculated distance in meters")
    eta_minutes: Optional[int] = Field(None, description="Estimated arrival time in minutes")
    message: Optional[str] = Field(None, description="Message from responder")

class SOSResponseItem(BaseModel):
    id: int
    sos_alert_id: int
    responder_fisherman_id: int
    response: str
    latitude: Optional[float] = None
    longitude: Optional[float] = None
    distance_meters: Optional[float] = None
    eta_minutes: Optional[int] = None
    message: Optional[str] = None
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)

class FishermanMinimal(BaseModel):
    id: Optional[int] = None
    name: str
    phone: str
    emergency_phone: Optional[str] = None
    home_port: Optional[str] = None

class BoatMinimal(BaseModel):
    id: Optional[int] = None
    name: str
    registration: Optional[str] = None
    vessel_type: Optional[str] = None

class RescueMissionSummary(BaseModel):
    id: int
    rescue_team: str
    rescue_vessel: str
    status: str
    eta_minutes: int

class SOSResponse(BaseModel):
    id: int
    public_sos_id: Optional[str] = None
    fisherman_id: Optional[int] = None
    boat_id: Optional[int] = None
    fisherman: Optional[FishermanMinimal] = None
    boat: Optional[BoatMinimal] = None
    latitude: float
    longitude: float
    location_accuracy_meters: Optional[float] = 15.0
    battery_percent: Optional[int] = 100
    emergency_type: str
    description: Optional[str] = None
    people_affected: int
    priority: str
    status: str
    delivery_status: Optional[str] = "ONLINE"
    relay_hops: Optional[int] = 0
    distance_to_nearest_port_km: Optional[float] = 12.4
    nearest_port_name: Optional[str] = "Chennai Port HQ"
    created_at: datetime
    updated_at: datetime
    last_known_location_at: Optional[datetime] = None
    acknowledged_at: Optional[datetime] = None
    resolved_at: Optional[datetime] = None
    cancelled_at: Optional[datetime] = None
    cancellation_reason: Optional[str] = None
    rescue_mission: Optional[RescueMissionSummary] = None
    responses: Optional[List[SOSResponseItem]] = None

    model_config = ConfigDict(from_attributes=True)

class CoastalGuardDashboardResponse(BaseModel):
    active_sos_count: int
    critical_alerts_count: int
    active_rescue_missions_count: int
    resolved_today_count: int
    high_risk_zones_count: int
    monitored_fishermen_count: int
    last_updated: str
