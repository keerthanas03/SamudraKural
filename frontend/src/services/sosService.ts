import AsyncStorage from '@react-native-async-storage/async-storage';
import { apiFetch } from './api';
import {
  EmergencyType,
  LocationResult,
  OfflineSOSPacket,
  OfflineSOSResponsePacket,
  SOSDispatchResult,
  SOSLifecycleStatus,
  SOSDeliveryStatus,
  SOSPriority,
} from '../types/sos';
import { FishermanUser } from '../types';
import { transportManager } from './transportManager';
import { websocketService } from './websocketService';
import { offlineP2PTransport } from './transports/offlineP2PTransport';
import { generatePublicSOSId, getOrCreateDeviceId } from '../utils/deviceId';

const ACTIVE_SOS_KEY = '@samudra_kural_active_sos';
const RECENT_RESPONSES_KEY = '@samudra_kural_recent_responses';

export type SOSStatusListener = (status: SOSLifecycleStatus, payload?: any) => void;
export type SOSResponseListener = (response: any) => void;

class SOSService {
  private statusListeners: Set<SOSStatusListener> = new Set();
  private responseListeners: Set<SOSResponseListener> = new Set();
  private activePacket: OfflineSOSPacket | null = null;
  private currentStatus: SOSLifecycleStatus = 'ACTIVE';
  private initialized: boolean = false;

  constructor() {
    this.init();
  }

  public init() {
    if (this.initialized) return;
    this.initialized = true;

    // 1. Subscribe to WebSocket real-time events from backend
    websocketService.subscribe('SOS_RESPONSE_RECEIVED', (payload) => {
      console.log('[SOSService] Received real-time SOS response via WS:', payload);
      this.handleIncomingResponse(payload);
    });

    websocketService.subscribe('SOS_STATUS_UPDATED', (payload) => {
      console.log('[SOSService] Received real-time SOS status update via WS:', payload);
      if (payload && payload.status) {
        this.updateLocalStatus(payload.status, payload);
      }
    });

    websocketService.subscribe('RESCUE_MISSION_DISPATCHED', (payload) => {
      console.log('[SOSService] Rescue mission dispatched for SOS:', payload);
      this.updateLocalStatus('RESCUE_ASSIGNED', { rescue_mission: payload });
    });

    websocketService.subscribe('RESCUE_MISSION_UPDATED', (payload) => {
      console.log('[SOSService] Rescue mission updated:', payload);
      if (payload.status === 'COMPLETED') {
        this.updateLocalStatus('RESOLVED', { rescue_mission: payload });
      } else {
        this.updateLocalStatus('RESCUE_IN_PROGRESS', { rescue_mission: payload });
      }
    });

    // 2. Subscribe to Offline P2P responses
    offlineP2PTransport.onResponseReceived((response) => {
      console.log('[SOSService] Received offline P2P response:', response);
      this.handleIncomingResponse(response);
    });
  }

  public onStatusChanged(listener: SOSStatusListener): () => void {
    this.statusListeners.add(listener);
    return () => {
      this.statusListeners.delete(listener);
    };
  }

  public onResponseReceived(listener: SOSResponseListener): () => void {
    this.responseListeners.add(listener);
    return () => {
      this.responseListeners.delete(listener);
    };
  }

  private updateLocalStatus(newStatus: SOSLifecycleStatus, extra?: any) {
    this.currentStatus = newStatus;
    if (this.activePacket) {
      this.activePacket.sos_status = newStatus;
      this.saveActiveSOS(this.activePacket);
    }
    this.statusListeners.forEach((l) => {
      try {
        l(newStatus, extra);
      } catch (e) {
        console.error('[SOSService] Status listener error:', e);
      }
    });
  }

  private handleIncomingResponse(response: any) {
    // If response matches active SOS
    if (this.activePacket && response.public_sos_id === this.activePacket.public_sos_id) {
      if (response.response === 'YES_HELP') {
        // Responder accepted to help -> transition status to HELP_ON_THE_WAY
        this.updateLocalStatus('HELP_ON_THE_WAY', { responder: response });
      }
    }

    this.responseListeners.forEach((l) => {
      try {
        l(response);
      } catch (e) {
        console.error('[SOSService] Response listener error:', e);
      }
    });
  }

  /**
   * Build standardized emergency packet with globally unique public_sos_id
   */
  public async buildEmergencyPacket(
    location: LocationResult,
    emergencyType: EmergencyType = 'General Emergency',
    user?: FishermanUser | null,
    batteryLevel: number = 100,
    peopleAffected: number = 1,
    description?: string,
    priority: SOSPriority = 'CRITICAL'
  ): Promise<OfflineSOSPacket> {
    const public_sos_id = generatePublicSOSId();
    const deviceId = await getOrCreateDeviceId();
    const now = new Date().toISOString();

    const userIdNum = user?.id ? parseInt(String(user.id).replace(/\D/g, ''), 10) || 1 : 1;

    return {
      packet_version: 1,
      packet_type: 'SOS_ALERT',
      public_sos_id,
      origin_fisherman_id: userIdNum,
      origin_device_id: deviceId,
      origin_fisherman_name: user?.name,
      origin_fisherman_phone: user?.phone,
      emergency_type: emergencyType,
      priority,
      sos_status: 'ACTIVE',
      delivery_status: 'ONLINE',
      latitude: location.latitude,
      longitude: location.longitude,
      accuracy_meters: location.accuracy,
      battery_percent: batteryLevel,
      people_affected: peopleAffected,
      description: description || `Distress beacon triggered. Type: ${emergencyType}`,
      created_at: now,
      last_updated_at: now,
      hop_count: 0,
      max_hops: 5,
      ttl_minutes: 60,
    };
  }

  /**
   * Dispatches an SOS via TransportManager (exactly ONE dispatch path).
   */
  public async sendSOS(packet: OfflineSOSPacket): Promise<SOSDispatchResult> {
    this.activePacket = packet;
    this.currentStatus = 'ACTIVE';

    try {
      const result = await transportManager.sendSOS(packet);
      await this.saveActiveSOS(packet);
      return result;
    } catch (error) {
      // If dispatch throws, packet is already queued offline if offlineP2P was used
      await this.saveActiveSOS(packet);
      throw error;
    }
  }

  /**
   * Responds to an incoming SOS (YES_HELP / RELAY_ONLY / NO).
   */
  public async respondToSOS(
    public_sos_id: string,
    response: 'YES_HELP' | 'RELAY_ONLY' | 'NO',
    location?: LocationResult,
    user?: FishermanUser | null,
    message?: string
  ): Promise<boolean> {
    const deviceId = await getOrCreateDeviceId();
    const userIdNum = user?.id ? parseInt(String(user.id).replace(/\D/g, ''), 10) || 1 : 1;

    const responsePacket: OfflineSOSResponsePacket = {
      public_sos_id,
      responder_fisherman_id: userIdNum,
      responder_device_id: deviceId,
      responder_name: user?.name,
      response,
      latitude: location?.latitude,
      longitude: location?.longitude,
      message:
        message ||
        (response === 'YES_HELP'
          ? 'I am responding and heading to your location.'
          : response === 'RELAY_ONLY'
          ? 'Relaying SOS distress signal to nearby vessels.'
          : 'Unable to assist at this time.'),
      created_at: new Date().toISOString(),
      hop_count: 0,
      max_hops: 5,
      ttl_minutes: 60,
      packet_version: 1,
    };

    return transportManager.sendResponse(responsePacket);
  }

  /**
   * Cancels an active SOS alert.
   */
  public async cancelSOS(public_sos_id?: string, reason?: string): Promise<boolean> {
    const targetId = public_sos_id || this.activePacket?.public_sos_id;
    if (targetId) {
      try {
        await transportManager.cancelSOS(targetId, reason);
      } catch (e) {
        console.warn('[SOSService] Cancel dispatch warning:', e);
      }
    }

    this.activePacket = null;
    this.currentStatus = 'CANCELLED';
    await this.clearActiveSOS();
    this.statusListeners.forEach((l) => l('CANCELLED'));
    return true;
  }

  /**
   * Updates coordinates of active distress session.
   */
  public async updateLocation(location: LocationResult): Promise<boolean> {
    if (!this.activePacket || location.latitude === null || location.longitude === null) {
      return false;
    }

    this.activePacket.latitude = location.latitude;
    this.activePacket.longitude = location.longitude;
    this.activePacket.accuracy_meters = location.accuracy;
    this.activePacket.last_updated_at = new Date().toISOString();
    await this.saveActiveSOS(this.activePacket);

    return transportManager.updateLocation(
      this.activePacket.public_sos_id,
      location.latitude,
      location.longitude,
      location.accuracy ?? undefined
    );
  }

  // --- Active SOS Storage Helpers ---

  public async saveActiveSOS(packet: OfflineSOSPacket): Promise<void> {
    try {
      this.activePacket = packet;
      await AsyncStorage.setItem(ACTIVE_SOS_KEY, JSON.stringify(packet));
    } catch (err) {
      console.error('[SOSService] Error saving active SOS:', err);
    }
  }

  public async getActiveSOS(): Promise<OfflineSOSPacket | null> {
    try {
      if (this.activePacket) return this.activePacket;
      const json = await AsyncStorage.getItem(ACTIVE_SOS_KEY);
      if (json) {
        this.activePacket = JSON.parse(json);
        return this.activePacket;
      }
      return null;
    } catch (err) {
      console.error('[SOSService] Error reading active SOS:', err);
      return null;
    }
  }

  public async clearActiveSOS(): Promise<void> {
    try {
      this.activePacket = null;
      await AsyncStorage.removeItem(ACTIVE_SOS_KEY);
    } catch (err) {
      console.error('[SOSService] Error clearing active SOS:', err);
    }
  }

  public async fetchMyActiveSOS(): Promise<any | null> {
    try {
      const data = await apiFetch('/sos/user/my-active');
      return data;
    } catch (err) {
      return null;
    }
  }
}

export const sosService = new SOSService();
