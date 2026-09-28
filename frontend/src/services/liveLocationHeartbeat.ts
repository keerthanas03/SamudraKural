/**
 * Live Location Heartbeat Service (Foreground)
 * 
 * Periodically obtains the device's real GPS position and phone battery level,
 * transmitting live telemetry to POST /api/v1/locations/live.
 * 
 * NOTE: Foreground live-location heartbeat is implemented.
 * Background continuous tracking requires additional background location permissions & tasks.
 */

import { getCurrentLocation, getRealBatteryLevel } from './locationService';
import { apiFetch } from './api';
import { LiveLocationHeartbeatPayload, LiveLocationResponse } from '../types/location';

export type HeartbeatMode = 'idle' | 'normal' | 'high_frequency';

const NORMAL_INTERVAL_MS = 30000;       // 30 seconds
const HIGH_FREQ_INTERVAL_MS = 5000;     // 5 seconds (active SOS prep)

class LiveLocationHeartbeatService {
  private timerId: any = null;
  private currentMode: HeartbeatMode = 'idle';
  private isSending: boolean = false;
  private lastSentLocation: LiveLocationHeartbeatPayload | null = null;
  private lastServerResponse: LiveLocationResponse | null = null;

  /**
   * Starts normal 30-second live location heartbeat.
   * Safe against multiple calls — will not spawn duplicate timers.
   */
  public startNormal(): void {
    if (this.currentMode === 'normal' && this.timerId !== null) {
      return; // Already running normal heartbeat
    }
    this.startInterval('normal', NORMAL_INTERVAL_MS);
  }

  /**
   * Starts high-frequency 5-second live location heartbeat (e.g. for active emergency).
   * Safe against duplicate invocations.
   */
  public startHighFrequency(): void {
    if (this.currentMode === 'high_frequency' && this.timerId !== null) {
      return; // Already running high-frequency heartbeat
    }
    this.startInterval('high_frequency', HIGH_FREQ_INTERVAL_MS);
  }

  /**
   * Stops the active live location heartbeat and cleans up all timers.
   */
  public stop(): void {
    if (this.timerId !== null) {
      clearInterval(this.timerId);
      this.timerId = null;
    }
    this.currentMode = 'idle';
  }

  /**
   * Returns whether the heartbeat service is currently active.
   */
  public isHeartbeatActive(): boolean {
    return this.timerId !== null && this.currentMode !== 'idle';
  }

  /**
   * Returns current operational mode ('idle', 'normal', 'high_frequency').
   */
  public getMode(): HeartbeatMode {
    return this.currentMode;
  }

  /**
   * Returns the last recorded local heartbeat payload.
   */
  public getLastSentLocation(): LiveLocationHeartbeatPayload | null {
    return this.lastSentLocation;
  }

  /**
   * Returns the last confirmed server response.
   */
  public getLastServerResponse(): LiveLocationResponse | null {
    return this.lastServerResponse;
  }

  /**
   * Immediately acquires GPS and sends a live location heartbeat to backend.
   * Gracefully handles network failures without pretending backend delivery.
   */
  public async sendHeartbeatNow(): Promise<LiveLocationResponse | null> {
    if (this.isSending) {
      return null;
    }

    this.isSending = true;
    try {
      const [loc, battery] = await Promise.all([
        getCurrentLocation(),
        getRealBatteryLevel(),
      ]);

      if (!loc.available || loc.latitude === null || loc.longitude === null) {
        // GPS unavailable - do not transmit fake or missing coordinates
        return null;
      }

      const payload: LiveLocationHeartbeatPayload = {
        latitude: loc.latitude,
        longitude: loc.longitude,
        accuracy_meters: loc.accuracy ?? 15.0,
        battery_percent: battery,
        recorded_at: loc.timestamp || new Date().toISOString(),
      };

      this.lastSentLocation = payload;

      const response = await apiFetch<LiveLocationResponse>('/locations/live', {
        method: 'POST',
        body: JSON.stringify(payload),
      });

      this.lastServerResponse = response;
      return response;
    } catch (error: any) {
      // In offline conditions, REST heartbeat cannot reach FastAPI.
      // Retain latest local readings without simulating backend delivery.
      console.warn('[LiveLocationHeartbeat] Heartbeat transmission notice:', error?.message || error);
      return null;
    } finally {
      this.isSending = false;
    }
  }

  /**
   * Deactivates live location tracking for the authenticated user on backend.
   */
  public async deactivateLiveLocation(): Promise<boolean> {
    this.stop();
    try {
      await apiFetch<{ status: string }>('/locations/live/deactivate', {
        method: 'POST',
      });
      return true;
    } catch (error) {
      console.warn('[LiveLocationHeartbeat] Deactivation notice:', error);
      return false;
    }
  }

  private startInterval(mode: HeartbeatMode, intervalMs: number): void {
    // Clear any existing timer before starting new interval
    if (this.timerId !== null) {
      clearInterval(this.timerId);
      this.timerId = null;
    }

    this.currentMode = mode;

    // Trigger an immediate initial heartbeat
    this.sendHeartbeatNow().catch(() => {});

    // Set recurring timer
    this.timerId = setInterval(() => {
      this.sendHeartbeatNow().catch(() => {});
    }, intervalMs);
  }
}

export const liveLocationHeartbeat = new LiveLocationHeartbeatService();
