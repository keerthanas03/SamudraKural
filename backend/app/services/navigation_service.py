import math
from typing import Tuple

EARTH_RADIUS_METERS = 6371000.0  # Mean radius of Earth in meters

def calculate_haversine_distance(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    """
    Calculate great-circle distance between two (lat, lon) points on Earth in meters.
    """
    phi1 = math.radians(lat1)
    phi2 = math.radians(lat2)
    delta_phi = math.radians(lat2 - lat1)
    delta_lambda = math.radians(lon2 - lon1)

    a = (
        math.sin(delta_phi / 2.0) ** 2
        + math.cos(phi1) * math.cos(phi2) * math.sin(delta_lambda / 2.0) ** 2
    )
    c = 2.0 * math.atan2(math.sqrt(a), math.sqrt(1.0 - a))
    return EARTH_RADIUS_METERS * c

def calculate_initial_bearing(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    """
    Calculate initial geographic bearing from (lat1, lon1) to (lat2, lon2) in degrees.
    Result is normalized to [0, 360). 0° = North, 90° = East, 180° = South, 270° = West.
    """
    phi1 = math.radians(lat1)
    phi2 = math.radians(lat2)
    delta_lambda = math.radians(lon2 - lon1)

    y = math.sin(delta_lambda) * math.cos(phi2)
    x = math.cos(phi1) * math.sin(phi2) - math.sin(phi1) * math.cos(phi2) * math.cos(delta_lambda)

    initial_bearing_rad = math.atan2(y, x)
    initial_bearing_deg = (math.degrees(initial_bearing_rad) + 360.0) % 360.0
    return round(initial_bearing_deg, 2)

def bearing_to_cardinal(bearing_degrees: float) -> str:
    """
    Convert geographic bearing in degrees to 8-direction cardinal string.
    Directions: N, NE, E, SE, S, SW, W, NW.
    """
    normalized = (bearing_degrees % 360.0 + 360.0) % 360.0
    if 337.5 <= normalized or normalized < 22.5:
        return "N"
    elif 22.5 <= normalized < 67.5:
        return "NE"
    elif 67.5 <= normalized < 112.5:
        return "E"
    elif 112.5 <= normalized < 157.5:
        return "SE"
    elif 157.5 <= normalized < 202.5:
        return "S"
    elif 202.5 <= normalized < 247.5:
        return "SW"
    elif 247.5 <= normalized < 292.5:
        return "W"
    else:
        return "NW"

def calculate_navigation(lat1: float, lon1: float, lat2: float, lon2: float) -> Tuple[float, float, str]:
    """
    Helper function returning (distance_meters, bearing_degrees, direction).
    """
    dist_m = calculate_haversine_distance(lat1, lon1, lat2, lon2)
    bearing_deg = calculate_initial_bearing(lat1, lon1, lat2, lon2)
    direction = bearing_to_cardinal(bearing_deg)
    return round(dist_m, 2), bearing_deg, direction

COASTAL_HAZARDS = [
    {"id": "HAZ_KASIMEDU_REEF", "name": "Kasimedu Submerged Reefs & Boulders", "latitude": 13.128, "longitude": 80.305, "radius_meters": 1400, "min_depth_m": 4.5, "type": "shallow_rock"},
    {"id": "HAZ_ENNORE_SHOAL", "name": "Ennore Thermal Shoal & Submerged Rocks", "latitude": 13.235, "longitude": 80.342, "radius_meters": 2200, "min_depth_m": 6.0, "type": "shallow_rock"},
    {"id": "HAZ_PULICAT_BARRIER", "name": "Pulicat Outer Barrier Reef & Sandbars", "latitude": 13.410, "longitude": 80.345, "radius_meters": 2800, "min_depth_m": 3.8, "type": "shallow_rock"},
    {"id": "HAZ_KOVALAM_POINT", "name": "Kovalam / Covelong Point Outer Reef", "latitude": 12.795, "longitude": 80.265, "radius_meters": 1800, "min_depth_m": 5.2, "type": "shallow_rock"},
    {"id": "HAZ_MAMALLAPURAM_REEF", "name": "Mamallapuram Submerged Shore Temple Rocks", "latitude": 12.615, "longitude": 80.205, "radius_meters": 1600, "min_depth_m": 4.8, "type": "shallow_rock"},
    {"id": "HAZ_RAM_SETU_SHOAL", "name": "Adam's Bridge / Ram Setu Submerged Shoals", "latitude": 9.220, "longitude": 79.520, "radius_meters": 3500, "min_depth_m": 2.1, "type": "shallow_rock"},
    {"id": "HAZ_TUTICORIN_HARE_ISLAND", "name": "Tuticorin Hare Island Submerged Coral Reef", "latitude": 8.770, "longitude": 78.210, "radius_meters": 2100, "min_depth_m": 4.0, "type": "shallow_rock"},
    {"id": "HAZ_KANYAKUMARI_ROCKS", "name": "Kanyakumari Vivekananda Submerged Rock Ridge", "latitude": 8.075, "longitude": 77.558, "radius_meters": 1700, "min_depth_m": 4.0, "type": "shallow_rock"},
    {"id": "HAZ_VIZHINJAM_BREAKWATER", "name": "Vizhinjam Submerged Granite Breakwater Rocks", "latitude": 8.375, "longitude": 76.985, "radius_meters": 1800, "min_depth_m": 6.5, "type": "shallow_rock"},
    {"id": "HAZ_VENGURLA_BURNT_ROCKS", "name": "Vengurla Rocks (Burnt Islands) Dangerous Pinnacles", "latitude": 15.890, "longitude": 73.475, "radius_meters": 3000, "min_depth_m": 4.0, "type": "shallow_rock"},
    {"id": "HAZ_MUMBAI_PRONGS_REEF", "name": "Mumbai Prongs Reef & Colaba Submerged Rocks", "latitude": 18.885, "longitude": 72.805, "radius_meters": 2600, "min_depth_m": 3.5, "type": "shallow_rock"},
    {"id": "HAZ_DWARKA_SUBMERGED_ROCKS", "name": "Dwarka Coastal Submerged Rocks & Ancient Ridges", "latitude": 22.240, "longitude": 68.950, "radius_meters": 2500, "min_depth_m": 4.2, "type": "shallow_rock"},
    {"id": "HAZ_VIZAG_DOLPHIN_NOSE", "name": "Vizag Dolphin's Nose Submerged Rock Base", "latitude": 17.680, "longitude": 83.295, "radius_meters": 1800, "min_depth_m": 6.0, "type": "shallow_rock"},
    {"id": "HAZ_CHILIKA_MUGGER_MUKH", "name": "Chilika Mouth (Mugger Mukh) Shifting Sandbars", "latitude": 19.700, "longitude": 85.340, "radius_meters": 2800, "min_depth_m": 2.8, "type": "shallow_rock"},
    {"id": "HAZ_SAGAR_ISLAND_BAR", "name": "Sagar Island Outer Shifting Sandbar Hazard", "latitude": 21.640, "longitude": 88.050, "radius_meters": 3200, "min_depth_m": 3.0, "type": "shallow_rock"},
    {"id": "HAZ_ROSS_ISLAND_REEF", "name": "Port Blair Ross Island Submerged Coral Ridge", "latitude": 11.675, "longitude": 92.765, "radius_meters": 2000, "min_depth_m": 4.0, "type": "shallow_rock"},
]

