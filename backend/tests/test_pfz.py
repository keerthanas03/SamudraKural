import pytest

@pytest.mark.anyio
async def test_list_sectors_endpoint(client):
    response = await client.get("/api/v1/pfz/sectors")
    assert response.status_code == 200
    data = response.json()
    assert isinstance(data, list)
    assert len(data) == 12
    sector_ids = [s["id"] for s in data]
    assert "SEC006" in sector_ids  # South Tamil Nadu
    assert "SEC007" in sector_ids  # North Tamil Nadu

@pytest.mark.anyio
async def test_sector_advisory_endpoint(client):
    response = await client.get("/api/v1/pfz/advisory/SEC007")
    assert response.status_code == 200
    data = response.json()
    assert data["sector_id"] == "SEC007"
    assert data["sector_name"] == "NORTH TAMIL NADU"
    assert data["is_live_data"] is True
    assert "oceanographic_indicators" in data
    assert len(data["hotspots"]) >= 1

@pytest.mark.anyio
async def test_wms_layers_endpoint(client):
    response = await client.get("/api/v1/pfz/layers")
    assert response.status_code == 200
    data = response.json()
    assert "chlorophyll_wms" in data
    assert "sst_wms" in data
    assert "PFZ-TUNA-SST-CHL:chl" in data["chlorophyll_wms"]["layer_name"]
    assert "PFZ-TUNA-SST-CHL:sst" in data["sst_wms"]["layer_name"]

@pytest.mark.anyio
async def test_nearby_pfz_endpoint(client):
    response = await client.get("/api/v1/pfz/nearby?latitude=13.0827&longitude=80.2707&sector_id=SEC007")
    assert response.status_code == 200
    data = response.json()
    assert isinstance(data, list)
    assert len(data) > 0
    first_spot = data[0]
    assert "distance_meters" in first_spot
    assert "bearing_degrees" in first_spot
    assert "direction" in first_spot
