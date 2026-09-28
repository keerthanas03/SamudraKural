import math
from typing import Dict, Any, Tuple
from app.schemas.prediction import SearchAreaSchema
from app.utils.direction import degrees_to_cardinal

class DriftUncertaintyEngine:
    """
    Multi-factor uncertainty and search-area estimation engine.
    Computes search zone radius (km) and transparent rule-based confidence (HIGH/MEDIUM/LOW).
    Does NOT claim statistical Gaussian calibration; transparently reflects model assumptions.
    """

    def compute_uncertainty_and_search_area(
        self,
        release_lat: float,
        release_lon: float,
        predicted_lat: float,
        predicted_lon: float,
        displacement_km: float,
        drift_direction_deg: float,
        duration_hours: float,
        wave_height_m: float,
        wind_speed_mps: float,
        agreement_modifier: float = 1.0,
        data_age_minutes: int = 0
    ) -> Tuple[float, str, SearchAreaSchema]:
        # 1. Base positional dispersion
        base_radius_km = 0.4
        
        # 2. Time-dependent accumulation (dispersion increases non-linearly with elapsed hours)
        time_growth_km = 0.18 * math.pow(max(0.1, duration_hours), 0.75) * max(1.0, displacement_km * 0.12)
        
        # 3. Wave roughness factor
        wave_factor = 1.0 + max(0.0, (wave_height_m - 1.0) * 0.22)
        
        # 4. Wind speed factor
        wind_factor = 1.0 + max(0.0, (wind_speed_mps - 5.0) * 0.04)
        
        # 5. Data age factor
        age_factor = 1.0 + (data_age_minutes / 720.0) * 0.25  # +25% if forecast is 12h old

        total_uncertainty_km = round(
            (base_radius_km + time_growth_km) * wave_factor * wind_factor * agreement_modifier * age_factor,
            2
        )
        total_uncertainty_km = max(0.5, min(15.0, total_uncertainty_km))

        # Determine transparent rule-based confidence
        confidence = "HIGH"
        if duration_hours > 14.0 or agreement_modifier >= 1.6 or wave_height_m > 2.5 or wind_speed_mps > 10.0:
            confidence = "LOW"
        elif duration_hours > 6.0 or agreement_modifier >= 1.25 or wave_height_m > 1.8 or wind_speed_mps > 7.5:
            confidence = "MEDIUM"

        # Search area range from release coordinate
        min_dist = max(0.0, round(displacement_km - total_uncertainty_km * 0.6, 1))
        max_dist = round(displacement_km + total_uncertainty_km * 0.8, 1)
        direction_cardinal = degrees_to_cardinal(drift_direction_deg).lower()

        sector_desc = f"{min_dist}–{max_dist} km {direction_cardinal}"

        search_area = SearchAreaSchema(
            center_latitude=round(predicted_lat, 5),
            center_longitude=round(predicted_lon, 5),
            uncertainty_radius_km=total_uncertainty_km,
            min_distance_from_release_km=min_dist,
            max_distance_from_release_km=max_dist,
            general_direction=direction_cardinal,
            sector_description=sector_desc,
            confidence=confidence,
            notes=(
                f"Estimated search area based on {duration_hours:.1f}h drift, "
                f"{wave_height_m:.1f}m waves, and ocean current forecast."
            )
        )

        return total_uncertainty_km, confidence, search_area

uncertainty_engine = DriftUncertaintyEngine()
