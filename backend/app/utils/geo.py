import math
from typing import Tuple, Dict

EARTH_RADIUS_KM = 6371.0

def haversine_distance_km(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    """
    Calculate the great-circle distance between two points in kilometers.
    """
    phi1 = math.radians(lat1)
    phi2 = math.radians(lat2)
    delta_phi = math.radians(lat2 - lat1)
    delta_lambda = math.radians(lon2 - lon1)

    a = math.sin(delta_phi / 2.0) ** 2 + \
        math.cos(phi1) * math.cos(phi2) * math.sin(delta_lambda / 2.0) ** 2
    c = 2.0 * math.atan2(math.sqrt(a), math.sqrt(1.0 - a))
    return EARTH_RADIUS_KM * c

def calculate_bearing_degrees(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    """
    Calculate initial compass bearing from (lat1, lon1) to (lat2, lon2) in degrees [0, 360).
    """
    phi1 = math.radians(lat1)
    phi2 = math.radians(lat2)
    delta_lambda = math.radians(lon2 - lon1)

    y = math.sin(delta_lambda) * math.cos(phi2)
    x = math.cos(phi1) * math.sin(phi2) - math.sin(phi1) * math.cos(phi2) * math.cos(delta_lambda)
    bearing_rad = math.atan2(y, x)
    bearing_deg = (math.degrees(bearing_rad) + 360.0) % 360.0
    return bearing_deg

def forward_geodesic_point(lat: float, lon: float, distance_km: float, bearing_deg: float) -> Tuple[float, float]:
    """
    Given a starting point (lat, lon), a distance in km, and a compass bearing in degrees,
    calculate the destination point coordinates using spherical earth forward equations.
    """
    angular_dist = distance_km / EARTH_RADIUS_KM
    bearing_rad = math.radians(bearing_deg)
    phi1 = math.radians(lat)
    lambda1 = math.radians(lon)

    phi2 = math.asin(
        math.sin(phi1) * math.cos(angular_dist) +
        math.cos(phi1) * math.sin(angular_dist) * math.cos(bearing_rad)
    )

    lambda2 = lambda1 + math.atan2(
        math.sin(bearing_rad) * math.sin(angular_dist) * math.cos(phi1),
        math.cos(angular_dist) - math.sin(phi1) * math.sin(phi2)
    )

    # Normalize longitude to [-180, 180]
    lambda2_deg = (math.degrees(lambda2) + 540.0) % 360.0 - 180.0
    phi2_deg = math.degrees(phi2)
    return phi2_deg, lambda2_deg

def compute_bounding_box(lat: float, lon: float, buffer_km: float = 50.0) -> Dict[str, float]:
    """
    Calculate a bounding box (min_lat, max_lat, min_lon, max_lon) around a point with a buffer in km.
    """
    lat_delta = buffer_km / 111.0  # ~111 km per degree latitude
    lon_delta = buffer_km / (111.0 * math.cos(math.radians(lat)) if math.cos(math.radians(lat)) > 0.01 else 111.0)
    
    return {
        "min_lat": max(-90.0, lat - lat_delta),
        "max_lat": min(90.0, lat + lat_delta),
        "min_lon": max(-180.0, lon - lon_delta),
        "max_lon": min(180.0, lon + lon_delta),
    }
