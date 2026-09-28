from sqlalchemy import Column, Integer, Float, Boolean, DateTime, ForeignKey, func
from sqlalchemy.orm import relationship
from geoalchemy2 import Geography
from app.db.base import Base

class UserCurrentLocation(Base):
    __tablename__ = "user_current_locations"

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    fisherman_id = Column(Integer, ForeignKey("fishermen.id", ondelete="CASCADE"), nullable=False, unique=True, index=True)
    
    latitude = Column(Float, nullable=False)
    longitude = Column(Float, nullable=False)
    location = Column(Geography(geometry_type="POINT", srid=4326, spatial_index=False), nullable=False)
    
    accuracy_meters = Column(Float, nullable=True, default=15.0)
    speed_mps = Column(Float, nullable=True, default=0.0)
    heading_degrees = Column(Float, nullable=True, default=0.0)
    battery_percent = Column(Integer, nullable=True, default=100)
    is_active = Column(Boolean, default=True, nullable=False)
    
    recorded_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False)

    fisherman = relationship("Fisherman", back_populates="current_location")
