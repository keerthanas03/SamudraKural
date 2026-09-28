import logging
import math
from typing import Dict, Any, Tuple
from app.utils.direction import angular_difference_degrees
from app.schemas.environment import AgreementComparison

logger = logging.getLogger(__name__)

class EnvironmentalValidationService:
    """
    Cross-validation service for Indian EEZ waters comparing:
    - Copernicus Marine (physics-enrichment source)
    - INCOIS (India-specific operational ocean state reference)
    
    IMPORTANT:
    Does NOT average Copernicus and INCOIS vectors.
    Uses model disagreement to adjust prediction uncertainty and confidence levels.
    """

    def compare_providers(
        self,
        copernicus_data: Dict[str, Any],
        incois_data: Dict[str, Any]
    ) -> AgreementComparison:
        cop_curr = copernicus_data.get("current", {})
        inc_curr = incois_data.get("current", {})
        cop_wav = copernicus_data.get("wave", {})
        inc_wav = incois_data.get("wave", {})

        # Speed and direction difference
        cop_speed = cop_curr.get("speed_mps")
        inc_speed = inc_curr.get("speed_mps")
        cop_dir = cop_curr.get("direction_deg")
        inc_dir = inc_curr.get("direction_deg")

        cop_wh = cop_wav.get("significant_wave_height_m")
        inc_wh = inc_wav.get("significant_wave_height_m")

        speed_diff = None
        dir_diff = None
        current_agreement = "HIGH"

        if cop_speed is not None and inc_speed is not None:
            speed_diff = round(abs(cop_speed - inc_speed), 3)

        if cop_dir is not None and inc_dir is not None:
            dir_diff = round(angular_difference_degrees(cop_dir, inc_dir), 1)

        if speed_diff is not None and dir_diff is not None:
            if speed_diff <= 0.15 and dir_diff <= 35.0:
                current_agreement = "HIGH"
            elif speed_diff <= 0.35 and dir_diff <= 70.0:
                current_agreement = "MEDIUM"
            else:
                current_agreement = "LOW"

        # Wave agreement
        wave_diff = None
        wave_agreement = "HIGH"
        if cop_wh is not None and inc_wh is not None:
            wave_diff = round(abs(cop_wh - inc_wh), 2)
            if wave_diff <= 0.35:
                wave_agreement = "HIGH"
            elif wave_diff <= 0.85:
                wave_agreement = "MEDIUM"
            else:
                wave_agreement = "LOW"

        # Uncertainty modifier based on agreement
        modifier = 1.0
        if current_agreement == "MEDIUM" or wave_agreement == "MEDIUM":
            modifier = 1.3
        if current_agreement == "LOW" or wave_agreement == "LOW":
            modifier = 1.8

        notes_parts = []
        if speed_diff is not None and dir_diff is not None:
            notes_parts.append(f"Current difference: {speed_diff} m/s, {dir_diff}°")
        if wave_diff is not None:
            notes_parts.append(f"Wave height difference: {wave_diff} m")

        notes = "; ".join(notes_parts) if notes_parts else "Single provider verification."

        return AgreementComparison(
            current_agreement=current_agreement,
            current_speed_difference_mps=speed_diff,
            current_direction_difference_deg=dir_diff,
            wave_agreement=wave_agreement,
            wave_height_difference_m=wave_diff,
            overall_confidence_modifier=modifier,
            notes=notes
        )

validation_service = EnvironmentalValidationService()
