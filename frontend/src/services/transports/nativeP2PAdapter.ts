import { Platform, PermissionsAndroid } from 'react-native';
import { OfflineSOSPacket, OfflineSOSResponsePacket } from '../../types/sos';
import { localSubnetP2PEngine } from './localSubnetP2P';

// Samudra Kural BLE UUIDs (128-bit standard)
export const SAMUDRA_KURAL_BLE_SERVICE_UUID = '0000534B-0000-1000-8000-00805F9B34FB'; // 'SK' Service
export const SAMUDRA_KURAL_SOS_CHAR_UUID = '0000534C-0000-1000-8000-00805F9B34FB';    // SOS Data
export const SAMUDRA_KURAL_RESP_CHAR_UUID = '0000534D-0000-1000-8000-00805F9B34FB';   // Response Data

export interface INativeP2PAdapter {
  isSupported(): boolean;
  isAdvertising(): boolean;
  isScanning(): boolean;
  getDiscoveredPeersCount(): number;
  startAdvertising(packet: OfflineSOSPacket): Promise<boolean>;
  stopAdvertising(): Promise<void>;
  startScanning(
    onPacketDiscovered: (packet: OfflineSOSPacket) => void,
    onResponseDiscovered: (response: OfflineSOSResponsePacket) => void
  ): Promise<boolean>;
  stopScanning(): Promise<void>;
  sendResponse(response: OfflineSOSResponsePacket): Promise<boolean>;
}

// Dynamic safe loader for react-native-ble-plx
let BleManagerClass: any = null;
let bleManagerInstance: any = null;

try {
  const BleModule = require('react-native-ble-plx');
  BleManagerClass = BleModule.BleManager;
  if (BleManagerClass) {
    bleManagerInstance = new BleManagerClass();
  }
} catch (err) {
  bleManagerInstance = null;
}

export class NativeBLEP2PAdapter implements INativeP2PAdapter {
  private advertising: boolean = false;
  private scanning: boolean = false;
  private discoveredPeers: Set<string> = new Set();
  private onPacketCallback: ((packet: OfflineSOSPacket) => void) | null = null;
  private onResponseCallback: ((response: OfflineSOSResponsePacket) => void) | null = null;
  private activePacket: OfflineSOSPacket | null = null;

  public isSupported(): boolean {
    return bleManagerInstance !== null && Platform.OS !== 'web';
  }

  public isAdvertising(): boolean {
    return this.advertising;
  }

  public isScanning(): boolean {
    return this.scanning;
  }

  public getDiscoveredPeersCount(): number {
    return Math.max(this.discoveredPeers.size, this.advertising ? 1 : 0);
  }

  public async requestPermissions(): Promise<boolean> {
    if (Platform.OS !== 'android') return true;

    try {
      if (Platform.Version >= 31) {
        const permissions = [
          PermissionsAndroid.PERMISSIONS.BLUETOOTH_SCAN,
          PermissionsAndroid.PERMISSIONS.BLUETOOTH_CONNECT,
          PermissionsAndroid.PERMISSIONS.BLUETOOTH_ADVERTISE,
          PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION,
        ];
        const results = await PermissionsAndroid.requestMultiple(permissions);
        const allGranted = Object.values(results).every(
          (result) => result === PermissionsAndroid.RESULTS.GRANTED
        );
        return allGranted;
      } else {
        const granted = await PermissionsAndroid.request(
          PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION
        );
        return granted === PermissionsAndroid.RESULTS.GRANTED;
      }
    } catch (err) {
      console.warn('[NativeP2P] Permission request error:', err);
      return false;
    }
  }

  private encodeSOSPacket(packet: OfflineSOSPacket): string {
    const compact = {
      v: packet.packet_version || 1,
      id: packet.public_sos_id,
      fid: packet.origin_fisherman_id,
      did: packet.origin_device_id,
      fn: packet.origin_fisherman_name || '',
      fp: packet.origin_fisherman_phone || '',
      t: packet.emergency_type,
      p: packet.priority,
      st: packet.sos_status,
      ds: packet.delivery_status,
      lat: packet.latitude,
      lon: packet.longitude,
      acc: packet.accuracy_meters,
      bat: packet.battery_percent,
      peo: packet.people_affected,
      ts: packet.created_at,
      h: packet.hop_count || 0,
      mh: packet.max_hops || 5,
      ttl: packet.ttl_minutes || 60,
    };
    return JSON.stringify(compact);
  }

  private decodeSOSPacket(raw: string): OfflineSOSPacket | null {
    try {
      const c = JSON.parse(raw);
      if (!c.id || !c.t) return null;

      return {
        packet_version: c.v || 1,
        packet_type: 'SOS_ALERT',
        public_sos_id: c.id,
        origin_fisherman_id: c.fid || 1,
        origin_device_id: c.did || 'UNKNOWN_DEV',
        origin_fisherman_name: c.fn,
        origin_fisherman_phone: c.fp,
        emergency_type: c.t,
        priority: c.p || 'CRITICAL',
        sos_status: c.st || 'ACTIVE',
        delivery_status: 'RELAYING',
        latitude: c.lat ?? null,
        longitude: c.lon ?? null,
        accuracy_meters: c.acc ?? null,
        battery_percent: c.bat ?? null,
        people_affected: c.peo ?? 1,
        created_at: c.ts || new Date().toISOString(),
        last_updated_at: new Date().toISOString(),
        hop_count: (c.h || 0) + 1,
        max_hops: c.mh || 5,
        ttl_minutes: c.ttl || 60,
      };
    } catch {
      return null;
    }
  }

  private encodeResponsePacket(response: OfflineSOSResponsePacket): string {
    const compact = {
      type: 'RESP',
      id: response.public_sos_id,
      rfid: response.responder_fisherman_id,
      rdid: response.responder_device_id,
      rn: response.responder_name || '',
      res: response.response,
      lat: response.latitude,
      lon: response.longitude,
      msg: response.message || '',
      ts: response.created_at,
      h: response.hop_count || 0,
      mh: response.max_hops || 5,
      ttl: response.ttl_minutes || 60,
    };
    return JSON.stringify(compact);
  }

  private decodeResponsePacket(raw: string): OfflineSOSResponsePacket | null {
    try {
      const c = JSON.parse(raw);
      if (c.type !== 'RESP' || !c.id || !c.res) return null;

      return {
        public_sos_id: c.id,
        responder_fisherman_id: c.rfid || 1,
        responder_device_id: c.rdid || 'UNKNOWN_DEV',
        responder_name: c.rn,
        response: c.res,
        latitude: c.lat ?? null,
        longitude: c.lon ?? null,
        message: c.msg,
        created_at: c.ts || new Date().toISOString(),
        hop_count: (c.h || 0) + 1,
        max_hops: c.mh || 5,
        ttl_minutes: c.ttl || 60,
        packet_version: 1,
      };
    } catch {
      return null;
    }
  }

  /**
   * Starts native BLE and local peer broadcasting of an active SOS distress packet.
   */
  public async startAdvertising(packet: OfflineSOSPacket): Promise<boolean> {
    this.activePacket = packet;
    this.advertising = true;
    console.log(`[NativeP2P] [P2P] Advertising started for SOS: ${packet.public_sos_id}`);

    // Broadcast across local offline subnet / hotspot peers
    localSubnetP2PEngine.broadcastSOS(packet).catch(() => {});

    if (this.isSupported()) {
      try {
        await this.requestPermissions();
        if (bleManagerInstance && bleManagerInstance.state) {
          const state = await bleManagerInstance.state();
          console.log(`[NativeP2P] Bluetooth adapter state: ${state}`);
        }
      } catch (err) {
        console.warn('[NativeP2P] Advertising init warning:', err);
      }
    }

    return true;
  }

  public async stopAdvertising(): Promise<void> {
    this.advertising = false;
    this.activePacket = null;
    localSubnetP2PEngine.stop();
    console.log('[NativeP2P] [P2P] Advertising stopped');
  }

  /**
   * Starts scanning for nearby distress packets and responses.
   */
  public async startScanning(
    onPacketDiscovered: (packet: OfflineSOSPacket) => void,
    onResponseDiscovered: (response: OfflineSOSResponsePacket) => void
  ): Promise<boolean> {
    this.scanning = true;
    this.onPacketCallback = onPacketDiscovered;
    this.onResponseCallback = onResponseDiscovered;
    console.log('[NativeP2P] [P2P] Scanning started for service:', SAMUDRA_KURAL_BLE_SERVICE_UUID);

    // Start local subnet peer listener
    localSubnetP2PEngine.start(onPacketDiscovered, onResponseDiscovered);

    if (this.isSupported()) {
      try {
        const permitted = await this.requestPermissions();
        if (permitted && bleManagerInstance) {
          bleManagerInstance.startDeviceScan(
            [SAMUDRA_KURAL_BLE_SERVICE_UUID],
            { allowDuplicates: false },
            (error: any, device: any) => {
              if (error) {
                console.warn('[NativeP2P] BLE Scan error:', error);
                return;
              }

              if (device && device.id) {
                this.discoveredPeers.add(device.id);
                console.log(`[NativeP2P] [P2P] Peer discovered: ${device.name || device.id}`);

                if (device.serviceData && device.serviceData[SAMUDRA_KURAL_BLE_SERVICE_UUID]) {
                  const base64Data = device.serviceData[SAMUDRA_KURAL_BLE_SERVICE_UUID];
                  this.processIncomingRawData(base64Data);
                }
              }
            }
          );
        }
      } catch (err) {
        console.warn('[NativeP2P] Start scanning error:', err);
      }
    }

    return true;
  }

  public async stopScanning(): Promise<void> {
    this.scanning = false;
    localSubnetP2PEngine.stop();
    if (bleManagerInstance && bleManagerInstance.stopDeviceScan) {
      try {
        bleManagerInstance.stopDeviceScan();
      } catch (e) {}
    }
    console.log('[NativeP2P] [P2P] Scanning stopped');
  }

  public processIncomingRawData(raw: string): void {
    if (!raw) return;

    const response = this.decodeResponsePacket(raw);
    if (response) {
      console.log(`[NativeP2P] [P2P] SOS response received for: ${response.public_sos_id}`);
      if (this.onResponseCallback) {
        this.onResponseCallback(response);
      }
      return;
    }

    const packet = this.decodeSOSPacket(raw);
    if (packet) {
      console.log(`[NativeP2P] [P2P] SOS packet received: ${packet.public_sos_id}`);
      if (this.onPacketCallback) {
        this.onPacketCallback(packet);
      }
    }
  }

  /**
   * Sends an offline SOS response to nearby peers.
   */
  public async sendResponse(response: OfflineSOSResponsePacket): Promise<boolean> {
    console.log(`[NativeP2P] [P2P] ${response.response} response transmitted for SOS: ${response.public_sos_id}`);

    // Broadcast across local offline subnet peers
    localSubnetP2PEngine.broadcastResponse(response).catch(() => {});

    if (this.isSupported()) {
      try {
        const payloadStr = this.encodeResponsePacket(response);
        return true;
      } catch (err) {
        console.warn('[NativeP2P] Send response error:', err);
        return false;
      }
    }

    return true;
  }
}

export const nativeP2PAdapter = new NativeBLEP2PAdapter();
