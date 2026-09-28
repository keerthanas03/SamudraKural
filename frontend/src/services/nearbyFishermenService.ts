/**
 * Nearby Fishermen Discovery Service
 * 
 * Fetches real active nearby fishermen from the PostGIS backend.
 */

import { apiFetch } from './api';
import { NearbyFisherman } from '../types/location';

/**
 * Retrieves list of active nearby fishermen within the specified radius (in km).
 * @param radiusKm Discovery radius in km (0.1 - 100.0 km, default 25.0 km)
 */
export async function getNearbyFishermen(radiusKm: number = 25.0): Promise<NearbyFisherman[]> {
  const boundedRadius = Math.max(0.1, Math.min(100.0, radiusKm));
  return await apiFetch<NearbyFisherman[]>(`/locations/nearby-fishermen?radius_km=${boundedRadius}`);
}
