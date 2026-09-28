from sqlalchemy import Column, Integer, String, Boolean, DateTime, func
from sqlalchemy.orm import relationship
from geoalchemy2 import Geography
from app.db.base import Base

class Fisherman(Base):
    __tablename__ = "fishermen"

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    name = Column(String(255), nullable=False)
    email = Column(String(255), unique=True, index=True, nullable=False)
    phone = Column(String(50), nullable=False)
    password_hash = Column(String(255), nullable=False)
    is_active = Column(Boolean, default=True, nullable=False)
    shore_location = Column(Geography(geometry_type='POINT', srid=4326, spatial_index=False), nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False)

    boats = relationship("Boat", back_populates="fisherman", cascade="all, delete-orphan")
    locations = relationship("FishingLocation", back_populates="fisherman", cascade="all, delete-orphan")
    current_location = relationship("UserCurrentLocation", back_populates="fisherman", uselist=False, cascade="all, delete-orphan")
    sos_alerts = relationship("SOSAlert", back_populates="fisherman", foreign_keys="SOSAlert.fisherman_id")
    sos_responses = relationship("SOSResponse", back_populates="responder_fisherman", cascade="all, delete-orphan")
