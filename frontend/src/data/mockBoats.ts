export interface RegisteredBoat {
  id: string;
  name: string;
  captainName: string;
  latitude: number;
  longitude: number;
  status: 'active' | 'anchored' | 'returning';
  distanceKm?: number;
  vesselType?: string;
  phone?: string;
  isLive?: boolean;
}

export const MOCK_REGISTERED_BOATS: RegisteredBoat[] = [];

export function calculateDistanceKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371;
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

export function findNearbyRegisteredBoats(
  latitude: number | null,
  longitude: number | null,
  maxRadiusKm: number = 25
): RegisteredBoat[] {
  const currentLat = latitude ?? 13.0827;
  const currentLon = longitude ?? 80.3800;

  return MOCK_REGISTERED_BOATS.map((boat) => {
    const dist = calculateDistanceKm(currentLat, currentLon, boat.latitude, boat.longitude);
    return { ...boat, distanceKm: dist };
  })
    .filter((boat) => (boat.distanceKm ?? Infinity) <= maxRadiusKm)
    .sort((a, b) => (a.distanceKm ?? 0) - (b.distanceKm ?? 0));
}

export async function fetchLiveRegisteredBoats(
  latitude: number | null,
  longitude: number | null,
  maxRadiusKm: number = 50
): Promise<RegisteredBoat[]> {
  const currentLat = latitude ?? 13.0827;
  const currentLon = longitude ?? 80.3800;

  const liveBoats: RegisteredBoat[] = [];

  try {
    const { coastalGuardService } = require('../services/coastalGuardService');
    const { getUserSession } = require('../storage/storage');

    // 1. Fetch active registered fishermen & boats from Coastal Guard service
    const alerts = await coastalGuardService.getLocalAlerts();
    alerts.forEach((alert: any) => {
      if (alert.boat || alert.fisherman) {
        const boatName = alert.boat?.name || 'Registered Vessel';
        const captainName = alert.fisherman?.name || 'Registered Fisherman';
        const regId = alert.boat?.registration || `IND-TN-CG-${alert.id}`;

        liveBoats.push({
          id: regId,
          name: boatName,
          captainName: captainName,
          latitude: alert.latitude || currentLat + 0.008,
          longitude: alert.longitude || currentLon + 0.012,
          status: alert.status === 'RESOLVED' ? 'anchored' : 'active',
          vesselType: alert.boat?.vessel_type || 'Mechanized Vessel',
          phone: alert.fisherman?.phone,
          isLive: true,
        });
      }
    });

    // 2. Include active registered user session if available
    const userSession = await getUserSession();
    if (userSession && (userSession.name || userSession.vesselName)) {
      const vName = userSession.vesselName || 'Fisherman Patrol';
      if (!liveBoats.some((b) => b.name === vName)) {
        liveBoats.push({
          id: userSession.vesselRegistration || 'IND-TN-USER-01',
          name: vName,
          captainName: `${userSession.name || 'Active Fisherman'} (You)`,
          latitude: currentLat + 0.003,
          longitude: currentLon + 0.004,
          status: 'active',
          vesselType: userSession.vesselType || 'Registered Trawler',
          phone: userSession.phone,
          isLive: true,
        });
      }
    }
  } catch (e) {
    console.log('[mockBoats] Error fetching live registered boats:', e);
  }

  // 3. Combine with registered fleet database
  MOCK_REGISTERED_BOATS.forEach((fallbackBoat) => {
    if (!liveBoats.some((b) => b.id === fallbackBoat.id || b.name === fallbackBoat.name)) {
      liveBoats.push(fallbackBoat);
    }
  });

  return liveBoats
    .map((boat) => {
      const dist = calculateDistanceKm(currentLat, currentLon, boat.latitude, boat.longitude);
      return { ...boat, distanceKm: dist };
    })
    .filter((boat) => (boat.distanceKm ?? Infinity) <= maxRadiusKm)
    .sort((a, b) => (a.distanceKm ?? 0) - (b.distanceKm ?? 0));
}

