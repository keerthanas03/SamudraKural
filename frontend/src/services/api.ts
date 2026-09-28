import Constants from 'expo-constants';
import { Platform } from 'react-native';
import { getAuthToken } from '../storage/storage';

function resolveApiBaseUrl(): string {
  if (Platform.OS === 'web') {
    return 'http://localhost:8000/api/v1';
  }

  // 1. Check Expo Go hostUri / debuggerHost dynamically
  const debuggerHost =
    Constants.expoConfig?.hostUri ||
    (Constants as any).manifest?.debuggerHost ||
    (Constants as any).manifest2?.extra?.expoGo?.debuggerHost;

  if (debuggerHost) {
    const ip = debuggerHost.split(':')[0];
    if (ip && ip !== 'localhost' && ip !== '127.0.0.1') {
      return `http://${ip}:8000/api/v1`;
    }
  }

  // 2. Check environment variable
  if (process.env.EXPO_PUBLIC_API_URL) {
    return process.env.EXPO_PUBLIC_API_URL;
  }

  // 3. Fallback to current machine WiFi IP
  return 'http://192.168.0.5:8000/api/v1';
}

// Base API URL configured for Expo environment with dynamic host detection
export const API_BASE_URL = resolveApiBaseUrl();

export class ApiError extends Error {
  status: number;
  data: any;

  constructor(message: string, status: number, data?: any) {
    super(message);
    this.status = status;
    this.data = data;
    this.name = 'ApiError';
  }
}

export interface ApiFetchOptions extends RequestInit {
  timeoutMs?: number;
}

export async function apiFetch<T>(endpoint: string, options: ApiFetchOptions = {}): Promise<T> {
  const token = await getAuthToken();
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    'Accept': 'application/json',
    ...(options.headers as Record<string, string> || {}),
  };

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const url = `${API_BASE_URL}${endpoint.startsWith('/') ? endpoint : '/' + endpoint}`;

  // Smart dynamic timeout: STT, Voice, AI & Chat endpoints get 45,000ms (45s)
  // Standard endpoints use options.timeoutMs or default to 15,000ms (15s)
  const isHeavyEndpoint =
    endpoint.includes('/stt') ||
    endpoint.includes('/voice') ||
    endpoint.includes('/bot') ||
    endpoint.includes('/chat') ||
    endpoint.includes('/ai');

  const timeoutMs = options.timeoutMs ?? (isHeavyEndpoint ? 45000 : 15000);
  const { timeoutMs: _, ...fetchOptions } = options;

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(url, {
      ...fetchOptions,
      headers,
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    const data = await response.json().catch(() => null);

    if (!response.ok) {
      const errorMsg = data?.detail || data?.message || 'Server request failed';
      throw new ApiError(errorMsg, response.status, data);
    }

    return data as T;
  } catch (error: any) {
    clearTimeout(timeoutId);
    if (error instanceof ApiError) {
      throw error;
    }
    const msg = (error?.message || '').toLowerCase();
    const isTimeoutOrCancel =
      error.name === 'AbortError' ||
      msg.includes('canceled') ||
      msg.includes('cancelled') ||
      msg.includes('aborted') ||
      msg.includes('timeout');

    if (isTimeoutOrCancel) {
      throw new ApiError(
        'Request timed out or connection was canceled. Please check backend server and connection.',
        0,
        { isOffline: true }
      );
    }
    throw new ApiError(
      msg.includes('network request failed')
        ? 'Unable to connect to backend server. Please check Wi-Fi network and ensure backend is running.'
        : error.message || 'Unable to connect to backend server.',
      0,
      { isOffline: true }
    );
  }
}
