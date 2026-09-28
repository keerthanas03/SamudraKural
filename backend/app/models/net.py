from datetime import datetime
from typing import List, Optional
from sqlalchemy import Column, Integer, String, Float, DateTime, ForeignKey, Text, JSON, func
from sqlalchemy.orm import relationship
from app.db.base import Base

class Net(Base):
    __tablename__ = "nets"

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    user_id = Column(Integer, ForeignKey("fishermen.id", ondelete="CASCADE"), nullable=False, index=True)
    name = Column(String(255), nullable=False)
    net_type = Column(String(100), nullable=False, default="FLOATING_GILL_NET")
    
    release_latitude = Column(Float, nullable=False)
    release_longitude = Column(Float, nullable=False)
    release_time = Column(DateTime(timezone=True), nullable=False)
    expected_retrieval_time = Column(DateTime(timezone=True), nullable=False)
    
    status = Column(String(50), nullable=False, default="ACTIVE")  # ACTIVE, RETRIEVED, LOST, ARCHIVED
    notes = Column(Text, nullable=True)
    
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False)

    # Relationships
    predictions = relationship("NetPrediction", back_populates="net", cascade="all, delete-orphan", order_by="NetPrediction.prediction_time")
    prediction_runs = relationship("PredictionRun", back_populates="net", cascade="all, delete-orphan", order_by="desc(PredictionRun.started_at)")


class NetPrediction(Base):
    __tablename__ = "net_predictions"

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    net_id = Column(Integer, ForeignKey("nets.id", ondelete="CASCADE"), nullable=False, index=True)
    
    prediction_time = Column(DateTime(timezone=True), nullable=False)  # Timestep point in UTC
    latitude = Column(Float, nullable=False)
    longitude = Column(Float, nullable=False)
    
    uncertainty_radius_km = Column(Float, nullable=False, default=1.0)
    drift_speed_mps = Column(Float, nullable=False, default=0.0)
    drift_direction = Column(Float, nullable=False, default=0.0)       # Degrees (0-360)
    confidence = Column(String(20), nullable=False, default="MEDIUM")  # HIGH, MEDIUM, LOW
    
    step_number = Column(Integer, nullable=False, default=0)
    environmental_snapshot = Column(JSON, nullable=True)               # Current, wind, wave conditions at step
    
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)

    net = relationship("Net", back_populates="predictions")


class PredictionRun(Base):
    __tablename__ = "prediction_runs"

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    net_id = Column(Integer, ForeignKey("nets.id", ondelete="CASCADE"), nullable=False, index=True)
    
    started_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    completed_at = Column(DateTime(timezone=True), nullable=True)
    
    model_version = Column(String(100), nullable=False)
    data_sources = Column(JSON, nullable=False)  # e.g., ["COPERNICUS", "INCOIS"]
    status = Column(String(50), nullable=False, default="PENDING")  # PENDING, SUCCESS, FAILED
    error_message = Column(Text, nullable=True)

    net = relationship("Net", back_populates="prediction_runs")
