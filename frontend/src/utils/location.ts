import * as Location from 'expo-location';

export interface FishermanGPS {
  latitude: number;
  longitude: number;
  accuracy: number;
  timestamp: number;
}

/**
 * Get current fisherman device GPS location.
 * Uses expo-location for live device hardware GPS, falls back if permission is pending.
 */
export async function getCurrentFishermanGPS(): Promise<FishermanGPS> {
  try {
    const { status } = await Location.requestForegroundPermissionsAsync();
    if (status === 'granted') {
      const loc = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.High,
      });
      if (loc && loc.coords) {
        return {
          latitude: loc.coords.latitude,
          longitude: loc.coords.longitude,
          accuracy: loc.coords.accuracy || 5.0,
          timestamp: loc.timestamp || Date.now(),
        };
      }
    }
  } catch (err) {
    console.log('Expo location permission / fetch error:', err);
  }

  // Fallback if native location is unavailable
  return new Promise((resolve) => {
    if (typeof navigator !== 'undefined' && navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          resolve({
            latitude: pos.coords.latitude,
            longitude: pos.coords.longitude,
            accuracy: pos.coords.accuracy || 5.0,
            timestamp: pos.timestamp || Date.now(),
          });
        },
        () => {
          resolve({
            latitude: 13.0620,
            longitude: 80.3210,
            accuracy: 8.0,
            timestamp: Date.now(),
          });
        },
        { enableHighAccuracy: true, timeout: 6000 }
      );
    } else {
      resolve({
        latitude: 13.0620,
        longitude: 80.3210,
        accuracy: 8.0,
        timestamp: Date.now(),
      });
    }
  });
}
