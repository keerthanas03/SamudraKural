import AsyncStorage from '@react-native-async-storage/async-storage';
import * as SecureStore from 'expo-secure-store';
import { SupportedLanguage, FishermanUser } from '../types';

const LANGUAGE_KEY = '@samudra_kural_language';
const HAS_LAUNCHED_KEY = '@samudra_kural_has_launched';
const TOKEN_KEY = 'samudra_kural_access_token';
const USER_KEY = 'samudra_kural_user_data';

// --- Language Storage (AsyncStorage) ---
export const saveLanguagePreference = async (lang: SupportedLanguage): Promise<void> => {
  try {
    await AsyncStorage.setItem(LANGUAGE_KEY, lang);
  } catch (error) {
    console.error('Error saving language preference:', error);
  }
};

export const getLanguagePreference = async (): Promise<SupportedLanguage | null> => {
  try {
    const lang = await AsyncStorage.getItem(LANGUAGE_KEY);
    return (lang as SupportedLanguage) || null;
  } catch (error) {
    console.error('Error reading language preference:', error);
    return null;
  }
};

export const setHasLaunched = async (): Promise<void> => {
  try {
    await AsyncStorage.setItem(HAS_LAUNCHED_KEY, 'true');
  } catch (error) {
    console.error('Error setting launch flag:', error);
  }
};

export const getHasLaunched = async (): Promise<boolean> => {
  try {
    const val = await AsyncStorage.getItem(HAS_LAUNCHED_KEY);
    return val === 'true';
  } catch (error) {
    return false;
  }
};

// --- Secure Authentication Token & Session Storage (Expo SecureStore) ---
export const saveAuthToken = async (token: string): Promise<void> => {
  try {
    await SecureStore.setItemAsync(TOKEN_KEY, token);
  } catch (error) {
    console.error('Error saving auth token to SecureStore:', error);
  }
};

export const getAuthToken = async (): Promise<string | null> => {
  try {
    return await SecureStore.getItemAsync(TOKEN_KEY);
  } catch (error) {
    console.error('Error retrieving auth token:', error);
    return null;
  }
};

export const deleteAuthToken = async (): Promise<void> => {
  try {
    await SecureStore.deleteItemAsync(TOKEN_KEY);
  } catch (error) {
    console.error('Error deleting auth token:', error);
  }
};

const ASYNC_USER_KEY = '@samudra_kural_user_session';

export const saveUserSession = async (user: FishermanUser): Promise<void> => {
  try {
    const json = JSON.stringify(user);
    await AsyncStorage.setItem(ASYNC_USER_KEY, json);
    try {
      await SecureStore.setItemAsync(USER_KEY, json);
    } catch (e) {}
  } catch (error) {
    console.error('Error saving user session:', error);
  }
};

export const getUserSession = async (): Promise<FishermanUser | null> => {
  try {
    const asyncJson = await AsyncStorage.getItem(ASYNC_USER_KEY);
    if (asyncJson) {
      return JSON.parse(asyncJson);
    }
    const secureJson = await SecureStore.getItemAsync(USER_KEY);
    if (secureJson) {
      return JSON.parse(secureJson);
    }
  } catch (error) {
    console.error('Error reading user session:', error);
  }
  return null;
};

export const clearSession = async (): Promise<void> => {
  try {
    await AsyncStorage.removeItem(ASYNC_USER_KEY);
    await AsyncStorage.removeItem(ASYNC_CG_OFFICER_KEY);
    await SecureStore.deleteItemAsync(TOKEN_KEY);
    await SecureStore.deleteItemAsync(USER_KEY);
  } catch (error) {
    console.error('Error clearing session:', error);
  }
};

// --- Coastal Guard Officer Session & Account Storage ---
export interface CGOfficerUser {
  officerId: string;
  rank: string;
  station: string;
  badgeNo?: string;
  clearanceLevel?: string;
}

const ASYNC_CG_OFFICER_KEY = '@samudra_kural_cg_officer_session';
const SECURE_CG_OFFICER_KEY = 'samudra_kural_cg_officer_data';
const ASYNC_CG_ACCOUNTS_KEY = '@samudra_kural_cg_registered_accounts';

export const saveCGOfficerSession = async (officer: any): Promise<void> => {
  try {
    const json = JSON.stringify(officer);
    await AsyncStorage.setItem(ASYNC_CG_OFFICER_KEY, json);
    try {
      await SecureStore.setItemAsync(SECURE_CG_OFFICER_KEY, json);
    } catch (e) {}
  } catch (error) {
    console.error('Error saving CG officer session:', error);
  }
};

export const getCGOfficerSession = async (): Promise<any | null> => {
  try {
    const asyncJson = await AsyncStorage.getItem(ASYNC_CG_OFFICER_KEY);
    if (asyncJson) {
      return JSON.parse(asyncJson);
    }
    const secureJson = await SecureStore.getItemAsync(SECURE_CG_OFFICER_KEY);
    if (secureJson) {
      return JSON.parse(secureJson);
    }
  } catch (error) {}
  return null;
};

export const clearCGOfficerSession = async (): Promise<void> => {
  try {
    await AsyncStorage.removeItem(ASYNC_CG_OFFICER_KEY);
    await SecureStore.deleteItemAsync(SECURE_CG_OFFICER_KEY);
  } catch (error) {}
};


const ASYNC_FISHERMAN_ACCOUNTS_KEY = '@samudra_kural_fisherman_registered_accounts';

const DEFAULT_FISHERMAN_ACCOUNTS: (FishermanUser & { pin: string })[] = [];

const DEFAULT_CG_ACCOUNTS: any[] = [];

export const saveFishermanRegisteredAccounts = async (accounts: any[]): Promise<void> => {
  try {
    await AsyncStorage.setItem(ASYNC_FISHERMAN_ACCOUNTS_KEY, JSON.stringify(accounts));
  } catch (error) {
    console.error('Error saving fisherman registered accounts:', error);
  }
};

export const getFishermanRegisteredAccounts = async (): Promise<any[]> => {
  try {
    const json = await AsyncStorage.getItem(ASYNC_FISHERMAN_ACCOUNTS_KEY);
    if (json) {
      const stored = JSON.parse(json);
      if (Array.isArray(stored)) {
        // Filter out any previously stored mock Ramanan account
        const cleaned = stored.filter(a => a.phone !== '9876543210' && a.name !== 'Ramanan K. (Fisherman)');
        return cleaned;
      }
    }
  } catch (error) {}
  return DEFAULT_FISHERMAN_ACCOUNTS;
};

export const registerFishermanAccount = async (account: any): Promise<void> => {
  const current = await getFishermanRegisteredAccounts();
  const filtered = current.filter(a => a.phone !== account.phone);
  const updated = [account, ...filtered];
  await saveFishermanRegisteredAccounts(updated);
};

export const saveCGRegisteredAccounts = async (accounts: any[]): Promise<void> => {
  try {
    await AsyncStorage.setItem(ASYNC_CG_ACCOUNTS_KEY, JSON.stringify(accounts));
  } catch (error) {
    console.error('Error saving CG registered accounts:', error);
  }
};

export const getCGRegisteredAccounts = async (): Promise<any[]> => {
  try {
    const json = await AsyncStorage.getItem(ASYNC_CG_ACCOUNTS_KEY);
    if (json) {
      const stored = JSON.parse(json);
      if (Array.isArray(stored)) {
        // Filter out any previously stored mock Cmdr. V. Raman account
        const cleaned = stored.filter(a => a.serviceId !== 'CG-9402' && a.phone !== '9444099999');
        return cleaned;
      }
    }
  } catch (error) {}
  return DEFAULT_CG_ACCOUNTS;
};

export const registerCGOfficerAccount = async (account: any): Promise<void> => {
  const current = await getCGRegisteredAccounts();
  const filtered = current.filter(a => a.serviceId !== account.serviceId && a.phone !== account.phone);
  const updated = [account, ...filtered];
  await saveCGRegisteredAccounts(updated);
};
