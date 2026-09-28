from typing import Optional, List, Dict, Any
from datetime import datetime
from pydantic import BaseModel, Field

class TrajectoryPointSchema(BaseModel):
    step_number: int
    prediction_time_utc: datetime
    prediction_time_ist: str
    latitude: float
    longitude: float
    drift_speed_mps: float
    drift_speed_kmh: float
    drift_direction_deg: float
    drift_direction_cardinal: str
    cumulative_distance_km: float
    uncertainty_radius_km: float
    confidence: str  # HIGH, MEDIUM, LOW
    environmental_summary: Optional[Dict[str, Any]] = None

class SearchAreaSchema(BaseModel):
    center_latitude: float
    center_longitude: float
    uncertainty_radius_km: float
    min_distance_from_release_km: float
    max_distance_from_release_km: float
    general_direction: str
    sector_description: str  # e.g., "1.5–3.3 km northeast"
    confidence: str          # HIGH, MEDIUM, LOW
    notes: str

class TrajectoryResponse(BaseModel):
    net_id: int
    net_name: str
    net_type: str
    release_time_utc: datetime
    expected_retrieval_time_utc: datetime
    total_duration_hours: float
    points_count: int
    points: List[TrajectoryPointSchema]
    latest_predicted_point: TrajectoryPointSchema
    search_area: SearchAreaSchema
    model_version: str
    data_sources: List[str]
    forecast_updated_at: datetime
    safety_disclaimer: str = (
        "⚠️ This is a predicted drift area, not an exact net location. "
        "Actual drift may vary with local sea conditions."
    )
