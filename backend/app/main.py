from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.core.config import settings
from app.api.v1.health import router as health_router
from app.api.v1.auth import router as auth_router
from app.api.v1.fishermen import router as fishermen_router
from app.api.v1.boats import router as boats_router
from app.api.v1.locations import router as locations_router
from app.api.v1.navigation import router as navigation_router
from app.api.v1.pfz import router as pfz_router
from app.api.v1.mosdac import router as mosdac_router
from app.api.v1.environment import router as environment_router
from app.api.v1.nets import router as nets_router
from app.api.v1.bot import router as bot_router
from app.api.v1.sos import router as sos_router
from app.api.v1.coastal_guard import router as coastal_guard_router
from app.api.v1.websockets import router as websockets_router

app = FastAPI(
    title=settings.PROJECT_NAME,
    openapi_url=f"{settings.API_V1_STR}/openapi.json",
    docs_url="/docs",
    redoc_url="/redoc",
)

# Enable CORS for React Native & Web clients
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Mount API v1 routers
app.include_router(health_router, prefix=settings.API_V1_STR)
app.include_router(auth_router, prefix=settings.API_V1_STR)
app.include_router(fishermen_router, prefix=settings.API_V1_STR)
app.include_router(boats_router, prefix=settings.API_V1_STR)
app.include_router(locations_router, prefix=settings.API_V1_STR)
app.include_router(navigation_router, prefix=settings.API_V1_STR)
app.include_router(pfz_router, prefix=settings.API_V1_STR)
app.include_router(mosdac_router, prefix=settings.API_V1_STR)
app.include_router(environment_router, prefix=settings.API_V1_STR)
app.include_router(nets_router, prefix=settings.API_V1_STR)
app.include_router(bot_router, prefix=settings.API_V1_STR)
app.include_router(sos_router, prefix=settings.API_V1_STR)
app.include_router(coastal_guard_router, prefix=settings.API_V1_STR)
app.include_router(websockets_router, prefix=settings.API_V1_STR)
app.include_router(websockets_router)

# Also mount under /api for direct access as requested in specification
app.include_router(mosdac_router, prefix="/api")
app.include_router(environment_router, prefix="/api")
app.include_router(nets_router, prefix="/api")
app.include_router(bot_router, prefix="/api")
app.include_router(sos_router, prefix="/api")
app.include_router(coastal_guard_router, prefix="/api")

@app.get("/")
def root():
    return {
        "message": "Welcome to Samudra Kural API",
        "docs": "/docs",
        "model_version": settings.DRIFT_MODEL_VERSION,
        "demo_mode": settings.DEMO_MODE
    }
