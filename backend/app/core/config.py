from typing import Optional, Dict
from pathlib import Path
import os
from pydantic_settings import BaseSettings, SettingsConfigDict

# Robust root directory resolution regardless of where Uvicorn/Python is invoked
PROJECT_ROOT = Path(__file__).resolve().parents[3]
BACKEND_ROOT = Path(__file__).resolve().parents[2]
ENV_FILE_PATH = BACKEND_ROOT / ".env" if (BACKEND_ROOT / ".env").exists() else (PROJECT_ROOT / ".env" if (PROJECT_ROOT / ".env").exists() else PROJECT_ROOT / ".env.example")

class Settings(BaseSettings):
    PROJECT_NAME: str = "Samudra Kural Backend"
    API_V1_STR: str = "/api/v1"
    ENVIRONMENT: str = "development"
    DEBUG: bool = True
    DEMO_MODE: bool = False  # When false, real Copernicus and INCOIS data is mandatory

    # Database Settings
    POSTGRES_SERVER: str = "localhost"
    POSTGRES_PORT: int = 5432
    POSTGRES_USER: str = "samudra"
    POSTGRES_PASSWORD: str = "samudra_dev_password"
    POSTGRES_DB: str = "samudra_kural"
    ASYNC_DATABASE_URL: Optional[str] = None

    # JWT Settings
    JWT_SECRET_KEY: str = "samudra_kural_dev_secret_key_change_in_production_32bytes"
    JWT_ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60 * 24  # 24 hours

    # Sarvam AI Voice API Credentials
    SARVAM_API_KEY: Optional[str] = os.getenv("SARVAM_API_KEY", "sk_bdef6i5n_IMCodc8v3cOjtIod6qhvNM1b")

    # ElevenLabs Voice API Credentials (Multilingual TTS & STT)
    ELEVENLABS_API_KEY: Optional[str] = os.getenv("ELEVENLABS_API_KEY", "")
    ELEVENLABS_VOICE_ID: Optional[str] = os.getenv("ELEVENLABS_VOICE_ID", "pNInz6obpgDQGcFmaJgB")  # Adam (Multilingual)

    # Generative AI LLM API Credentials (Google Gemini & OpenAI)
    GEMINI_API_KEY: Optional[str] = os.getenv("GEMINI_API_KEY", "")
    OPENAI_API_KEY: Optional[str] = os.getenv("OPENAI_API_KEY", "")

    # Copernicus Marine Toolbox Authentication & Datasets (loaded from root .env)
    COPERNICUSMARINE_SERVICE_USERNAME: Optional[str] = os.getenv("COPERNICUSMARINE_SERVICE_USERNAME", "Madhumitha")
    COPERNICUSMARINE_SERVICE_PASSWORD: Optional[str] = os.getenv("COPERNICUSMARINE_SERVICE_PASSWORD", "Vmadhu@1712")

    # Copernicus Products (Product IDs)
    COPERNICUS_PHY_PRODUCT_ID: str = "GLOBAL_ANALYSISFORECAST_PHY_001_024"
    COPERNICUS_WAV_PRODUCT_ID: str = "GLOBAL_ANALYSISFORECAST_WAV_001_027"

    # Copernicus Datasets (Dataset IDs)
    COPERNICUS_PHY_DATASET_ID: str = os.getenv("COPERNICUS_PHY_DATASET_ID", "cmems_mod_glo_phy_anfc_merged-uv_PT1H-i")
    COPERNICUS_WAV_DATASET_ID: str = "cmems_mod_glo_wav_anfc_0.083deg_PT3H-i"

    # INCOIS Operational Ocean State Forecast Services
    INCOIS_BASE_URL: str = "https://incois.gov.in"
    INCOIS_DATA_DIR: str = "data/incois"
    INCOIS_CACHE_TTL_MINUTES: int = 180

    # MOSDAC (ISRO - Space Applications Centre) Satellite Services
    MOSDAC_BASE_URL: str = os.getenv("MOSDAC_BASE_URL", "https://www.mosdac.gov.in")
    MOSDAC_API_KEY: Optional[str] = os.getenv("MOSDAC_API_KEY", "")
    MOSDAC_CACHE_TTL_MINUTES: int = 60

    # Application & Drift Engine Parameters
    LIVE_LOCATION_STALE_SECONDS: int = 120  # Live location considered stale after 120 seconds
    SOS_NEARBY_RADIUS_KM: float = 25.0      # Default nearby radius for SOS broadcasting
    OFFLINE_PACKET_MAX_HOPS: int = 5        # Maximum hops for offline P2P relay
    OFFLINE_PACKET_TTL_MINUTES: int = 60    # Offline SOS packet time-to-live
    ENVIRONMENT_CACHE_MINUTES: int = 30
    DEFAULT_PREDICTION_STEP_MINUTES: int = 30  # Default 30 min timestep
    GPS_ARRIVAL_RADIUS_METERS: float = 200.0   # 200 meters arrival threshold
    MAX_PREDICTION_HOURS: int = 48
    DRIFT_MODEL_VERSION: str = "v1.0.0-surface-leeway"

    # Leeway Windage Coefficients (Model Assumptions)
    WINDAGE_COEFFICIENTS: Dict[str, float] = {
        "FLOATING_GILL_NET": 0.028,
        "DRIFTING_NET": 0.020,
        "SURFACE_NET": 0.035,
        "OTHER_FLOATING_NET": 0.025,
    }

    @property
    def database_url(self) -> str:
        if self.ASYNC_DATABASE_URL:
            return self.ASYNC_DATABASE_URL
        return f"postgresql+asyncpg://{self.POSTGRES_USER}:{self.POSTGRES_PASSWORD}@{self.POSTGRES_SERVER}:{self.POSTGRES_PORT}/{self.POSTGRES_DB}"

    model_config = SettingsConfigDict(
        env_file=str(ENV_FILE_PATH),
        env_file_encoding="utf-8",
        case_sensitive=True,
        extra="ignore"
    )

settings = Settings()
