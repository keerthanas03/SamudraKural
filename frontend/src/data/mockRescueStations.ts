export interface RescueStation {
  id: string;
  name: string;
  region: string;
  latitude: number;
  longitude: number;
  contactPhone: string;
  vhfChannel: string;
}

export const MOCK_RESCUE_STATIONS: RescueStation[] = [
  {
    id: 'MRCC-MAA-01',
    name: 'Chennai Coast Guard MRCC',
    region: 'Coromandel Coast / Tamil Nadu',
    latitude: 13.0827,
    longitude: 80.2707,
    contactPhone: '+91 44 2346 0405',
    vhfChannel: 'Channel 16 (156.8 MHz)',
  },
  {
    id: 'MRCC-TUT-02',
    name: 'Tuticorin Coastal Safety Command',
    region: 'Gulf of Mannar',
    latitude: 8.7642,
    longitude: 78.1348,
    contactPhone: '+91 461 235 2724',
    vhfChannel: 'Channel 16 (156.8 MHz)',
  },
  {
    id: 'MRCC-KOK-03',
    name: 'Kochi Maritime Rescue Sub-Centre',
    region: 'Arabian Sea / Malabar',
    latitude: 9.9312,
    longitude: 76.2673,
    contactPhone: '+91 484 221 5440',
    vhfChannel: 'Channel 16 (156.8 MHz)',
  },
  {
    id: 'MRCC-VZG-04',
    name: 'Visakhapatnam Naval MRCC',
    region: 'Bay of Bengal North',
    latitude: 17.6868,
    longitude: 83.2185,
    contactPhone: '+91 891 281 3000',
    vhfChannel: 'Channel 16 (156.8 MHz)',
  },
];

/**
 * Calculates straight line distance (Haversine formula) in Km between two points.
 */
function calculateDistanceKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371; // Earth radius in km
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return Math.round(R * c * 10) / 10;
}

export function getNearestRescueStation(
  latitude: number | null,
  longitude: number | null
): { station: RescueStation; distanceKm: number | null } {
  if (latitude === null || longitude === null) {
    // Default fallback to Chennai MRCC if location unavailable
    return { station: MOCK_RESCUE_STATIONS[0], distanceKm: null };
  }

  let minDistance = Infinity;
  let nearest = MOCK_RESCUE_STATIONS[0];

  for (const station of MOCK_RESCUE_STATIONS) {
    const dist = calculateDistanceKm(latitude, longitude, station.latitude, station.longitude);
    if (dist < minDistance) {
      minDistance = dist;
      nearest = station;
    }
  }

  return { station: nearest, distanceKm: minDistance };
}
