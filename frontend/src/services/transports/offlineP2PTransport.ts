import AsyncStorage from '@react-native-async-storage/async-storage';
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
import { getOrCreateDeviceId } from '../../utils/deviceId';
import { nativeP2PAdapter } from './nativeP2PAdapter';

const OFFLINE_SOS_QUEUE_KEY = '@samudra_kural_offline_sos_queue';
const OFFLINE_RESPONSES_QUEUE_KEY = '@samudra_kural_offline_responses_queue';
const SEEN_PACKETS_KEY = '@samudra_kural_seen_packets';

export type OfflinePacketReceivedHandler = (packet: OfflineSOSPacket) => void;
export type OfflineResponseReceivedHandler = (response: OfflineSOSResponsePacket) => void;

export class OfflineP2PTransport implements ISOSCommunicationTransport {
  private packetListeners: Set<OfflinePacketReceivedHandler> = new Set();
  private responseListeners: Set<OfflineResponseReceivedHandler> = new Set();
  private isScanningActive: boolean = false;

  constructor() {
    this.startDiscovery().catch((err) => {
      console.log('[OfflineP2PTransport] Auto discovery note:', err);
    });
  }

  public getTransportType(): TransportType {
    return 'OFFLINE_P2P';
  }

  public async isAvailable(): Promise<boolean> {
    return true;
  }

  public async getStatus(): Promise<TransportStatus> {
    const isNative = nativeP2PAdapter.isSupported();
    const peerCount = nativeP2PAdapter.getDiscoveredPeersCount();

    if (isNative) {
      return {
        type: 'OFFLINE_P2P',
        available: true,
        details: `Native BLE P2P Active • ${peerCount} nearby peer(s) found`,
        peerCount,
      };
    }

    return {
      type: 'OFFLINE_P2P',
      available: true,
      details: 'Offline Queue & P2P Mesh Engine Ready (Expo Go Mode)',
      peerCount: 0,
    };
  }

  public onPacketReceived(handler: OfflinePacketReceivedHandler): () => void {
    this.packetListeners.add(handler);
    return () => {
      this.packetListeners.delete(handler);
    };
  }

  public onResponseReceived(handler: OfflineResponseReceivedHandler): () => void {
    this.responseListeners.add(handler);
    return () => {
      this.responseListeners.delete(handler);
    };
  }

  /**
   * Starts native P2P scanning to discover nearby emergency broadcasts and responses.
   */
  public async startDiscovery(): Promise<void> {
    if (this.isScanningActive) return;
    this.isScanningActive = true;

    await nativeP2PAdapter.startScanning(
      (packet) => this.handleIncomingPacket(packet),
      (response) => this.handleIncomingResponse(response)
    );
  }

  public async stopDiscovery(): Promise<void> {
    this.isScanningActive = false;
    await nativeP2PAdapter.stopScanning();
  }

  /**
   * Dispatches an SOS packet offline.
   * 1. Builds and validates packet.
   * 2. Persists to local offline queue for sync.
   * 3. Broadcasts over native P2P BLE bridge.
   */
  public async sendSOS(packet: OfflineSOSPacket): Promise<SOSDispatchResult> {
    const deviceId = await getOrCreateDeviceId();
    const preparedPacket: OfflineSOSPacket = {
      ...packet,
      origin_device_id: packet.origin_device_id || deviceId,
      delivery_status: 'SEARCHING_FOR_PEER',
      hop_count: packet.hop_count ?? 0,
      max_hops: packet.max_hops ?? 5,
      ttl_minutes: packet.ttl_minutes ?? 60,
      packet_version: 1,
      last_updated_at: new Date().toISOString(),
    };

    // 1. Store in offline SOS buffer
    await this.enqueueOfflineSOS(preparedPacket);

    // 2. Mark as seen
    await this.markPacketSeen(preparedPacket.public_sos_id);

    // 3. Broadcast over native BLE P2P
    await nativeP2PAdapter.startAdvertising(preparedPacket);

    return {
      success: true,
      public_sos_id: preparedPacket.public_sos_id,
      delivery_status: 'SEARCHING_FOR_PEER',
      status: preparedPacket.sos_status || 'ACTIVE',
      transport_used: 'OFFLINE_P2P',
      timestamp: preparedPacket.created_at,
      message: 'SOS saved locally and broadcasting over Peer-to-Peer Bluetooth mesh.',
    };
  }

  /**
   * Sends an offline response (YES_HELP / RELAY_ONLY / NO) to an incoming distress alert.
   */
  public async sendResponse(response: OfflineSOSResponsePacket): Promise<boolean> {
    const deviceId = await getOrCreateDeviceId();
    const preparedResponse: OfflineSOSResponsePacket = {
      ...response,
      responder_device_id: response.responder_device_id || deviceId,
      hop_count: response.hop_count ?? 0,
      max_hops: response.max_hops ?? 5,
      ttl_minutes: response.ttl_minutes ?? 60,
      packet_version: 1,
    };

    // Store in offline responses queue for eventual online sync
    await this.enqueueOfflineResponse(preparedResponse);

    // Transmit over native P2P
    await nativeP2PAdapter.sendResponse(preparedResponse);

    // If RELAY_ONLY, ensure the distress alert is carrying forward over native P2P
    if (response.response === 'RELAY_ONLY') {
      const queue = await this.getQueuedSOS();
      const target = queue.find((p) => p.public_sos_id === response.public_sos_id);
      if (target) {
        console.log(`[OfflineP2P] Relaying SOS ${target.public_sos_id} (Hop #${target.hop_count})`);
        await nativeP2PAdapter.startAdvertising(target);
      }
    }

    return true;
  }

  public async cancelSOS(public_sos_id: string, reason?: string): Promise<boolean> {
    await nativeP2PAdapter.stopAdvertising();

    const queue = await this.getQueuedSOS();
    const updated = queue.map((p) => {
      if (p.public_sos_id === public_sos_id) {
        return {
          ...p,
          sos_status: 'CANCELLED' as const,
          description: `${p.description || ''} [Cancelled offline: ${reason || 'by user'}]`,
          last_updated_at: new Date().toISOString(),
        };
      }
      return p;
    });
    await AsyncStorage.setItem(OFFLINE_SOS_QUEUE_KEY, JSON.stringify(updated));
    return true;
  }

  public async updateLocation(
    public_sos_id: string,
    latitude: number,
    longitude: number,
    accuracy?: number
  ): Promise<boolean> {
    const queue = await this.getQueuedSOS();
    const updated = queue.map((p) => {
      if (p.public_sos_id === public_sos_id) {
        return {
          ...p,
          latitude,
          longitude,
          accuracy_meters: accuracy ?? p.accuracy_meters,
          last_updated_at: new Date().toISOString(),
        };
      }
      return p;
    });
    await AsyncStorage.setItem(OFFLINE_SOS_QUEUE_KEY, JSON.stringify(updated));

    // Update active advertising packet if matching
    const target = updated.find((p) => p.public_sos_id === public_sos_id);
    if (target) {
      await nativeP2PAdapter.startAdvertising(target);
    }
    return true;
  }

  /**
   * Called when an incoming P2P packet is received from another physical device.
   * Handles deduplication, TTL checks, and relay logic.
   */
  public async handleIncomingPacket(packet: OfflineSOSPacket): Promise<boolean> {
    const deviceId = await getOrCreateDeviceId();

    // 1. Loop prevention: do not process own packets
    if (packet.origin_device_id === deviceId) {
      return false;
    }

    // 2. Deduplication check
    const isSeen = await this.isPacketSeen(packet.public_sos_id);
    if (isSeen) {
      console.log(`[OfflineP2P] [P2P] Duplicate packet ignored: ${packet.public_sos_id}`);
      return false;
    }

    // 3. TTL Validation (default 60 minutes)
    const ageMinutes = (Date.now() - new Date(packet.created_at).getTime()) / (1000 * 60);
    if (ageMinutes > (packet.ttl_minutes || 60)) {
      console.log(`[OfflineP2P] [P2P] Packet ${packet.public_sos_id} expired (age: ${ageMinutes.toFixed(1)}m)`);
      return false;
    }

    // 4. Mark as seen
    await this.markPacketSeen(packet.public_sos_id);

    // 5. Store in local queue as relayed packet
    const relayedPacket: OfflineSOSPacket = {
      ...packet,
      delivery_status: 'RELAYING',
      hop_count: (packet.hop_count || 0) + 1,
      relayed_by_device_id: deviceId,
    };
    await this.enqueueOfflineSOS(relayedPacket);

    // 6. Notify UI listeners (pops up Universal SOS Receiver Modal!)
    this.packetListeners.forEach((listener) => {
      try {
        listener(relayedPacket);
      } catch (err) {
        console.error('[OfflineP2P] Packet listener error:', err);
      }
    });

    // 7. Multi-hop Relay forwarding (if hops remain)
    if (relayedPacket.hop_count < (relayedPacket.max_hops || 5)) {
      console.log(`[OfflineP2P] [P2P] Relaying packet (Hop #${relayedPacket.hop_count})`);
      await nativeP2PAdapter.startAdvertising(relayedPacket);
    }

    return true;
  }

  /**
   * Called when an incoming offline P2P response is received from a nearby peer.
   */
  public async handleIncomingResponse(response: OfflineSOSResponsePacket): Promise<boolean> {
    const deviceId = await getOrCreateDeviceId();

    if (response.responder_device_id === deviceId) {
      return false;
    }

    console.log(`[OfflineP2P] [P2P] Processing response for SOS ${response.public_sos_id}: ${response.response}`);

    // Notify listeners so originator screen updates to ASSISTANCE ON THE WAY
    this.responseListeners.forEach((listener) => {
      try {
        listener(response);
      } catch (err) {
        console.error('[OfflineP2P] Response listener error:', err);
      }
    });

    return true;
  }

  // --- Storage Queue Helpers ---

  public async getQueuedSOS(): Promise<OfflineSOSPacket[]> {
    try {
      const raw = await AsyncStorage.getItem(OFFLINE_SOS_QUEUE_KEY);
      return raw ? JSON.parse(raw) : [];
    } catch {
      return [];
    }
  }

  public async enqueueOfflineSOS(packet: OfflineSOSPacket): Promise<void> {
    try {
      const queue = await this.getQueuedSOS();
      const existingIdx = queue.findIndex((p) => p.public_sos_id === packet.public_sos_id);
      if (existingIdx >= 0) {
        queue[existingIdx] = packet;
      } else {
        queue.push(packet);
      }
      await AsyncStorage.setItem(OFFLINE_SOS_QUEUE_KEY, JSON.stringify(queue));
    } catch (err) {
      console.error('[OfflineP2P] Error enqueueing SOS:', err);
    }
  }

  public async removeQueuedSOS(public_sos_id: string): Promise<void> {
    try {
      const queue = await this.getQueuedSOS();
      const filtered = queue.filter((p) => p.public_sos_id !== public_sos_id);
      await AsyncStorage.setItem(OFFLINE_SOS_QUEUE_KEY, JSON.stringify(filtered));
    } catch (err) {
      console.error('[OfflineP2P] Error removing queued SOS:', err);
    }
  }

  public async getQueuedResponses(): Promise<OfflineSOSResponsePacket[]> {
    try {
      const raw = await AsyncStorage.getItem(OFFLINE_RESPONSES_QUEUE_KEY);
      return raw ? JSON.parse(raw) : [];
    } catch {
      return [];
    }
  }

  public async enqueueOfflineResponse(response: OfflineSOSResponsePacket): Promise<void> {
    try {
      const queue = await this.getQueuedResponses();
      queue.push(response);
      await AsyncStorage.setItem(OFFLINE_RESPONSES_QUEUE_KEY, JSON.stringify(queue));
    } catch (err) {
      console.error('[OfflineP2P] Error enqueueing response:', err);
    }
  }

  public async removeQueuedResponses(public_sos_id: string): Promise<void> {
    try {
      const queue = await this.getQueuedResponses();
      const filtered = queue.filter((r) => r.public_sos_id !== public_sos_id);
      await AsyncStorage.setItem(OFFLINE_RESPONSES_QUEUE_KEY, JSON.stringify(filtered));
    } catch (err) {
      console.error('[OfflineP2P] Error removing queued responses:', err);
    }
  }

  // --- Deduplication Helpers ---

  private async isPacketSeen(public_sos_id: string): Promise<boolean> {
    try {
      const raw = await AsyncStorage.getItem(SEEN_PACKETS_KEY);
      const seen: string[] = raw ? JSON.parse(raw) : [];
      return seen.includes(public_sos_id);
    } catch {
      return false;
    }
  }

  private async markPacketSeen(public_sos_id: string): Promise<void> {
    try {
      const raw = await AsyncStorage.getItem(SEEN_PACKETS_KEY);
      const seen: string[] = raw ? JSON.parse(raw) : [];
      if (!seen.includes(public_sos_id)) {
        seen.push(public_sos_id);
        if (seen.length > 100) seen.shift();
        await AsyncStorage.setItem(SEEN_PACKETS_KEY, JSON.stringify(seen));
      }
    } catch (err) {
      console.error('[OfflineP2P] Error marking packet seen:', err);
    }
  }
}

export const offlineP2PTransport = new OfflineP2PTransport();
