import math
import pytest
from datetime import datetime, timezone, timedelta
from app.utils.direction import (
    uv_to_speed_and_direction,
    speed_and_direction_to_uv,
    degrees_to_cardinal,
    angular_difference_degrees
)
from app.utils.geo import (
    haversine_distance_km,
    calculate_bearing_degrees,
    forward_geodesic_point
)
from app.utils.units import mps_to_kmh, mps_to_knots, classify_sea_state
from app.services.validation_service import validation_service
from app.services.uncertainty_engine import uncertainty_engine
from app.services.drift_engine import drift_engine
from app.services.environment_service import environment_service

def test_uv_to_speed_and_direction_oceanographic():
    # Flow directly North: u=0, v=1 -> speed=1, dir=0/360, "North"
    speed, direction, cardinal = uv_to_speed_and_direction(0.0, 1.0, is_oceanographic=True)
    assert round(speed, 2) == 1.0
    assert round(direction, 1) == 0.0 or round(direction, 1) == 360.0
    assert "North" in cardinal

    # Flow directly East: u=1, v=0 -> speed=1, dir=90, "East"
    speed, direction, cardinal = uv_to_speed_and_direction(1.0, 0.0, is_oceanographic=True)
    assert round(speed, 2) == 1.0
    assert round(direction, 1) == 90.0
    assert "East" in cardinal

    # Flow Northeast: u=1, v=1 -> dir=45
    speed, direction, cardinal = uv_to_speed_and_direction(1.0, 1.0, is_oceanographic=True)
    assert round(direction, 1) == 45.0
    assert "Northeast" in cardinal

def test_roundtrip_uv_conversion():
    original_speed = 0.42
    original_dir = 52.5
    u, v = speed_and_direction_to_uv(original_speed, original_dir, is_oceanographic=True)
    recov_speed, recov_dir, _ = uv_to_speed_and_direction(u, v, is_oceanographic=True)
    assert abs(recov_speed - original_speed) < 1e-4
    assert abs(recov_dir - original_dir) < 1e-3

def test_geodesic_distance_and_forward_projection():
    # Chennai coast release point
    lat1, lon1 = 13.05, 80.35
    bearing = 45.0  # Northeast
    dist_km = 10.0

    lat2, lon2 = forward_geodesic_point(lat1, lon1, dist_km, bearing)
    computed_dist = haversine_distance_km(lat1, lon1, lat2, lon2)
    computed_bearing = calculate_bearing_degrees(lat1, lon1, lat2, lon2)

    assert abs(computed_dist - dist_km) < 0.05
    assert abs(computed_bearing - bearing) < 0.5

def test_angular_difference():
    assert angular_difference_degrees(10.0, 350.0) == 20.0
    assert angular_difference_degrees(45.0, 50.0) == 5.0
    assert angular_difference_degrees(0.0, 180.0) == 180.0

def test_validation_service_agreement():
    copernicus_data = {
        "current": {"speed_mps": 0.40, "direction_deg": 45.0},
        "wave": {"significant_wave_height_m": 1.2}
    }
    incois_close = {
        "current": {"speed_mps": 0.38, "direction_deg": 48.0},
        "wave": {"significant_wave_height_m": 1.1}
    }
    comparison_high = validation_service.compare_providers(copernicus_data, incois_close)
    assert comparison_high.current_agreement == "HIGH"
    assert comparison_high.wave_agreement == "HIGH"
    assert comparison_high.overall_confidence_modifier == 1.0

    incois_divergent = {
        "current": {"speed_mps": 0.90, "direction_deg": 220.0},
        "wave": {"significant_wave_height_m": 2.5}
    }
    comparison_low = validation_service.compare_providers(copernicus_data, incois_divergent)
    assert comparison_low.current_agreement == "LOW"
    assert comparison_low.overall_confidence_modifier > 1.3

def test_uncertainty_engine_rules():
    rad_km, conf, area = uncertainty_engine.compute_uncertainty_and_search_area(
        release_lat=13.05,
        release_lon=80.35,
        predicted_lat=13.07,
        predicted_lon=80.37,
        displacement_km=2.4,
        drift_direction_deg=45.0,
        duration_hours=3.5,
        wave_height_m=1.2,
        wind_speed_mps=5.0,
        agreement_modifier=1.0,
        data_age_minutes=15
    )
    assert rad_km > 0.4
    assert conf in ["HIGH", "MEDIUM"]
    assert "northeast" in area.sector_description
    assert area.min_distance_from_release_km < area.max_distance_from_release_km

@pytest.mark.asyncio
async def test_drift_engine_simulation():
    t0 = datetime.now(timezone.utc)
    t_end = t0 + timedelta(hours=3)

    traj = await drift_engine.calculate_trajectory(
        net_id=999,
        net_name="Test Net 01",
        net_type="FLOATING_GILL_NET",
        release_lat=13.05,
        release_lon=80.35,
        release_time=t0,
        retrieval_time=t_end,
        timestep_minutes=15
    )

    assert traj.net_id == 999
    assert len(traj.points) > 1
    assert traj.points[0].step_number == 0
    assert traj.points[-1].step_number == len(traj.points) - 1
    assert traj.points[-1].cumulative_distance_km > 0.0
    assert traj.search_area.uncertainty_radius_km > 0.0
    assert traj.safety_disclaimer.startswith("⚠️")

@pytest.mark.asyncio
async def test_environment_service_test_endpoint_logic():
    state, resp = await environment_service.get_normalized_environment(13.05, 80.35)
    assert state.latitude == 13.05
    assert state.longitude == 80.35
    assert resp.incois is not None
    assert resp.copernicus is not None
    assert resp.comparison is not None
    assert resp.normalized_state is not None
