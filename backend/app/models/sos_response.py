from sqlalchemy import Column, Integer, String, Float, DateTime, ForeignKey, UniqueConstraint, func
from sqlalchemy.orm import relationship
from geoalchemy2 import Geography
from app.db.base import Base
from app.models.enums import SOSResponseType

class SOSResponse(Base):
    __tablename__ = "sos_responses"

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    sos_alert_id = Column(Integer, ForeignKey("sos_alerts.id", ondelete="CASCADE"), nullable=False, index=True)
    responder_fisherman_id = Column(Integer, ForeignKey("fishermen.id", ondelete="CASCADE"), nullable=False, index=True)
    
    response = Column(String(50), nullable=False, default=SOSResponseType.YES_HELP.value)  # YES_HELP or NO
    latitude = Column(Float, nullable=True)
    longitude = Column(Float, nullable=True)
    location = Column(Geography(geometry_type="POINT", srid=4326, spatial_index=False), nullable=True)
    
    distance_meters = Column(Float, nullable=True)
    eta_minutes = Column(Integer, nullable=True)
    message = Column(String(500), nullable=True)
    
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False)

    __table_args__ = (
        UniqueConstraint("sos_alert_id", "responder_fisherman_id", name="uq_sos_response_alert_responder"),
    )

    sos_alert = relationship("SOSAlert", back_populates="responses")
    responder_fisherman = relationship("Fisherman", back_populates="sos_responses")
