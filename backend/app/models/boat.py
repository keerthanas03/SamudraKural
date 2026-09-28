from sqlalchemy import Column, Integer, String, DateTime, ForeignKey, func
from sqlalchemy.orm import relationship
from app.db.base import Base

class Boat(Base):
    __tablename__ = "boats"

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    fisherman_id = Column(Integer, ForeignKey("fishermen.id", ondelete="CASCADE"), nullable=False, index=True)
    name = Column(String(255), nullable=False)
    registration_number = Column(String(100), nullable=False)
    boat_type = Column(String(100), nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False)

    fisherman = relationship("Fisherman", back_populates="boats")
    sos_alerts = relationship("SOSAlert", back_populates="boat")
