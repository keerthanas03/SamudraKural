import { apiFetch } from '../api';
import { networkService } from '../networkService';
import {
  ISOSCommunicationTransport,
  TransportType,
  TransportStatus,
} from './transportInterface';
import {
  OfflineSOSPacket,
  OfflineSOSResponsePacket,
  SOSDispatchResult,
} from '../../types/sos';

export class OnlineTransport implements ISOSCommunicationTransport {
  public getTransportType(): TransportType {
    return 'ONLINE';
  }

  public async isAvailable(): Promise<boolean> {
    return networkService.getIsOnline();
  }

  public async getStatus(): Promise<TransportStatus> {
    const online = await this.isAvailable();
    return {
      type: 'ONLINE',
      available: online,
      details: online
        ? 'Connected to Samudra Kural Cloud & Coastal Guard HQ'
        : 'No internet connection',
    };
  }

  public async sendSOS(packet: OfflineSOSPacket): Promise<SOSDispatchResult> {
    const isOnline = await this.isAvailable();
    if (!isOnline) {
      throw new Error('ONLINE_UNAVAILABLE: Device is currently offline.');
    }

    const payload = {
      public_sos_id: packet.public_sos_id,
      latitude: packet.latitude,
      longitude: packet.longitude,
      location_accuracy_meters: packet.accuracy_meters,
      battery_percent: packet.battery_percent,
      emergency_type: packet.emergency_type,
      description: packet.description || 'Emergency alert triggered from device',
      people_affected: packet.people_affected || 1,
      priority: packet.priority || 'CRITICAL',
      delivery_status: 'ONLINE',
      relay_hops: packet.hop_count || 0,
      relayed_by_device_id: packet.relayed_by_device_id,
    };

    const res = await apiFetch<any>('/sos', {
      method: 'POST',
      body: JSON.stringify(payload),
    });

    return {
      success: true,
      public_sos_id: res.public_sos_id || packet.public_sos_id,
      sos_id: res.id,
      delivery_status: 'ONLINE',
      status: res.status || 'ACTIVE',
      transport_used: 'ONLINE',
      timestamp: res.created_at || new Date().toISOString(),
      message: 'SOS dispatched to Coast Guard HQ & nearby fishermen.',
      nearby_recipients_count: res.nearby_recipients_count ?? 0,
    };
  }

  public async sendResponse(response: OfflineSOSResponsePacket): Promise<boolean> {
    const isOnline = await this.isAvailable();
    if (!isOnline) {
      throw new Error('ONLINE_UNAVAILABLE: Cannot submit online response without connection.');
    }

    await apiFetch<any>(`/sos/${response.public_sos_id}/respond`, {
      method: 'POST',
      body: JSON.stringify({
        response: response.response,
        latitude: response.latitude,
        longitude: response.longitude,
        message: response.message,
      }),
    });

    return true;
  }

  public async cancelSOS(public_sos_id: string, reason?: string): Promise<boolean> {
    const isOnline = await this.isAvailable();
    if (!isOnline) {
      throw new Error('ONLINE_UNAVAILABLE: Cannot cancel online SOS without connection.');
    }

    await apiFetch<any>(`/sos/${public_sos_id}/cancel`, {
      method: 'POST',
      body: JSON.stringify({ reason: reason || 'Cancelled by user' }),
    });

    return true;
  }

  public async updateLocation(
    public_sos_id: string,
    latitude: number,
    longitude: number,
    accuracy?: number
  ): Promise<boolean> {
    const isOnline = await this.isAvailable();
    if (!isOnline) return false;

    await apiFetch<any>(`/sos/${public_sos_id}/location`, {
      method: 'PATCH',
      body: JSON.stringify({
        latitude,
        longitude,
        accuracy_meters: accuracy,
      }),
    });

    return true;
  }
}

export const onlineTransport = new OnlineTransport();
