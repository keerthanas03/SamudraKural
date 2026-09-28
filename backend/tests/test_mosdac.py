import pytest

@pytest.mark.anyio
async def test_mosdac_layers_endpoint(client):
    response = await client.get("/api/v1/mosdac/layers")
    assert response.status_code == 200
    data = response.json()
    assert "insat_rapid_scan_wms" in data
    assert "oceansat_chlorophyll_wms" in data
    assert "scatsat_winds_wms" in data
    assert "insat_sst_wms" in data
    assert "MOSDAC_INSAT:insat3dr_cloud_rapid" in data["insat_rapid_scan_wms"]["layer_name"]
    assert "MOSDAC_OCEAN:eos06_ocm_chlorophyll" in data["oceansat_chlorophyll_wms"]["layer_name"]

@pytest.mark.anyio
async def test_mosdac_advisory_endpoint(client):
    response = await client.get("/api/v1/mosdac/advisory?latitude=13.0827&longitude=80.3800&sector_id=SEC007")
    assert response.status_code == 200
    data = response.json()
    assert data["sector_id"] == "SEC007"
    assert data["sector_name"] == "NORTH TAMIL NADU"
    assert data["is_live_satellite_feed"] is True
    assert "cross_validation_confidence" in data
    assert data["sst_celsius"] > 0
    assert data["chlorophyll_a_mg_m3"] > 0

@pytest.mark.anyio
async def test_mosdac_cyclone_alerts_endpoint(client):
    response = await client.get("/api/v1/mosdac/cyclone-alerts?latitude=13.0827&longitude=80.3800")
    assert response.status_code == 200
    data = response.json()
    assert "severity" in data
    assert "location_basin" in data
    assert "satellite_source" in data

@pytest.mark.anyio
async def test_mosdac_ocean_winds_endpoint(client):
    response = await client.get("/api/v1/mosdac/ocean-winds?latitude=13.0827&longitude=80.3800")
    assert response.status_code == 200
    data = response.json()
    assert "wind_speed_knots" in data
    assert "wind_direction_degrees" in data
    assert "wind_cardinal" in data

@pytest.mark.anyio
async def test_mosdac_cross_validate_endpoint(client):
    response = await client.get("/api/v1/mosdac/cross-validate?latitude=13.0827&longitude=80.3800")
    assert response.status_code == 200
    data = response.json()
    assert data["is_dual_validated"] is True
    assert "combined_confidence_score" in data
    assert "incois_advisory" in data
    assert "mosdac_advisory" in data
