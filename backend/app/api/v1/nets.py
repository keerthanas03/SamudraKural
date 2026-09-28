import math
from datetime import datetime, timezone
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, desc
from sqlalchemy.orm import selectinload
from app.db.session import get_db
from app.api.deps import get_current_fisherman, reusable_oauth2
from app.models.fisherman import Fisherman
from app.models.net import Net, NetPrediction, PredictionRun
from app.schemas.net import (
    NetCreate, NetUpdate, NetSummaryResponse, NetDetailResponse, NetSimulationRequest
)
from app.schemas.prediction import TrajectoryResponse
from app.schemas.environment import EnvironmentalState
from app.services.drift_engine import drift_engine
from app.services.environment_service import environment_service
from app.utils.time import ensure_utc, to_ist, calculate_age_minutes
from app.utils.geo import haversine_distance_km
from datetime import timedelta

router = APIRouter(tags=["Nets"])

NET_TYPE_NAMES = {
    "FLOATING_GILL_NET": "Floating Gill Net",
    "DRIFTING_NET": "Drifting Net",
    "SURFACE_NET": "Surface Net",
    "OTHER_FLOATING_NET": "Other Floating Net",
}

def format_elapsed_time(release_time: datetime) -> str:
    now = datetime.now(timezone.utc)
    rel = ensure_utc(release_time)
    diff = now - rel
    if diff.total_seconds() < 0:
        return "Just deployed"
    hours = int(diff.total_seconds() // 3600)
    minutes = int((diff.total_seconds() % 3600) // 60)
    if hours > 0:
        return f"{hours}h {minutes}m ago"
    return f"{minutes}m ago"

def build_net_summary(net: Net) -> NetSummaryResponse:
    latest_pred = net.predictions[-1] if net.predictions else None
    
    movement_km = None
    if latest_pred:
        movement_km = round(
            haversine_distance_km(
                net.release_latitude, net.release_longitude,
                latest_pred.latitude, latest_pred.longitude
            ),
            2
        )

    search_desc = None
    confidence = "MEDIUM"
    if latest_pred:
        confidence = latest_pred.confidence
        min_d = max(0.0, round((movement_km or 0.0) - latest_pred.uncertainty_radius_km * 0.5, 1))
        max_d = round((movement_km or 0.0) + latest_pred.uncertainty_radius_km * 0.8, 1)
        search_desc = f"{min_d}–{max_d} km (radius ~{latest_pred.uncertainty_radius_km}km)"

    return NetSummaryResponse(
        id=net.id,
        user_id=net.user_id,
        name=net.name,
        net_type=net.net_type,
        net_type_display=NET_TYPE_NAMES.get(net.net_type, net.net_type),
        status=net.status,
        release_latitude=net.release_latitude,
        release_longitude=net.release_longitude,
        release_time_utc=ensure_utc(net.release_time),
        release_time_ist=to_ist(net.release_time).strftime("%d %b %Y, %I:%M %p"),
        expected_retrieval_time_utc=ensure_utc(net.expected_retrieval_time),
        expected_retrieval_time_ist=to_ist(net.expected_retrieval_time).strftime("%d %b %Y, %I:%M %p"),
        elapsed_time_formatted=format_elapsed_time(net.release_time),
        latest_predicted_lat=latest_pred.latitude if latest_pred else net.release_latitude,
        latest_predicted_lon=latest_pred.longitude if latest_pred else net.release_longitude,
        estimated_movement_km=movement_km,
        drift_direction_cardinal=None if not latest_pred else None,
        search_area_description=search_desc,
        confidence=confidence,
        data_updated_ago_formatted="Updated just now",
        created_at=net.created_at,
        updated_at=net.updated_at,
    )

async def resolve_user_id(db: AsyncSession, token: Optional[str]) -> int:
    """Helper to get authenticated user id or fallback to default user 1 for dev convenience"""
    if token:
        try:
            user = await get_current_fisherman(db, token)
            return user.id
        except Exception:
            pass
    # Fallback default fisherman
    result = await db.execute(select(Fisherman).limit(1))
    f = result.scalar_one_or_none()
    return f.id if f else 1

@router.post("/nets/simulate", response_model=TrajectoryResponse)
async def simulate_net_drift(
    sim_in: NetSimulationRequest
):
    """
    On-demand net drift trajectory calculation using real oceanographic data.
    """
    release_utc = ensure_utc(sim_in.release_time)
    retrieval_utc = release_utc + timedelta(hours=sim_in.duration_hours)
    
    return await drift_engine.calculate_trajectory(
        net_id=0,
        net_name=sim_in.net_name or "Simulation Net",
        net_type=sim_in.net_type,
        release_lat=sim_in.release_latitude,
        release_lon=sim_in.release_longitude,
        release_time=release_utc,
        retrieval_time=retrieval_utc,
        timestep_minutes=sim_in.timestep_minutes
    )

@router.post("/nets", response_model=NetSummaryResponse)
async def create_net(
    net_in: NetCreate,
    db: AsyncSession = Depends(get_db),
    token: Optional[str] = Depends(reusable_oauth2)
):
    """
    Create a new fishing net deployment and automatically generate its initial drift prediction.
    """
    user_id = await resolve_user_id(db, token)
    
    release_utc = ensure_utc(net_in.release_time)
    retrieval_utc = ensure_utc(net_in.expected_retrieval_time)

    net = Net(
        user_id=user_id,
        name=net_in.name,
        net_type=net_in.net_type,
        release_latitude=net_in.release_latitude,
        release_longitude=net_in.release_longitude,
        release_time=release_utc,
        expected_retrieval_time=retrieval_utc,
        status="ACTIVE",
        notes=net_in.notes
    )
    db.add(net)
    await db.commit()
    await db.refresh(net)

    # Automatically compute initial drift prediction
    try:
        traj = await drift_engine.calculate_trajectory(
            net_id=net.id,
            net_name=net.name,
            net_type=net.net_type,
            release_lat=net.release_latitude,
            release_lon=net.release_longitude,
            release_time=release_utc,
            retrieval_time=retrieval_utc
        )

        for pt in traj.points:
            pred = NetPrediction(
                net_id=net.id,
                prediction_time=pt.prediction_time_utc,
                latitude=pt.latitude,
                longitude=pt.longitude,
                uncertainty_radius_km=pt.uncertainty_radius_km,
                drift_speed_mps=pt.drift_speed_mps,
                drift_direction=pt.drift_direction_deg,
                confidence=pt.confidence,
                step_number=pt.step_number,
                environmental_snapshot=pt.environmental_summary
            )
            db.add(pred)

        run = PredictionRun(
            net_id=net.id,
            completed_at=datetime.now(timezone.utc),
            model_version=traj.model_version,
            data_sources=traj.data_sources,
            status="SUCCESS"
        )
        db.add(run)
        await db.commit()
        await db.refresh(net)
    except Exception as e:
        await db.rollback()
        # Log failure in run
        run = PredictionRun(
            net_id=net.id,
            model_version=drift_engine.model_version,
            data_sources=["UNKNOWN"],
            status="FAILED",
            error_message=str(e)
        )
        db.add(run)
        await db.commit()

    return build_net_summary(net)

@router.get("/nets", response_model=List[NetSummaryResponse])
async def list_nets(
    db: AsyncSession = Depends(get_db),
    token: Optional[str] = Depends(reusable_oauth2)
):
    """List all fishing nets."""
    result = await db.execute(select(Net).options(selectinload(Net.predictions)).order_by(desc(Net.created_at)))
    nets = result.scalars().unique().all()
    return [build_net_summary(n) for n in nets]

@router.get("/nets/active", response_model=List[NetSummaryResponse])
async def list_active_nets(
    db: AsyncSession = Depends(get_db),
    token: Optional[str] = Depends(reusable_oauth2)
):
    """List only active drifting nets."""
    result = await db.execute(select(Net).where(Net.status == "ACTIVE").options(selectinload(Net.predictions)).order_by(desc(Net.created_at)))
    nets = result.scalars().unique().all()
    return [build_net_summary(n) for n in nets]

@router.get("/nets/{id}", response_model=NetDetailResponse)
async def get_net_detail(
    id: int,
    db: AsyncSession = Depends(get_db)
):
    """Get full details, trajectory, and environment for a specific net."""
    result = await db.execute(select(Net).where(Net.id == id))
    net = result.scalar_one_or_none()
    if not net:
        raise HTTPException(status_code=404, detail="Net not found")

    traj = await drift_engine.calculate_trajectory(
        net_id=net.id,
        net_name=net.name,
        net_type=net.net_type,
        release_lat=net.release_latitude,
        release_lon=net.release_longitude,
        release_time=net.release_time,
        retrieval_time=net.expected_retrieval_time
    )

    last_pt = traj.latest_predicted_point
    env_state, _ = await environment_service.get_normalized_environment(
        last_pt.latitude, last_pt.longitude, datetime.now(timezone.utc)
    )

    summary = build_net_summary(net)
    return NetDetailResponse(
        **summary.model_dump(),
        trajectory=traj,
        current_environment=env_state
    )

@router.post("/nets/{id}/predict", response_model=TrajectoryResponse)
async def regenerate_net_prediction(
    id: int,
    db: AsyncSession = Depends(get_db)
):
    """
    PREDICTION REFRESH
    
    1. Retrieve latest available ocean environmental forecast.
    2. Recalculate deterministic physics trajectory.
    3. Replace stored predictions.
    4. Return updated trajectory and uncertainty search area.
    """
    result = await db.execute(select(Net).where(Net.id == id))
    net = result.scalar_one_or_none()
    if not net:
        raise HTTPException(status_code=404, detail="Net not found")

    traj = await drift_engine.calculate_trajectory(
        net_id=net.id,
        net_name=net.name,
        net_type=net.net_type,
        release_lat=net.release_latitude,
        release_lon=net.release_longitude,
        release_time=net.release_time,
        retrieval_time=net.expected_retrieval_time
    )

    # Delete previous prediction checkpoints for this net
    prev_preds = await db.execute(select(NetPrediction).where(NetPrediction.net_id == id))
    for p in prev_preds.scalars().all():
        await db.delete(p)

    for pt in traj.points:
        pred = NetPrediction(
            net_id=net.id,
            prediction_time=pt.prediction_time_utc,
            latitude=pt.latitude,
            longitude=pt.longitude,
            uncertainty_radius_km=pt.uncertainty_radius_km,
            drift_speed_mps=pt.drift_speed_mps,
            drift_direction=pt.drift_direction_deg,
            confidence=pt.confidence,
            step_number=pt.step_number,
            environmental_snapshot=pt.environmental_summary
        )
        db.add(pred)

    run = PredictionRun(
        net_id=net.id,
        completed_at=datetime.now(timezone.utc),
        model_version=traj.model_version,
        data_sources=traj.data_sources,
        status="SUCCESS"
    )
    db.add(run)
    await db.commit()

    return traj

@router.get("/nets/{id}/trajectory", response_model=TrajectoryResponse)
async def get_net_trajectory(
    id: int,
    db: AsyncSession = Depends(get_db)
):
    """Get the full predicted trajectory and search area for a net."""
    result = await db.execute(select(Net).where(Net.id == id))
    net = result.scalar_one_or_none()
    if not net:
        raise HTTPException(status_code=404, detail="Net not found")

    return await drift_engine.calculate_trajectory(
        net_id=net.id,
        net_name=net.name,
        net_type=net.net_type,
        release_lat=net.release_latitude,
        release_lon=net.release_longitude,
        release_time=net.release_time,
        retrieval_time=net.expected_retrieval_time
    )

@router.get("/nets/{id}/environment", response_model=EnvironmentalState)
async def get_net_environment(
    id: int,
    db: AsyncSession = Depends(get_db)
):
    """Get latest environmental conditions at the net's release / predicted location."""
    result = await db.execute(select(Net).where(Net.id == id))
    net = result.scalar_one_or_none()
    if not net:
        raise HTTPException(status_code=404, detail="Net not found")

    env_state, _ = await environment_service.get_normalized_environment(
        net.release_latitude, net.release_longitude, datetime.now(timezone.utc)
    )
    return env_state

@router.get("/nets/{id}/status", response_model=NetSummaryResponse)
async def get_net_status(
    id: int,
    db: AsyncSession = Depends(get_db)
):
    """Get concise status summary for a net."""
    result = await db.execute(select(Net).where(Net.id == id))
    net = result.scalar_one_or_none()
    if not net:
        raise HTTPException(status_code=404, detail="Net not found")

    return build_net_summary(net)

@router.delete("/nets/{id}")
async def delete_net(
    id: int,
    db: AsyncSession = Depends(get_db)
):
    """Delete a fishing net and its predictions."""
    result = await db.execute(select(Net).where(Net.id == id))
    net = result.scalar_one_or_none()
    if not net:
        raise HTTPException(status_code=404, detail="Net not found")

    await db.delete(net)
    await db.commit()
    return {"message": f"Net {id} deleted successfully"}
