from typing import Optional
from pydantic import BaseModel

class HealthCheckResponse(BaseModel):
    status: str = "ok"
    service: str = "samudra-kural-backend"

class DBHealthResponse(BaseModel):
    status: str
    database: str
    detail: Optional[str] = None

class PostGISHealthResponse(BaseModel):
    status: str
    postgis: str
    version: Optional[str] = None
    detail: Optional[str] = None
