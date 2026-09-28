import pytest
from httpx import AsyncClient, ASGITransport
from app.main import app

@pytest.mark.asyncio
async def test_root_endpoint():
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        resp = await client.get("/")
        assert resp.status_code == 200
        data = resp.json()
        assert "Samudra Kural" in data["message"]
        assert "model_version" in data

@pytest.mark.asyncio
async def test_environment_validation_endpoint():
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        # Test coordinates off Chennai coast: 13.05°N, 80.35°E
        resp = await client.get("/api/environment/test?latitude=13.05&longitude=80.35")
        assert resp.status_code == 200
        data = resp.json()

        # Validate structure matches user specification
        assert "location" in data
        assert data["location"]["latitude"] == 13.05
        assert data["location"]["longitude"] == 80.35
        assert "timestamp" in data
        assert "incois" in data
        assert "copernicus" in data
        assert "comparison" in data
        
        # Verify providers data
        assert "current" in data["incois"]
        assert "wind" in data["incois"]
        assert "wave" in data["incois"]

        assert "current" in data["copernicus"]
        assert "stokes_drift" in data["copernicus"]
        assert "wave" in data["copernicus"]

        # Verify agreement comparison
        assert data["comparison"]["current_agreement"] in ["HIGH", "MEDIUM", "LOW"]
        assert data["comparison"]["wave_agreement"] in ["HIGH", "MEDIUM", "LOW"]
        assert "overall_confidence_modifier" in data["comparison"]

@pytest.mark.asyncio
async def test_nets_trajectory_generation():
    from datetime import datetime, timezone, timedelta
    from app.services.drift_engine import drift_engine

    t0 = datetime.now(timezone.utc)
    t_retrieval = t0 + timedelta(hours=4)

    traj = await drift_engine.calculate_trajectory(
        net_id=1,
        net_name="Test Gill Net 01",
        net_type="FLOATING_GILL_NET",
        release_lat=13.05,
        release_lon=80.35,
        release_time=t0,
        retrieval_time=t_retrieval,
        timestep_minutes=15
    )

    assert traj.net_id == 1
    assert traj.net_name == "Test Gill Net 01"
    assert len(traj.points) == 17  # 4 hours * 4 steps/hour + 1 (step 0)
    assert traj.latest_predicted_point.cumulative_distance_km > 0.0
    assert traj.search_area.uncertainty_radius_km >= 0.5
    assert traj.search_area.confidence in ["HIGH", "MEDIUM", "LOW"]
