import AsyncStorage from '@react-native-async-storage/async-storage';

const DEVICE_ID_KEY = '@samudra_kural_device_unique_id';

function generateSimpleUUID(): string {
  // RFC4122 v4 UUID generator without native crypto dependency
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

let cachedDeviceId: string | null = null;

export async function getOrCreateDeviceId(): Promise<string> {
  if (cachedDeviceId) {
    return cachedDeviceId;
  }

  try {
    const existing = await AsyncStorage.getItem(DEVICE_ID_KEY);
    if (existing) {
      cachedDeviceId = existing;
      return existing;
    }

    const newId = `SK-DEV-${generateSimpleUUID()}`;
    await AsyncStorage.setItem(DEVICE_ID_KEY, newId);
    cachedDeviceId = newId;
    return newId;
  } catch (error) {
    console.warn('[DeviceID] Error accessing storage, generating fallback:', error);
    return `SK-DEV-${generateSimpleUUID()}`;
  }
}

export function generatePublicSOSId(): string {
  return generateSimpleUUID();
}
