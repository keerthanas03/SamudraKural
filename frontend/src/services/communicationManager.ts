import { CommunicationStatus, SOSPacket, MockSendResult, LocationResult } from '../types/sos';

// Demo connection state (default online)
let demoCommunicationStatus: CommunicationStatus = 'online';
let listenerCallback: ((status: CommunicationStatus) => void) | null = null;

export function setDemoCommunicationStatus(
  status: CommunicationStatus,
  onStatusChanged?: (status: CommunicationStatus) => void
): void {
  demoCommunicationStatus = status;
  if (listenerCallback) {
    listenerCallback(status);
  }
  if (onStatusChanged) {
    onStatusChanged(status);
  }
}

export function registerCommunicationListener(cb: (status: CommunicationStatus) => void): void {
  listenerCallback = cb;
}

/**
 * Interface definition for communication hardware/channel drivers.
 * Future satellite hardware (e.g. ISRO DAT-SG) or cellular/maritime VHF radio backends
 * will implement this interface.
 */
export interface ICommunicationService {
  getStatus(): CommunicationStatus;
  sendPacket(packet: SOSPacket): Promise<MockSendResult>;
  sendLocationUpdate(sosId: string, location: LocationResult): Promise<MockSendResult>;
  sendCancellation(sosId: string): Promise<MockSendResult>;
}

/**
 * Mock Communication Service Implementation for Expo Go prototype.
 * Clearly labeled as demo simulation layer to avoid false satellite claims.
 */
class MockCommunicationService implements ICommunicationService {
  getStatus(): CommunicationStatus {
    return demoCommunicationStatus;
  }

  async sendPacket(packet: SOSPacket): Promise<MockSendResult> {
    // Simulate brief network latency (1 second)
    await new Promise((res) => setTimeout(res, 1000));

    if (demoCommunicationStatus === 'offline') {
      throw new Error('NETWORK_OFFLINE: Communication link unavailable.');
    }

    return {
      success: true,
      referenceId: packet.id || `SOS-${Date.now().toString().slice(-6)}`,
      timestamp: new Date().toISOString(),
      message: 'Emergency alert dispatched to Maritime Rescue Coordination Centre.',
    };
  }

  async sendLocationUpdate(sosId: string, location: LocationResult): Promise<MockSendResult> {
    await new Promise((res) => setTimeout(res, 800));

    if (demoCommunicationStatus === 'offline') {
      throw new Error('NETWORK_OFFLINE: Unable to transmit location update while offline.');
    }

    return {
      success: true,
      referenceId: sosId,
      timestamp: new Date().toISOString(),
      message: 'Active emergency location updated successfully.',
    };
  }

  async sendCancellation(sosId: string): Promise<MockSendResult> {
    await new Promise((res) => setTimeout(res, 800));

    if (demoCommunicationStatus === 'offline') {
      // Even if offline, local cancellation succeeds locally
      return {
        success: true,
        referenceId: sosId,
        timestamp: new Date().toISOString(),
        message: 'SOS cancelled locally. Cancellation queue updated.',
      };
    }

    return {
      success: true,
      referenceId: sosId,
      timestamp: new Date().toISOString(),
      message: 'SOS cancellation signal broadcasted to rescue network.',
    };
  }
}

// Active provider instance (can be swapped for DATSGCommunicationService in future)
export const communicationManager: ICommunicationService = new MockCommunicationService();
