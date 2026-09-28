from typing import AsyncGenerator
import logging
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession, async_sessionmaker
from sqlalchemy.pool import NullPool
from app.core.config import settings

logger = logging.getLogger(__name__)

db_url = settings.database_url

# If in testing or explicit sqlite url provided, allow sqlite+aiosqlite
# In production (settings.ENVIRONMENT == "production"), enforce PostgreSQL connection
if settings.ENVIRONMENT == "production" and not db_url.startswith("postgresql"):
    raise RuntimeError("Production environment strictly requires PostgreSQL + PostGIS. SQLite fallback is disabled.")

engine = create_async_engine(
    db_url,
    echo=settings.DEBUG and settings.ENVIRONMENT == "development",
    pool_pre_ping=True,
    poolclass=NullPool,
)

AsyncSessionLocal = async_sessionmaker(
    bind=engine,
    class_=AsyncSession,
    expire_on_commit=False,
    autocommit=False,
    autoflush=False,
)

async def get_db() -> AsyncGenerator[AsyncSession, None]:
    async with AsyncSessionLocal() as session:
        try:
            yield session
        finally:
            await session.close()
