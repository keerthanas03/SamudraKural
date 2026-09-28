import {
  OfflineSOSPacket,
  OfflineSOSResponsePacket,
  SOSDispatchResult,
  SOSDeliveryStatus,
} from '../../types/sos';

export type TransportType = 'ONLINE' | 'OFFLINE_P2P';

export interface TransportStatus {
  available: boolean;
  type: TransportType;
  details?: string;
  peerCount?: number;
}

export interface ISOSCommunicationTransport {
  getTransportType(): TransportType;
  isAvailable(): Promise<boolean>;
  getStatus(): Promise<TransportStatus>;

  sendSOS(packet: OfflineSOSPacket): Promise<SOSDispatchResult>;
  sendResponse(response: OfflineSOSResponsePacket): Promise<boolean>;
  cancelSOS(public_sos_id: string, reason?: string): Promise<boolean>;
  updateLocation(
    public_sos_id: string,
    latitude: number,
    longitude: number,
    accuracy?: number
  ): Promise<boolean>;

  startDiscovery?(): Promise<void>;
  stopDiscovery?(): Promise<void>;
}
