export interface IBLPoint {
  latitude: number;
  longitude: number;
  name?: string;
}

export type IBLStatus = 'SAFE' | 'WARNING' | 'CRITICAL' | 'CROSSED';

export interface IBLProximityResult {
  distanceNm: number;
  distanceKm: number;
  status: IBLStatus;
  nearestBoundaryPoint: IBLPoint;
  bearingDegrees: number;
  warningMessage: string;
}

// Official India - Sri Lanka International Maritime Boundary Line (IBL) Coordinates
// Full 22 Official Treaty Turning Points (1974 & 1976 Bilateral Agreements)
export const INDIA_SRI_LANKA_IBL_POINTS: IBLPoint[] = [
  { latitude: 12.0000, longitude: 82.2500, name: 'Bay of Bengal Point 6m' },
  { latitude: 11.6667, longitude: 81.9167, name: 'Bay of Bengal Point 5m' },
  { latitude: 11.4333, longitude: 81.6667, name: 'Bay of Bengal Point 4m' },
  { latitude: 11.1333, longitude: 81.4000, name: 'Bay of Bengal Point 3m' },
  { latitude: 10.8333, longitude: 81.0667, name: 'Point Calimere Outer Point 2m' },
  { latitude: 10.5500, longitude: 80.7667, name: 'Palk Strait Entry Point 1m' },
  { latitude: 10.0833, longitude: 80.0500, name: 'Palk Strait North Point 1' },
  { latitude: 9.9500, longitude: 79.5833, name: 'Palk Strait Point 2' },
  { latitude: 9.6692, longitude: 79.3767, name: 'Palk Bay Center Point 3' },
  { latitude: 9.3633, longitude: 79.5117, name: 'Kachchatheevu Boundary Point 4' },
  { latitude: 9.2167, longitude: 79.5333, name: 'Adam\'s Bridge North Point 5' },
  { latitude: 9.1000, longitude: 79.5333, name: 'Adam\'s Bridge South Point 6' },
  { latitude: 8.8967, longitude: 79.4817, name: 'Gulf of Mannar Point 8m' },
  { latitude: 8.6667, longitude: 79.3033, name: 'Gulf of Mannar Point 9m' },
  { latitude: 8.6200, longitude: 79.2167, name: 'Gulf of Mannar Point 10m' },
  { latitude: 8.5200, longitude: 79.0783, name: 'Gulf of Mannar Point 11m' },
  { latitude: 8.3700, longitude: 78.9233, name: 'Tuticorin Offshore Point 12m' },
  { latitude: 8.2033, longitude: 78.8950, name: 'Manapad Offshore Point 13m' },
  { latitude: 7.5883, longitude: 78.7450, name: 'Wadge Bank Outer Point 14m' },
  { latitude: 7.2533, longitude: 78.6467, name: 'Wadge Bank Deep Point 15m' },
  { latitude: 6.5000, longitude: 78.4167, name: 'Oceanic Boundary Point 16m' },
  { latitude: 4.7833, longitude: 77.0167, name: 'India-Sri Lanka-Maldives Tri-Junction' },
];

/**
 * Calculates Great-Circle Haversine Distance between two points in Kilometers.
 */
function haversineDistanceKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
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
  return R * c;
}

/**
 * Calculates initial bearing in degrees from point 1 to point 2.
 */
function calculateBearing(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const φ1 = (lat1 * Math.PI) / 180;
  const φ2 = (lat2 * Math.PI) / 180;
  const Δλ = ((lon2 - lon1) * Math.PI) / 180;

  const y = Math.sin(Δλ) * Math.cos(φ2);
  const x = Math.cos(φ1) * Math.sin(φ2) - Math.sin(φ1) * Math.cos(φ2) * Math.cos(Δλ);
  const θ = Math.atan2(y, x);
  return ((θ * 180) / Math.PI + 360) % 360;
}

/**
 * Calculates the perpendicular distance from a vessel coordinate to a segment between two IBL points.
 */
function minDistanceToSegmentKm(
  vLat: number,
  vLon: number,
  p1: IBLPoint,
  p2: IBLPoint
): { distKm: number; nearestLat: number; nearestLon: number } {
  const l2 = haversineDistanceKm(p1.latitude, p1.longitude, p2.latitude, p2.longitude);
  if (l2 === 0) {
    return {
      distKm: haversineDistanceKm(vLat, vLon, p1.latitude, p1.longitude),
      nearestLat: p1.latitude,
      nearestLon: p1.longitude,
    };
  }

  // Linear projection parameter t
  let t =
    ((vLat - p1.latitude) * (p2.latitude - p1.latitude) +
      (vLon - p1.longitude) * (p2.longitude - p1.longitude)) /
    (Math.pow(p2.latitude - p1.latitude, 2) + Math.pow(p2.longitude - p1.longitude, 2));

  t = Math.max(0, Math.min(1, t));

  const projLat = p1.latitude + t * (p2.latitude - p1.latitude);
  const projLon = p1.longitude + t * (p2.longitude - p1.longitude);

  return {
    distKm: haversineDistanceKm(vLat, vLon, projLat, projLon),
    nearestLat: projLat,
    nearestLon: projLon,
  };
}

/**
 * Checks vessel position against the IBL and returns live proximity telemetry.
 */
export function checkIBLProximity(vesselLat: number, vesselLon: number): IBLProximityResult {
  let minKm = Infinity;
  let nearestPt: IBLPoint = INDIA_SRI_LANKA_IBL_POINTS[0];

  for (let i = 0; i < INDIA_SRI_LANKA_IBL_POINTS.length - 1; i++) {
    const p1 = INDIA_SRI_LANKA_IBL_POINTS[i];
    const p2 = INDIA_SRI_LANKA_IBL_POINTS[i + 1];
    const res = minDistanceToSegmentKm(vesselLat, vesselLon, p1, p2);
    if (res.distKm < minKm) {
      minKm = res.distKm;
      nearestPt = { latitude: res.nearestLat, longitude: res.nearestLon, name: `Segment ${i + 1}` };
    }
  }

  const distanceNm = parseFloat((minKm / 1.852).toFixed(2));
  const distanceKm = parseFloat(minKm.toFixed(2));
  const bearingDegrees = Math.round(calculateBearing(vesselLat, vesselLon, nearestPt.latitude, nearestPt.longitude));

  let status: IBLStatus = 'SAFE';
  let warningMessage = 'Safe Indian Territorial Waters. Normal Voyage Operations.';

  // Proximity-based status determination
  if (distanceNm <= 0.3) {
    status = 'CROSSED';
    warningMessage = 'CRITICAL: At / Beyond International Boundary! Turn back immediately!';
  } else if (distanceNm <= 2.0) {
    status = 'CRITICAL';
    warningMessage = `CRITICAL WARNING: Imminent International Boundary (${distanceNm} NM / ${distanceKm} km away)!`;
  } else if (distanceNm <= 5.0) {
    status = 'WARNING';
    warningMessage = `CAUTION: Approaching International Boundary Line (${distanceNm} NM / ${distanceKm} km away)`;
  } else {
    status = 'SAFE';
    warningMessage = 'Safe Indian Territorial Waters. Normal Voyage Operations.';
  }

  return {
    distanceNm,
    distanceKm,
    status,
    nearestBoundaryPoint: nearestPt,
    bearingDegrees,
    warningMessage,
  };
}
