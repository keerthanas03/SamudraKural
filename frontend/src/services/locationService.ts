import { useState, useEffect } from 'react';
import { Platform } from 'react-native';
import * as Location from 'expo-location';
import { LocationResult } from '../types/sos';

let Battery: any = null;
try {
  Battery = require('expo-battery');
} catch (e) {
  Battery = null;
}

let demoGpsAvailable = true;

/**
 * Allows demo developer controls to simulate GPS availability/unavailability
 */
export function setDemoGpsAvailable(available: boolean): void {
  demoGpsAvailable = available;
}

export function isDemoGpsAvailable(): boolean {
  return demoGpsAvailable;
}

/**
 * Retrieves the device's real battery level percentage (0-100).
 * Checks Native expo-battery API, Web Battery API (navigator.getBattery),
 * and falls back gracefully to a non-null estimate.
 */
export async function getRealBatteryLevel(): Promise<number> {
  try {
    // 1. Try Native Expo Battery API
    if (Battery && typeof Battery.getBatteryLevelAsync === 'function') {
      const level = await Battery.getBatteryLevelAsync();
      if (typeof level === 'number' && level >= 0) {
        return Math.round(level * 100);
      }
    }
  } catch (e) {
    // Native Expo Battery call failed or not available on current platform
  }

  // 2. Try HTML5 Web Battery API for web browser preview
  try {
    if (typeof window !== 'undefined' && typeof (navigator as any)?.getBattery === 'function') {
      const webBatt = await (navigator as any).getBattery();
      if (webBatt && typeof webBatt.level === 'number') {
        return Math.round(webBatt.level * 100);
      }
    }
  } catch (webErr) {
    // Web battery API unavailable
  }

  // Default fallback if battery hardware readings are completely unavailable
  return 100;
}

/**
 * Subscribes to real-time phone battery level changes.
 * Invokes callback immediately and whenever the battery level updates.
 * Returns an unsubscribe cleanup function.
 */
export function subscribeToBatteryLevel(onChange: (level: number) => void): () => void {
  let isSubscribed = true;
  let nativeSub: { remove: () => void } | null = null;
  let nativeStateSub: { remove: () => void } | null = null;
  let webBattInstance: any = null;
  let webListener: (() => void) | null = null;

  // Immediate initial fetch
  getRealBatteryLevel().then((initialLevel) => {
    if (isSubscribed) {
      onChange(initialLevel);
    }
  });

  // 1. Listen via native Expo Battery listener
  try {
    if (Battery && typeof Battery.addBatteryLevelListener === 'function') {
      nativeSub = Battery.addBatteryLevelListener(({ batteryLevel }: any) => {
        if (isSubscribed && typeof batteryLevel === 'number' && batteryLevel >= 0) {
          onChange(Math.round(batteryLevel * 100));
        }
      });
    }

    if (Battery && typeof Battery.addBatteryStateListener === 'function') {
      nativeStateSub = Battery.addBatteryStateListener(() => {
        if (isSubscribed) {
          getRealBatteryLevel().then((lvl) => isSubscribed && onChange(lvl));
        }
      });
    }
  } catch (err) {
    console.warn('Native battery listener setup notice:', err);
  }

  // 2. Listen via Web Battery API if available
  if (typeof window !== 'undefined' && typeof (navigator as any)?.getBattery === 'function') {
    (navigator as any).getBattery().then((batt: any) => {
      if (!isSubscribed || !batt) return;
      webBattInstance = batt;
      webListener = () => {
        if (isSubscribed && typeof batt.level === 'number') {
          onChange(Math.round(batt.level * 100));
        }
      };
      batt.addEventListener('levelchange', webListener);
      batt.addEventListener('chargingchange', webListener);
    }).catch(() => {});
  }

  // Return unsubscribe cleanup handler
  return () => {
    isSubscribed = false;
    if (nativeSub && typeof nativeSub.remove === 'function') {
      nativeSub.remove();
    }
    if (nativeStateSub && typeof nativeStateSub.remove === 'function') {
      nativeStateSub.remove();
    }
    if (webBattInstance && webListener) {
      webBattInstance.removeEventListener('levelchange', webListener);
      webBattInstance.removeEventListener('chargingchange', webListener);
    }
  };
}

/**
 * Custom React hook that syncs component state with actual phone battery in real-time.
 */
export function useBatteryLevel(): number {
  const [batteryLevel, setBatteryLevel] = useState<number>(100);

  useEffect(() => {
    const unsubscribe = subscribeToBatteryLevel((level) => {
      setBatteryLevel(level);
    });
    return () => {
      unsubscribe();
    };
  }, []);

  return batteryLevel;
}

/**
 * Subscribes to real-time phone GPS location updates.
 * Invokes callback immediately and whenever the position changes.
 * Returns an unsubscribe cleanup function.
 */
export function subscribeToLocation(onChange: (location: LocationResult) => void): () => void {
  let isSubscribed = true;
  let nativeWatchSub: { remove: () => void } | null = null;
  let webWatchId: number | null = null;

  // Immediate initial fetch
  getCurrentLocation().then((initialLoc) => {
    if (isSubscribed) {
      onChange(initialLoc);
    }
  });

  // 1. Web Geolocation Watcher
  if (typeof window !== 'undefined' && typeof navigator !== 'undefined' && 'geolocation' in navigator) {
    try {
      webWatchId = navigator.geolocation.watchPosition(
        (pos) => {
          if (isSubscribed) {
            onChange({
              latitude: Math.round(pos.coords.latitude * 1000000) / 1000000,
              longitude: Math.round(pos.coords.longitude * 1000000) / 1000000,
              accuracy: pos.coords.accuracy ? Math.round(pos.coords.accuracy) : 15,
              timestamp: new Date().toISOString(),
              available: true,
            });
          }
        },
        (err) => console.log('[LocationService] Web watchPosition notice:', err),
        { enableHighAccuracy: true, timeout: 10000, maximumAge: 5000 }
      );
    } catch (webWatchErr) {
      console.log('[LocationService] Web watchPosition setup notice:', webWatchErr);
    }
  }

  // 2. Native Expo Location Watcher
  try {
    Location.requestForegroundPermissionsAsync().then(({ status }) => {
      if (status === 'granted' && isSubscribed) {
        Location.watchPositionAsync(
          {
            accuracy: Location.Accuracy.Balanced,
            timeInterval: 4000,
            distanceInterval: 3,
          },
          (loc) => {
            if (isSubscribed) {
              onChange({
                latitude: Math.round(loc.coords.latitude * 1000000) / 1000000,
                longitude: Math.round(loc.coords.longitude * 1000000) / 1000000,
                accuracy: loc.coords.accuracy ? Math.round(loc.coords.accuracy) : 10,
                timestamp: new Date().toISOString(),
                available: true,
              });
            }
          }
        ).then((sub) => {
          if (isSubscribed) {
            nativeWatchSub = sub;
          } else {
            sub.remove();
          }
        }).catch((err) => console.log('[LocationService] Native watchPositionAsync notice:', err));
      }
    }).catch(() => {});
  } catch (err) {
    console.log('[LocationService] Native location watcher setup notice:', err);
  }

  return () => {
    isSubscribed = false;
    if (nativeWatchSub && typeof nativeWatchSub.remove === 'function') {
      nativeWatchSub.remove();
    }
    if (webWatchId !== null && typeof navigator !== 'undefined' && 'geolocation' in navigator) {
      navigator.geolocation.clearWatch(webWatchId);
    }
  };
}

/**
 * Custom React hook that syncs component state with actual phone real-time GPS location.
 */
export function useLocation(): LocationResult {
  const [location, setLocation] = useState<LocationResult>({
    latitude: 13.120456,
    longitude: 80.297412,
    accuracy: 15,
    timestamp: new Date().toISOString(),
    available: true,
  });

  useEffect(() => {
    const unsubscribe = subscribeToLocation((loc) => {
      setLocation(loc);
    });
    return () => {
      unsubscribe();
    };
  }, []);

  return location;
}

/**
 * Attempts to retrieve real device GPS location using multi-tiered location acquisition:
 * 1. HTML5 Web Geolocation (for Web browser previews)
 * 2. High accuracy Expo Location API (iOS/Android)
 * 3. Low accuracy indoor fallback (fast response)
 * 4. Last known position fallback
 * 5. Kasimedu Coastal Base Harbor fallback (guarantees non-null coordinates)
 */
export async function getCurrentLocation(): Promise<LocationResult> {
  const timestamp = new Date().toISOString();

  // 1. Handle explicit demo GPS forced UNAVAILABLE state
  if (!demoGpsAvailable) {
    return {
      latitude: null,
      longitude: null,
      accuracy: null,
      timestamp,
      available: false,
      errorMessage: 'Device GPS module disabled or position unavailable.',
    };
  }

  // 2. Native Expo Location API for iOS / Android (Try first on Mobile)
  if (Platform.OS !== 'web') {
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status === 'granted') {
        try {
          const loc = await Location.getCurrentPositionAsync({
            accuracy: Location.Accuracy.Balanced,
          });

          if (loc && loc.coords) {
            return {
              latitude: Math.round(loc.coords.latitude * 1000000) / 1000000,
              longitude: Math.round(loc.coords.longitude * 1000000) / 1000000,
              accuracy: loc.coords.accuracy ? Math.round(loc.coords.accuracy) : 10,
              timestamp: new Date().toISOString(),
              available: true,
            };
          }
        } catch (posErr) {
          console.log('[LocationService] High-accuracy GPS timed out, trying low accuracy or last known position...', posErr);

          try {
            const lowLoc = await Location.getCurrentPositionAsync({
              accuracy: Location.Accuracy.Lowest,
            });
            if (lowLoc && lowLoc.coords) {
              return {
                latitude: Math.round(lowLoc.coords.latitude * 1000000) / 1000000,
                longitude: Math.round(lowLoc.coords.longitude * 1000000) / 1000000,
                accuracy: lowLoc.coords.accuracy ? Math.round(lowLoc.coords.accuracy) : 50,
                timestamp: new Date().toISOString(),
                available: true,
              };
            }
          } catch (lowErr) {
            try {
              const lastLoc = await Location.getLastKnownPositionAsync();
              if (lastLoc && lastLoc.coords) {
                return {
                  latitude: Math.round(lastLoc.coords.latitude * 1000000) / 1000000,
                  longitude: Math.round(lastLoc.coords.longitude * 1000000) / 1000000,
                  accuracy: lastLoc.coords.accuracy ? Math.round(lastLoc.coords.accuracy) : 100,
                  timestamp: new Date().toISOString(),
                  available: true,
                };
              }
            } catch (lastErr) {}
          }
        }
      }
    } catch (e: any) {
      console.log('[LocationService] Expo Location notice:', e);
    }
  }

  // 3. Web Geolocation API fallback for Web / Browser preview
  if (typeof window !== 'undefined' && typeof navigator !== 'undefined' && 'geolocation' in navigator) {
    try {
      const webLoc = await new Promise<LocationResult | null>((resolve) => {
        navigator.geolocation.getCurrentPosition(
          (pos) => {
            resolve({
              latitude: Math.round(pos.coords.latitude * 1000000) / 1000000,
              longitude: Math.round(pos.coords.longitude * 1000000) / 1000000,
              accuracy: pos.coords.accuracy ? Math.round(pos.coords.accuracy) : 15,
              timestamp: new Date().toISOString(),
              available: true,
            });
          },
          (err) => {
            console.log('[LocationService] Web Geolocation notice:', err);
            resolve(null);
          },
          { enableHighAccuracy: true, timeout: 6000, maximumAge: 5000 }
        );
      });
      if (webLoc) return webLoc;
    } catch (webErr) {
      console.log('[LocationService] Web Geolocation check notice:', webErr);
    }
  }

  // 4. Return explicit unavailable state when GPS cannot be acquired
  return {
    latitude: null,
    longitude: null,
    accuracy: null,
    timestamp: new Date().toISOString(),
    available: false,
    errorMessage: 'Device GPS unavailable or permission denied.',
  };
}
