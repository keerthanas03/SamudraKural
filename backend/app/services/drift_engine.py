import math
import logging
from datetime import datetime, timezone, timedelta
from typing import List, Tuple, Dict, Any, Optional
import numpy as np
from app.core.config import settings
from app.services.copernicus_service import copernicus_service
from app.services.incois_service import incois_service
from app.services.uncertainty_engine import uncertainty_engine
from app.schemas.prediction import TrajectoryPointSchema, SearchAreaSchema, TrajectoryResponse
from app.utils.geo import forward_geodesic_point, haversine_distance_km, calculate_bearing_degrees, compute_bounding_box
from app.utils.direction import uv_to_speed_and_direction
from app.utils.units import mps_to_kmh, classify_sea_state
from app.utils.time import ensure_utc, to_ist, calculate_age_minutes

logger = logging.getLogger(__name__)

class DeterministicDriftEngine:
    """
    Deterministic Physics-based Net Drift Simulation Engine.
    Retrieves a single spatial/temporal bounding box subset for the prediction horizon,
    and performs fast local interpolation at each discrete timestep along spherical geodesics.
    """

    def __init__(self):
        self.model_version = settings.DRIFT_MODEL_VERSION
        self.windage_map = settings.WINDAGE_COEFFICIENTS
        self.default_timestep_minutes = getattr(settings, 'DEFAULT_PREDICTION_STEP_MINUTES', 30)

    def get_windage_coefficient(self, net_type: str) -> float:
        return self.windage_map.get(net_type, self.windage_map.get("FLOATING_GILL_NET", 0.028))

    async def calculate_trajectory(
        self,
        net_id: int,
        net_name: str,
        net_type: str,
        release_lat: float,
        release_lon: float,
        release_time: datetime,
        retrieval_time: datetime,
        timestep_minutes: Optional[int] = None
    ) -> TrajectoryResponse:
        dt_minutes = timestep_minutes or self.default_timestep_minutes
        dt_seconds = dt_minutes * 60.0

        release_utc = ensure_utc(release_time)
        retrieval_utc = ensure_utc(retrieval_time)

        # Enforce valid forward horizon (at least 15 min, at most MAX_PREDICTION_HOURS)
        if retrieval_utc <= release_utc:
            retrieval_utc = release_utc + timedelta(hours=4)

        max_horizon = release_utc + timedelta(hours=settings.MAX_PREDICTION_HOURS)
        if retrieval_utc > max_horizon:
            retrieval_utc = max_horizon

        total_duration_hours = max(0.25, (retrieval_utc - release_utc).total_seconds() / 3600.0)
        num_steps = max(1, int(math.ceil((retrieval_utc - release_utc).total_seconds() / dt_seconds)))

        windage_coeff = self.get_windage_coefficient(net_type)
        logger.info(
            "Starting drift trajectory calculation for Net %s (%s). Horizon: %sh (%s steps), Windage: %s",
            net_id, net_type, round(total_duration_hours, 1), num_steps, windage_coeff
        )

        # 1. Fetch single spatial/temporal subset for the entire trajectory bounding box
        bbox = compute_bounding_box(release_lat, release_lon, buffer_km=max(30.0, total_duration_hours * 5.0))
        start_sub = release_utc - timedelta(hours=6)
        end_sub = retrieval_utc + timedelta(hours=6)

        phy_ds, wav_ds = None, None
        surface_phy = None
        try:
            phy_ds, wav_ds = copernicus_service.fetch_spatial_subset(
                min_lat=bbox["min_lat"],
                max_lat=bbox["max_lat"],
                min_lon=bbox["min_lon"],
                max_lon=bbox["max_lon"],
                start_time=start_sub,
                end_time=end_sub
            )
            if phy_ds is not None:
                phy_vars = [v for v in ["uo", "vo"] if v in phy_ds.data_vars]
                if 'depth' in phy_ds.dims or 'depth' in phy_ds.coords:
                    surface_phy = phy_ds.isel(depth=0)[phy_vars].compute()
                else:
                    surface_phy = phy_ds[phy_vars].compute()
            if wav_ds is not None:
                wav_vars = [v for v in ["VHM0", "VMDR", "VTPK", "VSDX", "VSDY"] if v in wav_ds.data_vars]
                wav_ds = wav_ds[wav_vars].compute()
        except Exception as e:
            logger.warning("Subset query non-fatal fallback: %s", e)

        def _interp_scalar(ds, var_name: str, lat: float, lon: float, t_val: datetime, default: float = 0.0) -> float:
            if ds is None or var_name not in ds.data_vars:
                return default
            t_np = np.datetime64(t_val.replace(tzinfo=None)) if isinstance(t_val, datetime) else np.datetime64(t_val)
            lat_name = "latitude" if "latitude" in ds.coords or "latitude" in ds.dims else "lat"
            lon_name = "longitude" if "longitude" in ds.coords or "longitude" in ds.dims else "lon"
            time_name = "time" if ("time" in ds.coords or "time" in ds.dims) else [c for c in ds.coords if "time" in str(c).lower()][0]
            kw = {lat_name: lat, lon_name: lon, time_name: t_np}
            try:
                val = float(np.asarray(ds[var_name].interp(**kw, method="linear").values).squeeze())
                if not np.isnan(val):
                    return val
            except Exception:
                pass
            try:
                val = float(np.asarray(ds[var_name].sel(**kw, method="nearest").values).squeeze())
                if not np.isnan(val):
                    return val
            except Exception:
                pass
            return default

        current_lat = release_lat
        current_lon = release_lon
        current_time = release_utc
        cumulative_dist_km = 0.0

        points: List[TrajectoryPointSchema] = []
        data_sources = {"COPERNICUS_MARINE", "INCOIS_OSF"}

        # Step 0: Initial checkpoint at deployment time & location
        init_uo, init_vo = 0.0, 0.0
        init_stokes_u, init_stokes_v = 0.0, 0.0
        init_wave_h = 1.0

        if surface_phy is not None:
            uo_var = "uo" if "uo" in surface_phy.data_vars else [v for v in surface_phy.data_vars if "uo" in str(v).lower()][0]
            vo_var = "vo" if "vo" in surface_phy.data_vars else [v for v in surface_phy.data_vars if "vo" in str(v).lower()][0]
            init_uo = _interp_scalar(surface_phy, uo_var, current_lat, current_lon, current_time, default=0.0)
            init_vo = _interp_scalar(surface_phy, vo_var, current_lat, current_lon, current_time, default=0.0)
        elif not settings.DEMO_MODE:
            raise RuntimeError("Live Copernicus Ocean Current dataset unavailable. Real data is required when DEMO_MODE=false.")
        else:
            demo_0 = copernicus_service._generate_deterministic_demo_data(current_lat, current_lon, current_time)
            init_uo = demo_0["current"]["uo"]
            init_vo = demo_0["current"]["vo"]

        if wav_ds is not None:
            init_stokes_u = _interp_scalar(wav_ds, "VSDX", current_lat, current_lon, current_time, default=0.0)
            init_stokes_v = _interp_scalar(wav_ds, "VSDY", current_lat, current_lon, current_time, default=0.0)
            init_wave_h = _interp_scalar(wav_ds, "VHM0", current_lat, current_lon, current_time, default=1.0)

        env_inc = incois_service.fetch_point_environment(current_lat, current_lon, current_time)
        inc_wind = env_inc.get("wind", {})
        wind_u = inc_wind.get("u", 0.0)
        wind_v = inc_wind.get("v", 0.0)
        wind_spd = inc_wind.get("speed_mps", 4.5)
        wind_card = inc_wind.get("cardinal", "Northeast")

        init_current_spd, _, _ = uv_to_speed_and_direction(init_uo, init_vo, is_oceanographic=True)
        init_sea_state, _ = classify_sea_state(init_wave_h)

        points.append(
            TrajectoryPointSchema(
                step_number=0,
                prediction_time_utc=current_time,
                prediction_time_ist=to_ist(current_time).strftime("%d %b %Y, %I:%M %p"),
                latitude=round(current_lat, 5),
                longitude=round(current_lon, 5),
                drift_speed_mps=0.0,
                drift_speed_kmh=0.0,
                drift_direction_deg=0.0,
                drift_direction_cardinal="Release Point",
                cumulative_distance_km=0.0,
                uncertainty_radius_km=0.25,
                confidence="HIGH",
                environmental_summary={
                    "current_speed_mps": round(init_current_spd, 3),
                    "wind_speed_kmh": round(mps_to_kmh(wind_spd), 1),
                    "wave_height_m": round(init_wave_h, 2),
                    "sea_state": init_sea_state,
                }
            )
        )

        latest_wave_height = init_wave_h
        latest_wind_speed = wind_spd

        # Time-step numerical integration
        for step in range(1, num_steps + 1):
            step_time = release_utc + timedelta(seconds=step * dt_seconds)
            if step_time > retrieval_utc:
                step_time = retrieval_utc
                dt_step_seconds = (retrieval_utc - (release_utc + timedelta(seconds=(step - 1) * dt_seconds))).total_seconds()
            else:
                dt_step_seconds = dt_seconds

            # Local spatial and temporal interpolation from loaded dataset subset
            uo, vo = 0.0, 0.0
            stokes_u, stokes_v = 0.0, 0.0
            wave_h = 1.0

            if surface_phy is not None:
                uo_var = "uo" if "uo" in surface_phy.data_vars else [v for v in surface_phy.data_vars if "uo" in str(v).lower()][0]
                vo_var = "vo" if "vo" in surface_phy.data_vars else [v for v in surface_phy.data_vars if "vo" in str(v).lower()][0]
                uo = _interp_scalar(surface_phy, uo_var, current_lat, current_lon, step_time, default=init_uo)
                vo = _interp_scalar(surface_phy, vo_var, current_lat, current_lon, step_time, default=init_vo)
            elif not settings.DEMO_MODE:
                raise RuntimeError("Live Copernicus Ocean Current dataset unavailable for step simulation.")
            else:
                demo_step = copernicus_service._generate_deterministic_demo_data(current_lat, current_lon, step_time)
                uo = demo_step["current"]["uo"]
                vo = demo_step["current"]["vo"]

            if wav_ds is not None:
                stokes_u = _interp_scalar(wav_ds, "VSDX", current_lat, current_lon, step_time, default=0.0)
                stokes_v = _interp_scalar(wav_ds, "VSDY", current_lat, current_lon, step_time, default=0.0)
                wave_h = _interp_scalar(wav_ds, "VHM0", current_lat, current_lon, step_time, default=1.0)
            elif settings.DEMO_MODE:
                demo_step_wav = copernicus_service._generate_deterministic_demo_data(current_lat, current_lon, step_time)
                stokes_u = demo_step_wav["stokes_drift"]["vsdx"]
                stokes_v = demo_step_wav["stokes_drift"]["vsdy"]
                wave_h = demo_step_wav["wave"]["significant_wave_height_m"]

            latest_wave_height = wave_h

            # Deterministic Drift Equation:
            # U_net = current_u + stokes_u + windage_coeff * wind_u
            # V_net = current_v + stokes_v + windage_coeff * wind_v
            u_net = uo + stokes_u + (windage_coeff * wind_u)
            v_net = vo + stokes_v + (windage_coeff * wind_v)

            step_speed_mps, step_direction_deg, step_cardinal = uv_to_speed_and_direction(
                u_net, v_net, is_oceanographic=True
            )

            # Advance position along geodesic
            step_dist_km = (step_speed_mps * dt_step_seconds) / 1000.0
            next_lat, next_lon = forward_geodesic_point(
                current_lat, current_lon, step_dist_km, step_direction_deg
            )

            cumulative_dist_km += step_dist_km
            current_lat = next_lat
            current_lon = next_lon
            current_time = step_time

            # Uncertainty calculation
            step_hours = (step_time - release_utc).total_seconds() / 3600.0
            step_uncertainty_km, step_confidence, _ = uncertainty_engine.compute_uncertainty_and_search_area(
                release_lat=release_lat,
                release_lon=release_lon,
                predicted_lat=current_lat,
                predicted_lon=current_lon,
                displacement_km=cumulative_dist_km,
                drift_direction_deg=step_direction_deg,
                duration_hours=step_hours,
                wave_height_m=latest_wave_height,
                wind_speed_mps=latest_wind_speed,
                agreement_modifier=1.0,
                data_age_minutes=0
            )

            points.append(
                TrajectoryPointSchema(
                    step_number=step,
                    prediction_time_utc=current_time,
                    prediction_time_ist=to_ist(current_time).strftime("%d %b %Y, %I:%M %p"),
                    latitude=round(current_lat, 5),
                    longitude=round(current_lon, 5),
                    drift_speed_mps=round(step_speed_mps, 3),
                    drift_speed_kmh=round(mps_to_kmh(step_speed_mps), 1),
                    drift_direction_deg=round(step_direction_deg, 1),
                    drift_direction_cardinal=step_cardinal,
                    cumulative_distance_km=round(cumulative_dist_km, 2),
                    uncertainty_radius_km=step_uncertainty_km,
                    confidence=step_confidence,
                    environmental_summary={
                        "current_speed_mps": round(math.hypot(uo, vo), 3),
                        "wind_speed_kmh": round(mps_to_kmh(wind_spd), 1),
                        "wave_height_m": round(wave_h, 2),
                        "sea_state": classify_sea_state(wave_h)[0],
                    }
                )
            )

        # Overall search area & confidence from release to final predicted coordinate
        overall_bearing = calculate_bearing_degrees(release_lat, release_lon, current_lat, current_lon)
        final_uncertainty_km, final_confidence, search_area = uncertainty_engine.compute_uncertainty_and_search_area(
            release_lat=release_lat,
            release_lon=release_lon,
            predicted_lat=current_lat,
            predicted_lon=current_lon,
            displacement_km=cumulative_dist_km,
            drift_direction_deg=overall_bearing,
            duration_hours=total_duration_hours,
            wave_height_m=latest_wave_height,
            wind_speed_mps=latest_wind_speed,
            agreement_modifier=1.0,
            data_age_minutes=0
        )

        latest_point = points[-1]

        return TrajectoryResponse(
            net_id=net_id,
            net_name=net_name,
            net_type=net_type,
            release_time_utc=release_utc,
            expected_retrieval_time_utc=retrieval_utc,
            total_duration_hours=round(total_duration_hours, 2),
            points_count=len(points),
            points=points,
            latest_predicted_point=latest_point,
            search_area=search_area,
            model_version=self.model_version,
            data_sources=list(data_sources),
            forecast_updated_at=datetime.now(timezone.utc)
        )

drift_engine = DeterministicDriftEngine()
