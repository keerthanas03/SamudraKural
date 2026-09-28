export interface LiveLocationHeartbeatPayload {
  latitude: number;
  longitude: number;
  accuracy_meters?: number;
  speed_mps?: number;
  heading_degrees?: number;
  battery_percent?: number;
  recorded_at?: string;
}

export interface LiveLocationResponse {
  id: number;
  fisherman_id: number;
  latitude: number;
  longitude: number;
  location: {
    latitude: number;
    longitude: number;
  };
  accuracy_meters?: number;
  speed_mps?: number;
  heading_degrees?: number;
  battery_percent?: number;
  is_active: boolean;
  recorded_at: string;
  updated_at: string;
}

export interface NearbyFisherman {
  fisherman_id: number;
  fisherman_name: string;
  phone: string;
  boat_name?: string | null;
  boat_registration?: string | null;
  latitude: number;
  longitude: number;
  distance_meters: number;
  battery_percent?: number;
  last_seen_seconds_ago?: number;
}
