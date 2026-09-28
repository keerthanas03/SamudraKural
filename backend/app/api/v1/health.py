from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession
from app.db.session import get_db
from app.schemas.health import HealthCheckResponse, DBHealthResponse, PostGISHealthResponse

router = APIRouter()

@router.get("/health", response_model=HealthCheckResponse)
def get_health() -> HealthCheckResponse:
    return HealthCheckResponse(
        status="ok",
        service="samudra-kural-backend"
    )

@router.get("/health/db", response_model=DBHealthResponse)
async def get_db_health(db: AsyncSession = Depends(get_db)):
    try:
        result = await db.execute(text("SELECT 1"))
        val = result.scalar()
        if val == 1:
            return DBHealthResponse(
                status="ok",
                database="connected"
            )
        raise Exception("Database query returned unexpected result")
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail={
                "status": "error",
                "database": "unavailable",
                "message": str(e)
            }
        )

@router.get("/health/postgis", response_model=PostGISHealthResponse)
async def get_postgis_health(db: AsyncSession = Depends(get_db)):
    try:
        result = await db.execute(text("SELECT PostGIS_Version();"))
        version = result.scalar()
        if version:
            return PostGISHealthResponse(
                status="ok",
                postgis="available",
                version=str(version)
            )
        raise Exception("PostGIS_Version() returned empty result")
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail={
                "status": "error",
                "postgis": "unavailable",
                "message": str(e)
            }
        )
