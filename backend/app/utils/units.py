from typing import Tuple

def mps_to_kmh(mps: float) -> float:
    """Convert meters per second to kilometers per hour."""
    return mps * 3.6

def mps_to_knots(mps: float) -> float:
    """Convert meters per second to knots."""
    return mps * 1.94384

def kmh_to_mps(kmh: float) -> float:
    """Convert kilometers per hour to meters per second."""
    return kmh / 3.6

def knots_to_mps(knots: float) -> float:
    """Convert knots to meters per second."""
    return knots / 1.94384

def classify_sea_state(wave_height_m: float) -> Tuple[str, str]:
    """
    Classify sea state according to World Meteorological Organization (WMO) Code 3700.
    Returns: (sea_state_name, description_for_fishermen)
    """
    if wave_height_m < 0.1:
        return "Calm (Glassy)", "Very safe calm waters"
    elif wave_height_m < 0.5:
        return "Calm (Rippled)", "Smooth sea, minimal wave motion"
    elif wave_height_m < 1.25:
        return "Smooth", "Gentle wavelets, easy navigation"
    elif wave_height_m < 2.5:
        return "Moderate", "Moderate waves, whitecaps common"
    elif wave_height_m < 4.0:
        return "Rough", "Large waves, cautious navigation required"
    elif wave_height_m < 6.0:
        return "Very Rough", "High waves, dangerous conditions"
    elif wave_height_m < 9.0:
        return "High", "Severe sea conditions, stay ashore"
    else:
        return "Phenomenal", "Extreme danger, massive seas"
