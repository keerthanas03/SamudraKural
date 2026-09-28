import logging
from datetime import datetime, timezone
from typing import Dict, Any, Optional, Tuple
from app.core.config import settings
from app.services.copernicus_service import copernicus_service
from app.services.incois_service import incois_service
from app.services.validation_service import validation_service
from app.schemas.environment import (
    EnvironmentalState,
    EnvironmentTestResponse,
    ProviderStatus,
    AgreementComparison
)
from app.utils.direction import uv_to_speed_and_direction
from app.utils.units import mps_to_kmh, classify_sea_state
from app.utils.time import ensure_utc, calculate_age_minutes

logger = logging.getLogger(__name__)

# In-memory spatial-temporal cache for environmental requests to reduce remote calls
_ENV_CACHE: Dict[str, Tuple[datetime, EnvironmentalState, Dict[str, Any]]] = {}

class UnifiedEnvironmentService:
    """
    Unified Environmental Aggregator & Normalization Service.
    Coordinates Copernicus Marine and INCOIS data retrieval, performs cross-validation,
    normalizes into EnvironmentalState, and caches results.
    """

    def get_cache_key(self, lat: float, lon: float, dt: datetime) -> str:
        # Snap lat/lon to ~0.05 degree grid (approx 5 km) and hourly bucket
        grid_lat = round(lat * 20) / 20
        grid_lon = round(lon * 20) / 20
        time_str = dt.strftime("%Y-%m-%d-%H")
        return f"{grid_lat}_{grid_lon}_{time_str}"

    async def get_normalized_environment(
        self,
        latitude: float,
        longitude: float,
        target_time: Optional[datetime] = None
    ) -> Tuple[EnvironmentalState, EnvironmentTestResponse]:
        target_time_utc = ensure_utc(target_time)
        cache_key = self.get_cache_key(latitude, longitude, target_time_utc)

        # Check memory cache
        if cache_key in _ENV_CACHE:
            cached_time, cached_state, cached_raw = _ENV_CACHE[cache_key]
            # If cached within TTL
            if (datetime.now(timezone.utc) - cached_time).total_seconds() < settings.INCOIS_CACHE_TTL_MINUTES * 60:
                logger.info("Serving environmental state from local cache for key %s", cache_key)
                return cached_state, self._build_test_response(
                    latitude, longitude, target_time_utc, cached_raw["cop"], cached_raw["inc"], cached_raw["cmp"], cached_state
                )

        # Retrieve from Copernicus Marine
        cop_data = copernicus_service.fetch_point_environment(latitude, longitude, target_time_utc)

        # Retrieve from INCOIS
        inc_data = incois_service.fetch_point_environment(latitude, longitude, target_time_utc)

        # Cross-validate
        comparison = validation_service.compare_providers(cop_data, inc_data)

        # Primary Ocean Current: Copernicus Marine physics
        cop_curr = cop_data.get("current", {})
        uo = cop_curr.get("uo", 0.0)
        vo = cop_curr.get("vo", 0.0)
        
        # Primary Wind: INCOIS coastal & maritime forecast
        inc_wind = inc_data.get("wind", {})
        wind_u = inc_wind.get("u", 0.0)
        wind_v = inc_wind.get("v", 0.0)
        wind_spd = inc_wind.get("speed_mps", 0.0)
        wind_dir = inc_wind.get("direction_deg", 0.0)
        wind_card = inc_wind.get("cardinal", "Calm")

        # Waves & Stokes Drift: Copernicus Marine wave product
        cop_stokes = cop_data.get("stokes_drift", {})
        stokes_u = cop_stokes.get("vsdx", 0.0)
        stokes_v = cop_stokes.get("vsdy", 0.0)
        
        cop_wave = cop_data.get("wave", {})
        wave_height = cop_wave.get("significant_wave_height_m", 1.0)
        wave_dir = cop_wave.get("wave_direction_deg", 90.0)
        wave_period = cop_wave.get("wave_period_s", 6.0)
        sea_state_name, _ = classify_sea_state(wave_height)

        # INCOIS Swell
        inc_wave = inc_data.get("wave", {})
        swell_height = inc_wave.get("swell_height_m")
        swell_period = inc_wave.get("swell_period_s")

        curr_speed, curr_dir, curr_card = uv_to_speed_and_direction(uo, vo, is_oceanographic=True)
        stokes_speed, stokes_dir, _ = uv_to_speed_and_direction(stokes_u, stokes_v, is_oceanographic=True)

        data_sources = []
        if cop_data.get("status", "").startswith("available"):
            data_sources.append("COPERNICUS_MARINE")
        if inc_data.get("status", "").startswith("available"):
            data_sources.append("INCOIS_OSF")

        state = EnvironmentalState(
            timestamp_utc=target_time_utc,
            latitude=latitude,
            longitude=longitude,
            current_u=uo,
            current_v=vo,
            current_speed_mps=round(curr_speed, 3),
            current_direction_deg=round(curr_dir, 1),
            current_direction_cardinal=curr_card,
            wind_u=wind_u,
            wind_v=wind_v,
            wind_speed_mps=round(wind_spd, 2),
            wind_speed_kmh=round(mps_to_kmh(wind_spd), 1),
            wind_direction_deg=round(wind_dir, 1),
            wind_direction_cardinal=wind_card,
            wave_height=round(wave_height, 2),
            wave_direction=round(wave_dir, 1),
            wave_period=round(wave_period, 1),
            sea_state=sea_state_name,
            stokes_u=stokes_u,
            stokes_v=stokes_v,
            stokes_speed_mps=round(stokes_speed, 3),
            stokes_direction_deg=round(stokes_dir, 1),
            swell_height=swell_height,
            swell_period=swell_period,
            incois_current_speed=inc_data.get("current", {}).get("speed_mps"),
            incois_current_direction=inc_data.get("current", {}).get("direction_deg"),
            incois_wave_height=inc_data.get("wave", {}).get("significant_wave_height_m"),
            incois_wave_direction=inc_data.get("wave", {}).get("wave_direction_deg"),
            incois_wind_speed=inc_data.get("wind", {}).get("speed_mps"),
            incois_wind_direction=inc_data.get("wind", {}).get("direction_deg"),
            data_sources=data_sources,
            data_timestamp=target_time_utc,
            retrieved_at=datetime.now(timezone.utc),
            data_age_minutes=calculate_age_minutes(target_time_utc),
            availability_status="available" if data_sources else "unavailable",
            forecast_status="forecast"
        )

        test_resp = self._build_test_response(
            latitude, longitude, target_time_utc, cop_data, inc_data, comparison, state
        )

        # Store in memory cache
        _ENV_CACHE[cache_key] = (
            datetime.now(timezone.utc),
            state,
            {"cop": cop_data, "inc": inc_data, "cmp": comparison}
        )

        return state, test_resp

    def _build_test_response(
        self,
        latitude: float,
        longitude: float,
        target_time: datetime,
        cop_data: Dict[str, Any],
        inc_data: Dict[str, Any],
        comparison: AgreementComparison,
        normalized_state: Optional[EnvironmentalState]
    ) -> EnvironmentTestResponse:
        incois_status = ProviderStatus(
            status=inc_data.get("status", "unknown"),
            dataset_id=inc_data.get("source_file", "INCOIS-OSF-Operational"),
            timestamp=inc_data.get("timestamp"),
            data_age_minutes=inc_data.get("data_age_minutes", 0),
            current=inc_data.get("current", {}),
            wind=inc_data.get("wind", {}),
            wave=inc_data.get("wave", {}),
            units=inc_data.get("units", {})
        )

        copernicus_status = ProviderStatus(
            status=cop_data.get("status", "unknown"),
            dataset_id=cop_data.get("dataset_id"),
            timestamp=cop_data.get("timestamp"),
            data_age_minutes=cop_data.get("data_age_minutes", 0),
            current=cop_data.get("current", {}),
            stokes_drift=cop_data.get("stokes_drift", {}),
            wave=cop_data.get("wave", {}),
            units=cop_data.get("units", {}),
            error=cop_data.get("error")
        )

        return EnvironmentTestResponse(
            location={"latitude": latitude, "longitude": longitude},
            timestamp=target_time.isoformat(),
            demo_mode=settings.DEMO_MODE,
            incois=incois_status,
            copernicus=copernicus_status,
            comparison=comparison,
            normalized_state=normalized_state
        )

environment_service = UnifiedEnvironmentService()
