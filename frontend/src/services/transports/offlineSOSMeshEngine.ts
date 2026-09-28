import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  MeshSOSPacket,
  SOSPacketType,
  SOSResponseAction,
  SOSLifecycleStatus,
  SOSDeliveryStatus,
  LocationResult,
  SOSPriority,
} from '../../types/sos';
import { getOrCreateDeviceId, generatePublicSOSId } from '../../utils/deviceId';
import { nativeP2PAdapter } from './nativeP2PAdapter';

const MESH_PACKETS_KEY = '@samudra_kural_mesh_packets';
const MESH_SEEN_CACHE_KEY = '@samudra_kural_mesh_seen_cache';
const MAX_SEEN_CACHE_SIZE = 150;

export type MeshPacketListener = (packet: MeshSOSPacket) => void;
export type MeshResponseListener = (packet: MeshSOSPacket) => void;

export class OfflineSOSMeshEngine {
  private packetListeners: Set<MeshPacketListener> = new Set();
  private responseListeners: Set<MeshResponseListener> = new Set();
  private initialized: boolean = false;

  constructor() {
    this.init();
  }

  public init() {
    if (this.initialized) return;
    this.initialized = true;

    // Start background native peer discovery
    nativeP2PAdapter.startScanning(
      (packet) => this.handleIncomingMeshPacket(packet as MeshSOSPacket),
      (resp) => {
        // Adapt legacy response format if received
        const adapted: MeshSOSPacket = {
          packet_version: 1,
          packet_type: 'SOS_RESPONSE',
          public_sos_id: resp.public_sos_id,
          origin_fisherman_id: resp.responder_fisherman_id,
          origin_device_id: resp.responder_device_id,
          responder_fisherman_id: resp.responder_fisherman_id,
          responder_device_id: resp.responder_device_id,
          responder_name: resp.responder_name,
          response_action: resp.response === 'YES_HELP' ? 'YES_HELP' : 'NO',
          response_message: resp.message,
          emergency_type: 'Distress Response',
          priority: 'CRITICAL',
          sos_status: resp.response === 'YES_HELP' ? 'HELP_ON_THE_WAY' : 'ACTIVE',
          delivery_status: 'P2P_DELIVERED',
          latitude: resp.latitude ?? null,
          longitude: resp.longitude ?? null,
          accuracy_meters: null,
          created_at: resp.created_at,
          last_updated_at: new Date().toISOString(),
          hop_count: resp.hop_count || 0,
          max_hops: resp.max_hops || 5,
          ttl_minutes: resp.ttl_minutes || 60,
        };
        this.handleIncomingMeshPacket(adapted);
      }
    ).catch((err) => {
      console.log('[MeshEngine] Native scanning start note:', err);
    });
  }

  public onPacketReceived(listener: MeshPacketListener): () => void {
    this.packetListeners.add(listener);
    return () => {
      this.packetListeners.delete(listener);
    };
  }

  public onResponseReceived(listener: MeshResponseListener): () => void {
    this.responseListeners.add(listener);
    return () => {
      this.responseListeners.delete(listener);
    };
  }

  /**
   * Creates an origin distress SOS packet for offshore emergency.
   * Runs completely offline with no backend or Internet required.
   */
  public async createSOSAlert(
    location: LocationResult,
    emergencyType: string,
    user?: { id?: number | string; name?: string; phone?: string } | null,
    batteryPercent: number = 100,
    peopleAffected: number = 1,
    description?: string,
    priority: SOSPriority = 'CRITICAL'
  ): Promise<MeshSOSPacket> {
    const public_sos_id = generatePublicSOSId();
    const deviceId = await getOrCreateDeviceId();
    const now = new Date().toISOString();

    const userIdNum = user?.id ? parseInt(String(user.id).replace(/\D/g, ''), 10) || 1 : 1;

    const packet: MeshSOSPacket = {
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
      delivery_status: 'SEARCHING_FOR_PEER',
      latitude: location.latitude,
      longitude: location.longitude,
      accuracy_meters: location.accuracy,
      battery_percent: batteryPercent,
      people_affected: peopleAffected,
      description: description || `Distress signal: ${emergencyType}`,
      created_at: now,
      last_updated_at: now,
      hop_count: 0,
      max_hops: 5,
      ttl_minutes: 60,
      relay_path: [deviceId],
    };

    // 1. Store into persistent local mesh store
    await this.saveMeshPacket(packet);

    // 2. Mark seen
    await this.markPacketSeen(packet.public_sos_id, packet.packet_type, packet.last_updated_at);

    // 3. Start peer advertising over native BLE / local peer link
    await nativeP2PAdapter.startAdvertising(packet);

    console.log(`[MeshEngine] [P2P] Offline SOS Alert Created: ${public_sos_id} (Type: ${emergencyType})`);
    return packet;
  }

  /**
   * Handles incoming packet received from a nearby participating physical device.
   * Applies strict validation, loop prevention, deduplication, TTL, hop limits, and store-and-forward.
   */
  public async handleIncomingMeshPacket(packet: MeshSOSPacket): Promise<boolean> {
    const deviceId = await getOrCreateDeviceId();

    // 1. Basic Structure Validation
    if (!packet || !packet.public_sos_id || packet.packet_version !== 1) {
      console.warn('[MeshEngine] Rejected malformed packet:', packet);
      return false;
    }

    // 2. Loop Prevention: Discard own packets
    if (packet.origin_device_id === deviceId && packet.packet_type === 'SOS_ALERT') {
      return false;
    }
    if (packet.responder_device_id === deviceId && packet.packet_type === 'SOS_RESPONSE') {
      return false;
    }

    // 3. TTL Validation
    const ageMinutes = (Date.now() - new Date(packet.created_at).getTime()) / (1000 * 60);
    if (ageMinutes > (packet.ttl_minutes || 60)) {
      console.log(`[MeshEngine] [P2P] Packet ${packet.public_sos_id} expired (Age: ${ageMinutes.toFixed(1)}m > TTL: ${packet.ttl_minutes}m)`);
      return false;
    }

    // 4. Hop Count Validation
    if (packet.hop_count >= (packet.max_hops || 5)) {
      console.log(`[MeshEngine] [P2P] Max hop limit reached (${packet.hop_count}/${packet.max_hops}) for ${packet.public_sos_id}`);
      return false;
    }

    // 5. Deduplication Check
    const seen = await this.isPacketSeen(packet.public_sos_id, packet.packet_type, packet.last_updated_at);
    if (seen) {
      return false;
    }

    // 6. Mark Seen
    await this.markPacketSeen(packet.public_sos_id, packet.packet_type, packet.last_updated_at);

    console.log(`[MeshEngine] [P2P] Verified valid incoming ${packet.packet_type} for SOS: ${packet.public_sos_id} (Hop #${packet.hop_count})`);

    // 7. Process based on Packet Type
    if (packet.packet_type === 'SOS_ALERT') {
      const relayedPacket: MeshSOSPacket = {
        ...packet,
        delivery_status: 'RELAYING',
        hop_count: packet.hop_count + 1,
        relayed_by_device_id: deviceId,
        relay_path: [...(packet.relay_path || []), deviceId],
        last_updated_at: new Date().toISOString(),
      };

      // Save to local store for store-and-forward carrying
      await this.saveMeshPacket(relayedPacket);

      // Notify UI listeners (pops up Universal SOS Receiver Modal!)
      this.packetListeners.forEach((listener) => {
        try {
          listener(relayedPacket);
        } catch (err) {
          console.error('[MeshEngine] Packet listener error:', err);
        }
      });

      return true;
    }

    if (packet.packet_type === 'SOS_RESPONSE') {
      const stored = await this.getMeshPacket(packet.public_sos_id);

      // If own device is the original distress sender
      if (stored && stored.origin_device_id === deviceId) {
        console.log(`[MeshEngine] [P2P] Response reached Origin Device for ${packet.public_sos_id}: ${packet.response_action}`);
        if (packet.response_action === 'YES_HELP') {
          stored.sos_status = 'HELP_ON_THE_WAY';
          stored.last_updated_at = new Date().toISOString();
          await this.saveMeshPacket(stored);
        }

        this.responseListeners.forEach((listener) => {
          try {
            listener(packet);
          } catch (err) {
            console.error('[MeshEngine] Response listener error:', err);
          }
        });
        return true;
      }

      // If own device is a relay node, forward response along mesh
      const forwardedResponse: MeshSOSPacket = {
        ...packet,
        hop_count: packet.hop_count + 1,
        relayed_by_device_id: deviceId,
        last_updated_at: new Date().toISOString(),
      };
      await this.saveMeshPacket(forwardedResponse);

      if (forwardedResponse.hop_count < (forwardedResponse.max_hops || 5)) {
        await nativeP2PAdapter.startAdvertising(forwardedResponse);
      }
      return true;
    }

    if (packet.packet_type === 'SOS_CANCEL') {
      const stored = await this.getMeshPacket(packet.public_sos_id);
      if (stored) {
        stored.sos_status = 'CANCELLED';
        stored.last_updated_at = new Date().toISOString();
        await this.saveMeshPacket(stored);
      }
      return true;
    }

    return true;
  }

  /**
   * Responds to an incoming SOS:
   * - action: 'YES_HELP' -> responder commits to assist
   * - action: 'RELAY_ONLY' -> node carries and forwards SOS to next vessels
   * - action: 'NO' -> node declines
   */
  public async respondToSOS(
    public_sos_id: string,
    action: SOSResponseAction,
    location?: LocationResult,
    user?: { id?: number | string; name?: string } | null,
    message?: string
  ): Promise<MeshSOSPacket> {
    const deviceId = await getOrCreateDeviceId();
    const now = new Date().toISOString();
    const userIdNum = user?.id ? parseInt(String(user.id).replace(/\D/g, ''), 10) || 1 : 1;

    const responsePacket: MeshSOSPacket = {
      packet_version: 1,
      packet_type: 'SOS_RESPONSE',
      public_sos_id,
      origin_fisherman_id: userIdNum,
      origin_device_id: deviceId,
      responder_fisherman_id: userIdNum,
      responder_device_id: deviceId,
      responder_name: user?.name,
      response_action: action,
      response_message: message || (action === 'YES_HELP' ? 'I am responding to assist.' : 'Relaying SOS to nearby vessels.'),
      emergency_type: 'Distress Response',
      priority: 'CRITICAL',
      sos_status: action === 'YES_HELP' ? 'HELP_ON_THE_WAY' : 'ACTIVE',
      delivery_status: 'P2P_DELIVERED',
      latitude: location?.latitude ?? null,
      longitude: location?.longitude ?? null,
      accuracy_meters: location?.accuracy ?? null,
      created_at: now,
      last_updated_at: now,
      hop_count: 0,
      max_hops: 5,
      ttl_minutes: 60,
    };

    // 1. Save response into mesh store
    await this.saveMeshPacket(responsePacket);

    // 2. Mark seen
    await this.markPacketSeen(public_sos_id, 'SOS_RESPONSE', now);

    // 3. Transmit response over native P2P
    await nativeP2PAdapter.sendResponse({
      public_sos_id,
      responder_fisherman_id: userIdNum,
      responder_device_id: deviceId,
      responder_name: user?.name,
      response: action === 'YES_HELP' ? 'YES_HELP' : 'NO',
      latitude: location?.latitude,
      longitude: location?.longitude,
      message: responsePacket.response_message,
      created_at: now,
      hop_count: 0,
      max_hops: 5,
      ttl_minutes: 60,
      packet_version: 1,
    });

    // 4. If action is RELAY_ONLY, re-advertise original alert to forward to subsequent vessels
    if (action === 'RELAY_ONLY') {
      const originalAlert = await this.getMeshPacket(public_sos_id);
      if (originalAlert && originalAlert.packet_type === 'SOS_ALERT') {
        console.log(`[MeshEngine] [P2P] RELAY_ONLY selected: Continuing store-and-forward for ${public_sos_id}`);
        await nativeP2PAdapter.startAdvertising(originalAlert);
      }
    }

    console.log(`[MeshEngine] [P2P] Response Action [${action}] transmitted for SOS: ${public_sos_id}`);
    return responsePacket;
  }

  /**
   * Cancels an active SOS alert and broadcasts cancellation across the mesh.
   */
  public async cancelSOS(public_sos_id: string, reason?: string): Promise<boolean> {
    const deviceId = await getOrCreateDeviceId();
    const now = new Date().toISOString();

    const cancelPacket: MeshSOSPacket = {
      packet_version: 1,
      packet_type: 'SOS_CANCEL',
      public_sos_id,
      origin_fisherman_id: 1,
      origin_device_id: deviceId,
      emergency_type: 'Cancellation',
      priority: 'LOW',
      sos_status: 'CANCELLED',
      delivery_status: 'P2P_DELIVERED',
      description: `SOS Cancelled: ${reason || 'by user'}`,
      latitude: null,
      longitude: null,
      accuracy_meters: null,
      created_at: now,
      last_updated_at: now,
      hop_count: 0,
      max_hops: 5,
      ttl_minutes: 60,
    };

    await this.saveMeshPacket(cancelPacket);
    await nativeP2PAdapter.stopAdvertising();
    await nativeP2PAdapter.startAdvertising(cancelPacket);

    console.log(`[MeshEngine] [P2P] SOS Cancelled: ${public_sos_id}`);
    return true;
  }

  // --- Local Mesh Store Operations ---

  public async getAllMeshPackets(): Promise<MeshSOSPacket[]> {
    try {
      const raw = await AsyncStorage.getItem(MESH_PACKETS_KEY);
      return raw ? JSON.parse(raw) : [];
    } catch {
      return [];
    }
  }

  public async getMeshPacket(public_sos_id: string): Promise<MeshSOSPacket | null> {
    const packets = await this.getAllMeshPackets();
    return packets.find((p) => p.public_sos_id === public_sos_id) || null;
  }

  public async saveMeshPacket(packet: MeshSOSPacket): Promise<void> {
    try {
      const packets = await this.getAllMeshPackets();
      const existingIdx = packets.findIndex(
        (p) => p.public_sos_id === packet.public_sos_id && p.packet_type === packet.packet_type
      );
      if (existingIdx >= 0) {
        packets[existingIdx] = packet;
      } else {
        packets.unshift(packet);
      }
      // Prune expired packets from store
      const now = Date.now();
      const valid = packets.filter((p) => {
        const age = (now - new Date(p.created_at).getTime()) / (60 * 1000);
        return age <= (p.ttl_minutes || 60);
      });
      await AsyncStorage.setItem(MESH_PACKETS_KEY, JSON.stringify(valid));
    } catch (err) {
      console.error('[MeshEngine] Error saving mesh packet:', err);
    }
  }

  public async removeMeshPacket(public_sos_id: string): Promise<void> {
    try {
      const packets = await this.getAllMeshPackets();
      const filtered = packets.filter((p) => p.public_sos_id !== public_sos_id);
      await AsyncStorage.setItem(MESH_PACKETS_KEY, JSON.stringify(filtered));
    } catch (err) {
      console.error('[MeshEngine] Error removing mesh packet:', err);
    }
  }

  // --- Bounded Seen Cache Operations ---

  private async isPacketSeen(public_sos_id: string, packet_type: string, timestamp: string): Promise<boolean> {
    try {
      const key = `${public_sos_id}:${packet_type}:${timestamp.slice(0, 19)}`;
      const raw = await AsyncStorage.getItem(MESH_SEEN_CACHE_KEY);
      const seen: string[] = raw ? JSON.parse(raw) : [];
      return seen.includes(key);
    } catch {
      return false;
    }
  }

  private async markPacketSeen(public_sos_id: string, packet_type: string, timestamp: string): Promise<void> {
    try {
      const key = `${public_sos_id}:${packet_type}:${timestamp.slice(0, 19)}`;
      const raw = await AsyncStorage.getItem(MESH_SEEN_CACHE_KEY);
      const seen: string[] = raw ? JSON.parse(raw) : [];
      if (!seen.includes(key)) {
        seen.push(key);
        if (seen.length > MAX_SEEN_CACHE_SIZE) seen.shift();
        await AsyncStorage.setItem(MESH_SEEN_CACHE_KEY, JSON.stringify(seen));
      }
    } catch (err) {
      console.error('[MeshEngine] Error marking packet seen:', err);
    }
  }

  /**
   * Retrieves all un-synchronized mesh packets for eventual gateway upload.
   */
  public async getPacketsForGatewaySync(): Promise<MeshSOSPacket[]> {
    const packets = await this.getAllMeshPackets();
    return packets.filter((p) => p.delivery_status !== 'SYNCED');
  }
}

export const offlineSOSMeshEngine = new OfflineSOSMeshEngine();
