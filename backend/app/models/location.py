from sqlalchemy import Column, Integer, String, Text, DateTime, ForeignKey, func
from sqlalchemy.orm import relationship
from geoalchemy2 import Geography
from app.db.base import Base

class FishingLocation(Base):
    __tablename__ = "fishing_locations"

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    fisherman_id = Column(Integer, ForeignKey("fishermen.id", ondelete="CASCADE"), nullable=False, index=True)
    name = Column(String(255), nullable=False)
    location = Column(Geography(geometry_type='POINT', srid=4326, spatial_index=False), nullable=False)
    notes = Column(Text, nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False)

    fisherman = relationship("Fisherman", back_populates="locations")
