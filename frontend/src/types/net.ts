export type NetType = 
  | 'FLOATING_GILL_NET'
  | 'DRIFTING_NET'
  | 'SURFACE_NET'
  | 'OTHER_FLOATING_NET';

export interface TrajectoryPoint {
  step_number: number;
  prediction_time_utc: string;
  prediction_time_ist: string;
  latitude: number;
  longitude: number;
  drift_speed_mps: number;
  drift_speed_kmh: number;
  drift_direction_deg: number;
  drift_direction_cardinal: string;
  cumulative_distance_km: number;
  uncertainty_radius_km: number;
  confidence: 'HIGH' | 'MEDIUM' | 'LOW';
  environmental_summary?: {
    current_speed_mps?: number;
    wind_speed_kmh?: number;
    wave_height_m?: number;
    sea_state?: string;
  };
}

export interface SearchArea {
  center_latitude: number;
  center_longitude: number;
  uncertainty_radius_km: number;
  min_distance_from_release_km: number;
  max_distance_from_release_km: number;
  general_direction: string;
  sector_description: string;
  confidence: 'HIGH' | 'MEDIUM' | 'LOW';
  notes: string;
}

export interface TrajectoryResponse {
  net_id: number;
  net_name: string;
  net_type: string;
  release_time_utc: string;
  expected_retrieval_time_utc: string;
  total_duration_hours: number;
  points_count: number;
  points: TrajectoryPoint[];
  latest_predicted_point: TrajectoryPoint;
  search_area: SearchArea;
  model_version: string;
  data_sources: string[];
  forecast_updated_at: string;
  safety_disclaimer: string;
}

export interface EnvironmentalState {
  timestamp_utc: string;
  latitude: number;
  longitude: number;
  current_speed_mps: number;
  current_direction_deg: number;
  current_direction_cardinal: string;
  wind_speed_mps: number;
  wind_speed_kmh: number;
  wind_direction_deg: number;
  wind_direction_cardinal: string;
  wave_height: number;
  wave_direction: number;
  wave_period: number;
  sea_state: string;
  swell_height?: number;
  swell_period?: number;
  data_sources: string[];
  data_timestamp?: string;
  retrieved_at: string;
  data_age_minutes: number;
  availability_status: string;
}

export interface FishingNet {
  id: number;
  user_id: number;
  name: string;
  net_type: NetType;
  net_type_display: string;
  status: 'ACTIVE' | 'RETRIEVED' | 'LOST' | 'ARCHIVED';
  release_latitude: number;
  release_longitude: number;
  release_time_utc: string;
  release_time_ist: string;
  expected_retrieval_time_utc: string;
  expected_retrieval_time_ist: string;
  elapsed_time_formatted: string;
  latest_predicted_lat?: number;
  latest_predicted_lon?: number;
  estimated_movement_km?: number;
  drift_direction_cardinal?: string;
  search_area_description?: string;
  confidence?: 'HIGH' | 'MEDIUM' | 'LOW';
  data_updated_ago_formatted?: string;
  created_at: string;
  updated_at: string;
}

export interface CreateNetPayload {
  name: string;
  net_type: NetType;
  release_latitude: number;
  release_longitude: number;
  release_time: string;
  expected_retrieval_time: string;
  notes?: string;
}

export interface EnvironmentTestResponse {
  location: { latitude: number; longitude: number };
  timestamp: string;
  demo_mode: boolean;
  incois: {
    status: string;
    dataset_id?: string;
    current?: any;
    wind?: any;
    wave?: any;
    units?: Record<string, string>;
    error?: string;
  };
  copernicus: {
    status: string;
    dataset_id?: string;
    current?: any;
    stokes_drift?: any;
    wave?: any;
    units?: Record<string, string>;
    error?: string;
  };
  comparison: {
    current_agreement: 'HIGH' | 'MEDIUM' | 'LOW';
    wave_agreement: 'HIGH' | 'MEDIUM' | 'LOW';
    overall_confidence_modifier: number;
    notes: string;
  };
  normalized_state?: EnvironmentalState;
}
