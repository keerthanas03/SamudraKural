from app.schemas.auth import FishermanRegister, FishermanLogin, TokenResponse
from app.schemas.fisherman import FishermanCreate, FishermanResponse
from app.schemas.boat import BoatCreate, BoatResponse
from app.schemas.location import FishingLocationCreate, FishingLocationResponse, NearbyLocationResponse
from app.schemas.user_location import UserLocationHeartbeat, UserLocationResponse, NearbyFishermanResponse
from app.schemas.sos import SOSCreate, SOSStatusUpdate, SOSResponseCreate, SOSResponseItem, SOSResponse, CoastalGuardDashboardResponse
from app.schemas.rescue_mission import MissionCreate, MissionStatusUpdate, MissionResponse
from app.schemas.common import LocationPoint

__all__ = [
    "FishermanRegister",
    "FishermanLogin",
    "TokenResponse",
    "FishermanCreate",
    "FishermanResponse",
    "BoatCreate",
    "BoatResponse",
    "FishingLocationCreate",
    "FishingLocationResponse",
    "NearbyLocationResponse",
    "UserLocationHeartbeat",
    "UserLocationResponse",
    "NearbyFishermanResponse",
    "SOSCreate",
    "SOSStatusUpdate",
    "SOSResponseCreate",
    "SOSResponseItem",
    "SOSResponse",
    "CoastalGuardDashboardResponse",
    "MissionCreate",
    "MissionStatusUpdate",
    "MissionResponse",
    "LocationPoint",
]
