import pytest_asyncio
import asyncio
from httpx import AsyncClient, ASGITransport
from sqlalchemy import text
from app.main import app
from app.db.session import engine

_DB_AVAILABLE = None

async def check_db_available():
    global _DB_AVAILABLE
    if _DB_AVAILABLE is not None:
        return _DB_AVAILABLE
    try:
        # 1-second connection probe
        async with asyncio.timeout(1.0):
            async with engine.begin() as conn:
                await conn.execute(text("SELECT 1;"))
        _DB_AVAILABLE = True
    except Exception:
        _DB_AVAILABLE = False
    return _DB_AVAILABLE

@pytest_asyncio.fixture
async def client():
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        yield ac

@pytest_asyncio.fixture(autouse=True)
async def cleanup_database():
    is_avail = await check_db_available()
    if is_avail:
        try:
            async with engine.begin() as conn:
                await conn.execute(text("DELETE FROM rescue_missions;"))
                await conn.execute(text("DELETE FROM sos_responses;"))
                await conn.execute(text("DELETE FROM sos_alerts;"))
                await conn.execute(text("DELETE FROM user_current_locations;"))
                await conn.execute(text("DELETE FROM net_predictions;"))
                await conn.execute(text("DELETE FROM prediction_runs;"))
                await conn.execute(text("DELETE FROM nets;"))
                await conn.execute(text("DELETE FROM fishing_locations;"))
                await conn.execute(text("DELETE FROM boats;"))
                await conn.execute(text("DELETE FROM fishermen;"))
        except Exception:
            pass
    yield
    if is_avail:
        try:
            async with engine.begin() as conn:
                await conn.execute(text("DELETE FROM rescue_missions;"))
                await conn.execute(text("DELETE FROM sos_responses;"))
                await conn.execute(text("DELETE FROM sos_alerts;"))
                await conn.execute(text("DELETE FROM user_current_locations;"))
                await conn.execute(text("DELETE FROM net_predictions;"))
                await conn.execute(text("DELETE FROM prediction_runs;"))
                await conn.execute(text("DELETE FROM nets;"))
                await conn.execute(text("DELETE FROM fishing_locations;"))
                await conn.execute(text("DELETE FROM boats;"))
                await conn.execute(text("DELETE FROM fishermen;"))
        except Exception:
            pass
