import math
from typing import Tuple

CARDINAL_16 = [
    "North", "North-Northeast", "Northeast", "East-Northeast",
    "East", "East-Southeast", "Southeast", "South-Southeast",
    "South", "South-Southwest", "Southwest", "West-Southwest",
    "West", "West-Northwest", "Northwest", "North-Northwest"
]

CARDINAL_8 = [
    "North", "Northeast", "East", "Southeast",
    "South", "Southwest", "West", "Northwest"
]

CARDINAL_ARROWS = {
    "North": "↑ North",
    "North-Northeast": "↗ NNE",
    "Northeast": "↗ Northeast",
    "East-Northeast": "↗ ENE",
    "East": "→ East",
    "East-Southeast": "↘ ESE",
    "Southeast": "↘ Southeast",
    "South-Southeast": "↘ SSE",
    "South": "↓ South",
    "South-Southwest": "↙ SSW",
    "Southwest": "↙ Southwest",
    "West-Southwest": "↙ WSW",
    "West": "← West",
    "West-Northwest": "↖ WNW",
    "Northwest": "↖ Northwest",
    "North-Northwest": "↖ NNW",
}

def uv_to_speed_and_direction(u: float, v: float, is_oceanographic: bool = True) -> Tuple[float, float, str]:
    """
    Convert eastward (u) and northward (v) velocity components to speed (m/s) and direction (degrees).
    
    If is_oceanographic=True (ocean current, Stokes drift, drift vector):
      Direction is the angle towards which the flow is moving: atan2(u, v) in degrees.
    If is_oceanographic=False (meteorological wind):
      Direction is the angle from which the wind is blowing: atan2(-u, -v) in degrees.
      
    Returns: (speed_mps, direction_deg, cardinal_name)
    """
    speed = math.hypot(u, v)
    if speed < 1e-6:
        return 0.0, 0.0, "Calm"

    if is_oceanographic:
        rad = math.atan2(u, v)
    else:
        rad = math.atan2(-u, -v)

    deg = (math.degrees(rad) + 360.0) % 360.0
    cardinal = degrees_to_cardinal(deg)
    return speed, deg, cardinal

def speed_and_direction_to_uv(speed: float, direction_deg: float, is_oceanographic: bool = True) -> Tuple[float, float]:
    """
    Convert speed (m/s) and direction (degrees) back to eastward (u) and northward (v) vector components.
    """
    rad = math.radians(direction_deg)
    if is_oceanographic:
        # u is east (sin), v is north (cos)
        u = speed * math.sin(rad)
        v = speed * math.cos(rad)
    else:
        # Wind blowing from direction_deg
        u = -speed * math.sin(rad)
        v = -speed * math.cos(rad)
    return u, v

def degrees_to_cardinal(deg: float, use_16_points: bool = True) -> str:
    """
    Convert compass degrees [0, 360) to a human-readable cardinal heading string.
    """
    deg = (deg % 360.0 + 360.0) % 360.0
    if use_16_points:
        idx = int((deg + 11.25) / 22.5) % 16
        return CARDINAL_16[idx]
    else:
        idx = int((deg + 22.5) / 45.0) % 8
        return CARDINAL_8[idx]

def angular_difference_degrees(deg1: float, deg2: float) -> float:
    """
    Calculate the absolute smallest angular difference between two compass bearings in degrees [0, 180].
    """
    diff = abs((deg1 - deg2 + 180.0) % 360.0 - 180.0)
    return diff
