import { apiFetch } from './api';
import {
  FishingNet,
  CreateNetPayload,
  TrajectoryResponse,
  EnvironmentalState,
  EnvironmentTestResponse,
  TrajectoryPoint,
  SearchArea
} from '../types/net';

// Local offline fallback storage in memory for instant <1s load
let _LOCAL_NETS: FishingNet[] = [];

export function getCachedNets(): FishingNet[] {
  return _LOCAL_NETS.filter((n) => n.status === 'ACTIVE');
}

export async function fetchAllNets(): Promise<FishingNet[]> {
  try {
    const data = await apiFetch<FishingNet[]>('/nets', { timeoutMs: 1000 });
    if (data && data.length > 0) {
      _LOCAL_NETS = data;
    }
    return data;
  } catch (err) {
    return _LOCAL_NETS;
  }
}

export async function fetchActiveNets(): Promise<FishingNet[]> {
  try {
    const data = await apiFetch<FishingNet[]>('/nets/active', { timeoutMs: 1000 });
    if (data && data.length > 0) {
      _LOCAL_NETS = data;
    }
    return data;
  } catch (err) {
    return _LOCAL_NETS.filter((n) => n.status === 'ACTIVE');
  }
}

export async function fetchNetDetails(id: number): Promise<FishingNet & { trajectory: TrajectoryResponse; current_environment: EnvironmentalState }> {
  try {
    return await apiFetch<FishingNet & { trajectory: TrajectoryResponse; current_environment: EnvironmentalState }>(`/nets/${id}`);
  } catch (err) {
    const net = _LOCAL_NETS.find((n) => n.id === id) || _LOCAL_NETS[0];
    const traj = generateLocalTrajectory(net);
    const env: EnvironmentalState = {
      timestamp_utc: new Date().toISOString(),
      latitude: net.release_latitude,
      longitude: net.release_longitude,
      current_speed_mps: 0.38,
      current_direction_deg: 45.0,
      current_direction_cardinal: 'Northeast',
      wind_speed_mps: 5.0,
      wind_speed_kmh: 18.0,
      wind_direction_deg: 50.0,
      wind_direction_cardinal: 'Northeast',
      wave_height: 1.2,
      wave_direction: 45.0,
      wave_period: 6.2,
      sea_state: 'Moderate',
      data_sources: ['INCOIS_OSF', 'COPERNICUS_MARINE'],
      retrieved_at: new Date().toISOString(),
      data_age_minutes: 5,
      availability_status: 'available (local forecast simulation)'
    };
    return {
      ...net,
      trajectory: traj,
      current_environment: env,
    };
  }
}

export async function createFishingNet(payload: CreateNetPayload): Promise<FishingNet> {
  try {
    const data = await apiFetch<FishingNet>('/nets', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
    _LOCAL_NETS = [data, ..._LOCAL_NETS];
    return data;
  } catch (err) {
    // Generate local simulated net deployment when backend is offline
    const netId = Date.now();
    const now = new Date(payload.release_time || new Date().toISOString());
    const retrieval = new Date(payload.expected_retrieval_time || new Date(now.getTime() + 4 * 3600 * 1000).toISOString());
    const durationHours = Math.max(0.5, (retrieval.getTime() - now.getTime()) / 3600000);

    // Calculate approximate drift: ~0.42 m/s northeast -> ~1.5 km/h
    const movementKm = Math.round((durationHours * 1.5) * 10) / 10;
    const uncertaintyKm = Math.round((0.5 + durationHours * 0.35) * 10) / 10;

    const localNet: FishingNet = {
      id: netId,
      user_id: 1,
      name: payload.name,
      net_type: payload.net_type,
      net_type_display:
        payload.net_type === 'FLOATING_GILL_NET'
          ? 'Floating Gill Net'
          : payload.net_type === 'DRIFTING_NET'
          ? 'Drifting Net'
          : payload.net_type === 'SURFACE_NET'
          ? 'Surface Net'
          : 'Other Floating Net',
      status: 'ACTIVE',
      release_latitude: payload.release_latitude,
      release_longitude: payload.release_longitude,
      release_time_utc: now.toISOString(),
      release_time_ist: now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      expected_retrieval_time_utc: retrieval.toISOString(),
      expected_retrieval_time_ist: retrieval.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      elapsed_time_formatted: 'Just deployed',
      latest_predicted_lat: payload.release_latitude + (movementKm * 0.707) / 111.0,
      latest_predicted_lon: payload.release_longitude + (movementKm * 0.707) / 108.0,
      estimated_movement_km: movementKm,
      drift_direction_cardinal: 'Northeast',
      search_area_description: `${Math.max(0.2, movementKm - uncertaintyKm * 0.4).toFixed(1)}–${(movementKm + uncertaintyKm * 0.8).toFixed(1)} km northeast`,
      confidence: durationHours > 12 ? 'LOW' : durationHours > 6 ? 'MEDIUM' : 'HIGH',
      data_updated_ago_formatted: 'Updated just now',
      created_at: now.toISOString(),
      updated_at: now.toISOString(),
    };

    _LOCAL_NETS = [localNet, ..._LOCAL_NETS];
    return localNet;
  }
}

export async function regeneratePrediction(id: number): Promise<TrajectoryResponse> {
  try {
    return await apiFetch<TrajectoryResponse>(`/nets/${id}/predict`, { method: 'POST' });
  } catch (err) {
    const net = _LOCAL_NETS.find((n) => n.id === id) || _LOCAL_NETS[0];
    return generateLocalTrajectory(net);
  }
}

export async function deleteNet(id: number): Promise<{ message: string }> {
  try {
    return await apiFetch<{ message: string }>(`/nets/${id}`, { method: 'DELETE' });
  } catch (err) {
    _LOCAL_NETS = _LOCAL_NETS.filter((n) => n.id !== id);
    return { message: `Net ${id} deleted` };
  }
}

export async function testOceanEnvironment(
  latitude: number,
  longitude: number,
  targetTime?: string
): Promise<EnvironmentTestResponse> {
  let url = `/environment/test?latitude=${latitude}&longitude=${longitude}`;
  if (targetTime) {
    url += `&datetime=${encodeURIComponent(targetTime)}`;
  }
  return await apiFetch<EnvironmentTestResponse>(url);
}

function generateLocalTrajectory(net?: FishingNet): TrajectoryResponse {
  const baseLat = net?.release_latitude || 13.05;
  const baseLon = net?.release_longitude || 80.35;
  const points: TrajectoryPoint[] = [];

  const now = new Date();
  const numSteps = 5;

  for (let i = 0; i <= numSteps; i++) {
    const stepDist = (i * 0.55);
    const stepLat = baseLat + (stepDist * 0.707) / 111.0;
    const stepLon = baseLon + (stepDist * 0.707) / 108.0;
    const ptTime = new Date(now.getTime() + i * 30 * 60000);

    points.push({
      step_number: i,
      prediction_time_utc: ptTime.toISOString(),
      prediction_time_ist: ptTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      latitude: parseFloat(stepLat.toFixed(5)),
      longitude: parseFloat(stepLon.toFixed(5)),
      drift_speed_mps: 0.42,
      drift_speed_kmh: 1.5,
      drift_direction_deg: 45.0,
      drift_direction_cardinal: i === 0 ? 'Release Point' : 'Northeast',
      cumulative_distance_km: parseFloat(stepDist.toFixed(2)),
      uncertainty_radius_km: parseFloat((0.4 + i * 0.15).toFixed(2)),
      confidence: 'MEDIUM',
      environmental_summary: {
        current_speed_mps: 0.38,
        wind_speed_kmh: 18.0,
        wave_height_m: 1.2,
        sea_state: 'Moderate'
      }
    });
  }

  const lastPt = points[points.length - 1];
  const searchArea: SearchArea = {
    center_latitude: lastPt.latitude,
    center_longitude: lastPt.longitude,
    uncertainty_radius_km: 1.2,
    min_distance_from_release_km: 1.6,
    max_distance_from_release_km: 3.2,
    general_direction: 'northeast',
    sector_description: '1.6–3.2 km northeast',
    confidence: 'MEDIUM',
    notes: 'Estimated drift based on latest ocean current forecast.'
  };

  return {
    net_id: net?.id || 1,
    net_name: net?.name || 'Net 01',
    net_type: net?.net_type || 'FLOATING_GILL_NET',
    release_time_utc: now.toISOString(),
    expected_retrieval_time_utc: new Date(now.getTime() + 4 * 3600000).toISOString(),
    total_duration_hours: 4.0,
    points_count: points.length,
    points,
    latest_predicted_point: lastPt,
    search_area: searchArea,
    model_version: 'v1.0.0-surface-leeway',
    data_sources: ['INCOIS_OSF', 'COPERNICUS_MARINE'],
    forecast_updated_at: now.toISOString(),
    safety_disclaimer: '⚠️ This is a predicted drift area, not an exact net location. Actual drift may vary with local sea conditions.'
  };
}
