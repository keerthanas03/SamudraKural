import logging
import math
from datetime import datetime, timezone, timedelta
from typing import Dict, Any, Optional, Tuple
import numpy as np
from app.core.config import settings
from app.utils.direction import uv_to_speed_and_direction
from app.utils.time import ensure_utc, calculate_age_minutes

logger = logging.getLogger(__name__)

class CopernicusMarineService:
    """
    Official Copernicus Marine Service Client.
    Connects to Copernicus Marine Toolbox, queries specific Dataset IDs within Product IDs,
    constructs spatial/temporal subsets, and interpolates surface physics and wave fields.
    """

    def __init__(self):
        self.username = settings.COPERNICUSMARINE_SERVICE_USERNAME
        self.password = settings.COPERNICUSMARINE_SERVICE_PASSWORD
        self.phy_product_id = settings.COPERNICUS_PHY_PRODUCT_ID
        self.wav_product_id = settings.COPERNICUS_WAV_PRODUCT_ID
        self.phy_dataset_id = settings.COPERNICUS_PHY_DATASET_ID
        self.wav_dataset_id = settings.COPERNICUS_WAV_DATASET_ID
        self._authenticated = False

    def ensure_authenticated(self) -> bool:
        if self._authenticated:
            return True
        if not self.username or not self.password:
            logger.warning("Copernicus Marine credentials missing in environment.")
            return False
        try:
            import copernicusmarine
            copernicusmarine.login(
                username=self.username,
                password=self.password,
                force_overwrite=True
            )
            self._authenticated = True
            logger.info("Copernicus Marine authentication successful for user %s", self.username)
            return True
        except Exception as e:
            logger.error("Copernicus Marine login error: %s", e)
            return False

    def validate_datasets(self) -> Dict[str, Any]:
        """
        Validation step to verify product and dataset IDs in the Copernicus catalogue.
        """
        self.ensure_authenticated()
        import copernicusmarine

        results = {
            "physics_product": {"product_id": self.phy_product_id, "dataset_id": self.phy_dataset_id, "status": "UNKNOWN"},
            "wave_product": {"product_id": self.wav_product_id, "dataset_id": self.wav_dataset_id, "status": "UNKNOWN"}
        }

        try:
            phy_desc = copernicusmarine.describe(dataset_id=self.phy_dataset_id)
            results["physics_product"]["status"] = "ACCESSIBLE"
        except Exception as e:
            results["physics_product"]["status"] = f"ERROR: {str(e)}"

        try:
            wav_desc = copernicusmarine.describe(dataset_id=self.wav_dataset_id)
            results["wave_product"]["status"] = "ACCESSIBLE"
        except Exception as e:
            results["wave_product"]["status"] = f"ERROR: {str(e)}"

        return results
        
    def validate_configuration(self) -> Dict[str, Any]:
        """Alias for validate_datasets."""
        return self.validate_datasets()

    def fetch_spatial_subset(
        self,
        min_lat: float,
        max_lat: float,
        min_lon: float,
        max_lon: float,
        start_time: datetime,
        end_time: datetime
    ) -> Tuple[Optional[Any], Optional[Any]]:
        """
        Construct and open a spatial & temporal bounding box subset once for trajectory simulation.
        """
        self.ensure_authenticated()
        import copernicusmarine

        start_str = ensure_utc(start_time).strftime("%Y-%m-%dT%H:%M:%SZ")
        end_str = ensure_utc(end_time).strftime("%Y-%m-%dT%H:%M:%SZ")

        logger.info(
            "Fetching Copernicus Marine subset: [%s to %s N, %s to %s E] from %s to %s",
            min_lat, max_lat, min_lon, max_lon, start_str, end_str
        )

        phy_ds = None
        wav_ds = None

        try:
            phy_ds = copernicusmarine.open_dataset(
                dataset_id=self.phy_dataset_id,
                variables=["uo", "vo"],
                minimum_latitude=min_lat,
                maximum_latitude=max_lat,
                minimum_longitude=min_lon,
                maximum_longitude=max_lon,
                start_datetime=start_str,
                end_datetime=end_str,
            )
        except Exception as e:
            logger.error("Error opening Copernicus physics dataset %s: %s", self.phy_dataset_id, e)
            if not settings.DEMO_MODE:
                raise RuntimeError(f"Copernicus Physics dataset query failed: {str(e)}")

        try:
            wav_ds = copernicusmarine.open_dataset(
                dataset_id=self.wav_dataset_id,
                variables=["VHM0", "VMDR", "VTPK", "VSDX", "VSDY"],
                minimum_latitude=min_lat,
                maximum_latitude=max_lat,
                minimum_longitude=min_lon,
                maximum_longitude=max_lon,
                start_datetime=start_str,
                end_datetime=end_str,
            )
        except Exception as e:
            logger.warning("Error opening Copernicus wave dataset %s: %s", self.wav_dataset_id, e)
            if not settings.DEMO_MODE and phy_ds is None:
                raise RuntimeError(f"Copernicus Wave dataset query failed: {str(e)}")

        return phy_ds, wav_ds

    def fetch_point_environment(
        self,
        latitude: float,
        longitude: float,
        target_time: datetime
    ) -> Dict[str, Any]:
        """
        Fetch point environmental state with live variable discovery and validation.
        """
        target_time_utc = ensure_utc(target_time)

        # In DEMO_MODE without credentials, only provide simulated values for UI dev
        if settings.DEMO_MODE and not (self.username and self.password):
            return self._generate_deterministic_demo_data(latitude, longitude, target_time_utc)

        self.ensure_authenticated()

        try:
            import copernicusmarine
            
            # Construct localized subset window around the coordinate
            min_lat = latitude - 0.25
            max_lat = latitude + 0.25
            min_lon = longitude - 0.25
            max_lon = longitude + 0.25
            start_time = target_time_utc - timedelta(hours=12)
            end_time = target_time_utc + timedelta(hours=12)

            phy_ds, wav_ds = self.fetch_spatial_subset(
                min_lat, max_lat, min_lon, max_lon, start_time, end_time
            )

            if phy_ds is None:
                raise RuntimeError("Physics dataset returned None")

            # Surface selection: Select top depth level if vertical dimension exists
            if 'depth' in phy_ds.dims or 'depth' in phy_ds.coords:
                surface_phy = phy_ds.isel(depth=0)
            else:
                surface_phy = phy_ds

            # Point selection from remote dataset: select nearest spatial & temporal grid point
            try:
                point_phy = surface_phy.sel(
                    latitude=latitude,
                    longitude=longitude,
                    time=np.datetime64(target_time_utc.replace(tzinfo=None)),
                    method="nearest"
                )
            except Exception:
                point_phy = surface_phy.interp(
                    latitude=latitude,
                    longitude=longitude,
                    time=np.datetime64(target_time_utc.replace(tzinfo=None)),
                    method="linear"
                )

            # Validate variable names
            uo_var = "uo" if "uo" in surface_phy.data_vars else [v for v in surface_phy.data_vars if "uo" in str(v).lower()][0]
            vo_var = "vo" if "vo" in surface_phy.data_vars else [v for v in surface_phy.data_vars if "vo" in str(v).lower()][0]

            uo = float(np.asarray(point_phy[uo_var].values).squeeze())
            vo = float(np.asarray(point_phy[vo_var].values).squeeze())

            # Extract Wave & Stokes drift
            stokes_u = 0.0
            stokes_v = 0.0
            wave_height = 1.0
            wave_period = 6.0
            wave_direction = 90.0

            if wav_ds is not None:
                try:
                    point_wav = wav_ds.sel(
                        latitude=latitude,
                        longitude=longitude,
                        time=np.datetime64(target_time_utc.replace(tzinfo=None)),
                        method="nearest"
                    )
                except Exception:
                    point_wav = wav_ds.interp(
                        latitude=latitude,
                        longitude=longitude,
                        time=np.datetime64(target_time_utc.replace(tzinfo=None)),
                        method="linear"
                    )
                if "VSDX" in wav_ds.data_vars:
                    stokes_u = float(np.asarray(point_wav["VSDX"].values).squeeze())
                if "VSDY" in wav_ds.data_vars:
                    stokes_v = float(np.asarray(point_wav["VSDY"].values).squeeze())
                if "VHM0" in wav_ds.data_vars:
                    wave_height = float(np.asarray(point_wav["VHM0"].values).squeeze())
                if "VTPK" in wav_ds.data_vars:
                    wave_period = float(np.asarray(point_wav["VTPK"].values).squeeze())
                if "VMDR" in wav_ds.data_vars:
                    wave_direction = float(np.asarray(point_wav["VMDR"].values).squeeze())

            current_speed, current_dir, current_cardinal = uv_to_speed_and_direction(uo, vo, is_oceanographic=True)
            stokes_speed, stokes_dir, _ = uv_to_speed_and_direction(stokes_u, stokes_v, is_oceanographic=True)

            return {
                "status": "available",
                "product_id": self.phy_product_id,
                "dataset_id": self.phy_dataset_id,
                "wave_product_id": self.wav_product_id,
                "wave_dataset_id": self.wav_dataset_id,
                "timestamp": target_time_utc.isoformat(),
                "data_age_minutes": calculate_age_minutes(target_time_utc),
                "current": {
                    "uo": round(uo, 4),
                    "vo": round(vo, 4),
                    "speed_mps": round(current_speed, 3),
                    "direction_deg": round(current_dir, 1),
                    "cardinal": current_cardinal,
                },
                "stokes_drift": {
                    "vsdx": round(stokes_u, 4),
                    "vsdy": round(stokes_v, 4),
                    "speed_mps": round(stokes_speed, 3),
                    "direction_deg": round(stokes_dir, 1),
                },
                "wave": {
                    "significant_wave_height_m": round(wave_height, 2),
                    "wave_period_s": round(wave_period, 1),
                    "wave_direction_deg": round(wave_direction, 1),
                },
                "units": {
                    "uo": "m/s",
                    "vo": "m/s",
                    "speed": "m/s",
                    "direction": "degrees",
                    "wave_height": "m",
                    "stokes_drift": "m/s"
                }
            }

        except Exception as e:
            logger.error("Copernicus Marine live retrieval error: %s", e)
            if settings.DEMO_MODE:
                return self._generate_deterministic_demo_data(latitude, longitude, target_time_utc)
            
            return {
                "status": "unavailable",
                "product_id": self.phy_product_id,
                "dataset_id": self.phy_dataset_id,
                "timestamp": target_time_utc.isoformat(),
                "error": f"Copernicus Marine operational retrieval error: {str(e)}",
                "current": {},
                "stokes_drift": {},
                "wave": {},
                "units": {}
            }

    def _generate_deterministic_demo_data(
        self,
        latitude: float,
        longitude: float,
        target_time: datetime
    ) -> Dict[str, Any]:
        """
        Deterministic simulated values only when DEMO_MODE=true.
        """
        hour_frac = target_time.hour + target_time.minute / 60.0
        phase = (latitude * 1.5 + longitude * 0.8 + hour_frac * 0.2) % (2.0 * math.pi)
        
        current_speed = 0.32 + 0.12 * math.sin(phase)
        current_dir = (45.0 + 20.0 * math.cos(phase) + 360.0) % 360.0
        
        rad = math.radians(current_dir)
        uo = current_speed * math.sin(rad)
        vo = current_speed * math.cos(rad)

        stokes_speed = current_speed * 0.14
        stokes_u = stokes_speed * math.sin(rad + 0.1)
        stokes_v = stokes_speed * math.cos(rad + 0.1)

        wave_height = 1.1 + 0.3 * math.sin(phase * 1.2)
        wave_period = 6.2 + 0.8 * math.cos(phase)
        wave_dir = (current_dir + 15.0) % 360.0

        current_speed, current_dir, current_cardinal = uv_to_speed_and_direction(uo, vo, is_oceanographic=True)
        stokes_speed, stokes_dir, _ = uv_to_speed_and_direction(stokes_u, stokes_v, is_oceanographic=True)

        return {
            "status": "available (demo)",
            "product_id": self.phy_product_id,
            "dataset_id": self.phy_dataset_id,
            "wave_product_id": self.wav_product_id,
            "wave_dataset_id": self.wav_dataset_id,
            "timestamp": target_time.isoformat(),
            "data_age_minutes": calculate_age_minutes(target_time),
            "current": {
                "uo": round(uo, 4),
                "vo": round(vo, 4),
                "speed_mps": round(current_speed, 3),
                "direction_deg": round(current_dir, 1),
                "cardinal": current_cardinal,
            },
            "stokes_drift": {
                "vsdx": round(stokes_u, 4),
                "vsdy": round(stokes_v, 4),
                "speed_mps": round(stokes_speed, 3),
                "direction_deg": round(stokes_dir, 1),
            },
            "wave": {
                "significant_wave_height_m": round(wave_height, 2),
                "wave_period_s": round(wave_period, 1),
                "wave_direction_deg": round(wave_dir, 1),
            },
            "units": {
                "uo": "m/s",
                "vo": "m/s",
                "speed": "m/s",
                "direction": "degrees",
                "wave_height": "m",
                "stokes_drift": "m/s"
            }
        }

copernicus_service = CopernicusMarineService()
