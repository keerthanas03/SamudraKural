import { networkService } from './networkService';
import { onlineTransport } from './transports/onlineTransport';
import { offlineP2PTransport } from './transports/offlineP2PTransport';
import {
  ISOSCommunicationTransport,
  TransportType,
  TransportStatus,
} from './transports/transportInterface';
import {
  OfflineSOSPacket,
  OfflineSOSResponsePacket,
  SOSDispatchResult,
} from '../types/sos';

class TransportManager {
  public async selectTransport(): Promise<ISOSCommunicationTransport> {
    const isOnline = await networkService.getIsOnline();
    if (isOnline) {
      return onlineTransport;
    }
    return offlineP2PTransport;
  }

  public async getActiveTransportType(): Promise<TransportType> {
    const isOnline = await networkService.getIsOnline();
    return isOnline ? 'ONLINE' : 'OFFLINE_P2P';
  }

  public async getStatus(): Promise<TransportStatus> {
    const transport = await this.selectTransport();
    return transport.getStatus();
  }

  public async sendSOS(packet: OfflineSOSPacket): Promise<SOSDispatchResult> {
    const transport = await this.selectTransport();
    console.log(`[TransportManager] Routing SOS ${packet.public_sos_id} via ${transport.getTransportType()}`);
    return transport.sendSOS(packet);
  }

  public async sendResponse(response: OfflineSOSResponsePacket): Promise<boolean> {
    const transport = await this.selectTransport();
    console.log(`[TransportManager] Routing Response for ${response.public_sos_id} via ${transport.getTransportType()}`);
    return transport.sendResponse(response);
  }

  public async cancelSOS(public_sos_id: string, reason?: string): Promise<boolean> {
    const transport = await this.selectTransport();
    return transport.cancelSOS(public_sos_id, reason);
  }

  public async updateLocation(
    public_sos_id: string,
    latitude: number,
    longitude: number,
    accuracy?: number
  ): Promise<boolean> {
    const transport = await this.selectTransport();
    return transport.updateLocation(public_sos_id, latitude, longitude, accuracy);
  }
}

export const transportManager = new TransportManager();
