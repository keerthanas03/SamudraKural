from datetime import datetime
from sqlalchemy import Column, Integer, String, Float, DateTime, JSON, func
from app.db.base import Base

class EnvironmentalCache(Base):
    __tablename__ = "environmental_cache"

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    latitude = Column(Float, nullable=False, index=True)
    longitude = Column(Float, nullable=False, index=True)
    time = Column(DateTime(timezone=True), nullable=False, index=True)
    source = Column(String(50), nullable=False)  # COPERNICUS, INCOIS
    
    variable_data = Column(JSON, nullable=False)
    retrieved_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    expires_at = Column(DateTime(timezone=True), nullable=False)
