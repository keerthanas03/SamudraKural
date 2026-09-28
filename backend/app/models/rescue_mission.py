from sqlalchemy import Column, Integer, String, DateTime, ForeignKey, func
from sqlalchemy.orm import relationship
from app.db.base import Base
from app.models.enums import RescueMissionStatus

class RescueMission(Base):
    __tablename__ = "rescue_missions"

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    sos_alert_id = Column(Integer, ForeignKey("sos_alerts.id", ondelete="CASCADE"), nullable=False, unique=True, index=True)
    
    assigned_officer_id = Column(Integer, nullable=True)
    officer_name = Column(String(255), default="Officer Command HQ", nullable=False)
    rescue_team = Column(String(255), nullable=False)   # e.g., ICG Tactical Squadron 04
    rescue_vessel = Column(String(255), nullable=False) # e.g., ICGS C-438 Fast Patrol Vessel
    
    status = Column(String(50), default=RescueMissionStatus.ASSIGNED.value, nullable=False)
    eta_minutes = Column(Integer, default=25, nullable=False)
    notes = Column(String(2000), nullable=True)
    
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False)
    started_at = Column(DateTime(timezone=True), nullable=True)
    completed_at = Column(DateTime(timezone=True), nullable=True)

    sos_alert = relationship("SOSAlert", back_populates="rescue_mission")
