from geoalchemy2 import WKTElement
from geoalchemy2.shape import to_shape
from shapely.geometry import Point as ShapelyPoint
from app.schemas.common import LocationPoint

def location_to_wkt(point) -> WKTElement:
    """
    Convert LocationPoint or dict (latitude, longitude) to PostGIS WKTElement (POINT(longitude latitude), srid=4326).
    PostGIS requires longitude first, latitude second.
    """
    if point is None:
        return WKTElement("POINT(80.297412 13.120456)", srid=4326)
    if isinstance(point, dict):
        lat = point.get("latitude", 13.120456)
        lon = point.get("longitude", 80.297412)
        return WKTElement(f"POINT({lon} {lat})", srid=4326)
    return WKTElement(f"POINT({point.longitude} {point.latitude})", srid=4326)

def wkt_from_lat_lon(latitude: float, longitude: float) -> WKTElement:
    """
    Convert latitude and longitude floats to PostGIS WKTElement.
    """
    return WKTElement(f"POINT({longitude} {latitude})", srid=4326)

def spatial_to_location_point(geo_obj) -> LocationPoint:
    """
    Convert PostGIS Geography / WKBElement / WKTElement / Shapely Point to LocationPoint schema.
    """
    if geo_obj is None:
        raise ValueError("Cannot convert None spatial object to LocationPoint")
    
    if isinstance(geo_obj, LocationPoint):
        return geo_obj

    if isinstance(geo_obj, ShapelyPoint):
        return LocationPoint(latitude=geo_obj.y, longitude=geo_obj.x)

    # Use GeoAlchemy2's to_shape to get shapely point
    shapely_point = to_shape(geo_obj)
    return LocationPoint(latitude=shapely_point.y, longitude=shapely_point.x)
