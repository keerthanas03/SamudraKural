import uuid
from sqlalchemy import Column, Integer, String, Float, DateTime, ForeignKey, func
from sqlalchemy.orm import relationship
from geoalchemy2 import Geography
from app.db.base import Base
from app.models.enums import EmergencyType, SOSStatus, SOSDeliveryStatus, SOSPriority

class SOSAlert(Base):
    __tablename__ = "sos_alerts"

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    public_sos_id = Column(String(36), unique=True, index=True, default=lambda: str(uuid.uuid4()), nullable=False)
    
    fisherman_id = Column(Integer, ForeignKey("fishermen.id", ondelete="SET NULL"), nullable=True, index=True)
    boat_id = Column(Integer, ForeignKey("boats.id", ondelete="SET NULL"), nullable=True, index=True)
    
    emergency_type = Column(String(100), default=EmergencyType.GENERAL.value, nullable=False)
    priority = Column(String(50), default=SOSPriority.CRITICAL.value, nullable=False)
    status = Column(String(50), default=SOSStatus.ACTIVE.value, nullable=False)
    delivery_status = Column(String(50), default=SOSDeliveryStatus.ONLINE.value, nullable=False)
    
    latitude = Column(Float, nullable=False)
    longitude = Column(Float, nullable=False)
    location = Column(Geography(geometry_type="POINT", srid=4326, spatial_index=False), nullable=False)
    
    location_accuracy_meters = Column(Float, nullable=True, default=15.0)
    battery_percent = Column(Integer, nullable=True, default=100)
    description = Column(String(1000), nullable=True)
    people_affected = Column(Integer, default=1, nullable=False)
    
    relay_hops = Column(Integer, default=0, nullable=False)
    relayed_by_device_id = Column(String(255), nullable=True)
    
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False)
    last_known_location_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    acknowledged_at = Column(DateTime(timezone=True), nullable=True)
    resolved_at = Column(DateTime(timezone=True), nullable=True)
    cancelled_at = Column(DateTime(timezone=True), nullable=True)
    cancellation_reason = Column(String(500), nullable=True)

    fisherman = relationship("Fisherman", back_populates="sos_alerts", foreign_keys=[fisherman_id])
    boat = relationship("Boat", back_populates="sos_alerts", foreign_keys=[boat_id])
    responses = relationship("SOSResponse", back_populates="sos_alert", cascade="all, delete-orphan")
    rescue_mission = relationship("RescueMission", back_populates="sos_alert", uselist=False, cascade="all, delete-orphan")
