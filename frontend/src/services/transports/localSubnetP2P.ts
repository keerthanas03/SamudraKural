import { OfflineSOSPacket, OfflineSOSResponsePacket } from '../../types/sos';
import { getOrCreateDeviceId } from '../../utils/deviceId';

const LOCAL_P2P_PORT = 8089;

export class LocalSubnetP2PEngine {
  private isListening: boolean = false;
  private isBroadcasting: boolean = false;
  private onPacketReceived: ((packet: OfflineSOSPacket) => void) | null = null;
  private onResponseReceived: ((response: OfflineSOSResponsePacket) => void) | null = null;
  private scanInterval: any = null;
  private activeDistressPacket: OfflineSOSPacket | null = null;
  private activeResponsePacket: OfflineSOSResponsePacket | null = null;

  /**
   * Starts local subnet peer listener.
   */
  public start(
    onPacket: (packet: OfflineSOSPacket) => void,
    onResponse: (response: OfflineSOSResponsePacket) => void
  ) {
    this.onPacketReceived = onPacket;
    this.onResponseReceived = onResponse;
    this.isListening = true;

    // Periodically probe local subnet hotspot peers (e.g. 192.168.43.1 hotspot gateway and peers)
    if (!this.scanInterval) {
      this.scanInterval = setInterval(() => {
        this.probeLocalPeers();
      }, 2500);
    }
  }

  public stop() {
    this.isListening = false;
    this.isBroadcasting = false;
    this.activeDistressPacket = null;
    this.activeResponsePacket = null;
    if (this.scanInterval) {
      clearInterval(this.scanInterval);
      this.scanInterval = null;
    }
  }

  /**
   * Broadcasts an offline SOS distress packet across the local offline Wi-Fi Hotspot / Subnet.
   */
  public async broadcastSOS(packet: OfflineSOSPacket): Promise<void> {
    this.activeDistressPacket = packet;
    this.isBroadcasting = true;
    console.log(`[LocalP2P] [P2P] Offline Subnet Broadcasting started for SOS: ${packet.public_sos_id}`);

    // Probe common local hotspot / ad-hoc subnet IPs (Android Hotspot is 192.168.43.1 - 192.168.43.20)
    const targetIps = this.generateSubnetTargetIps();

    for (const ip of targetIps) {
      this.sendDirectPacketToIp(ip, packet).catch(() => {});
    }
  }

  /**
   * Broadcasts an offline YES HELP / NO response across the local offline Hotspot / Subnet.
   */
  public async broadcastResponse(response: OfflineSOSResponsePacket): Promise<void> {
    this.activeResponsePacket = response;
    console.log(`[LocalP2P] [P2P] Offline Subnet Broadcasting ${response.response} response for SOS: ${response.public_sos_id}`);

    const targetIps = this.generateSubnetTargetIps();

    for (const ip of targetIps) {
      this.sendDirectResponseToIp(ip, response).catch(() => {});
    }
  }

  private generateSubnetTargetIps(): string[] {
    const ips: string[] = [
      '192.168.43.1', // Android Hotspot Host Gateway
      '192.168.43.2',
      '192.168.43.3',
      '192.168.43.4',
      '192.168.43.5',
      '192.168.43.10',
      '192.168.1.1',
      '192.168.1.2',
      '192.168.1.3',
      '192.168.1.4',
      '192.168.0.1',
      '192.168.0.2',
      '192.168.0.3',
      '10.0.0.1',
      '10.0.0.2',
    ];
    return ips;
  }

  private async sendDirectPacketToIp(ip: string, packet: OfflineSOSPacket): Promise<void> {
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 1200);

      await fetch(`http://${ip}:${LOCAL_P2P_PORT}/p2p/sos`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(packet),
        signal: controller.signal,
      });

      clearTimeout(timeout);
      console.log(`[LocalP2P] [P2P] Direct SOS packet delivered to peer at ${ip}`);
    } catch {
      // Offline peer unreachable on this specific IP
    }
  }

  private async sendDirectResponseToIp(ip: string, response: OfflineSOSResponsePacket): Promise<void> {
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 1200);

      await fetch(`http://${ip}:${LOCAL_P2P_PORT}/p2p/response`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(response),
        signal: controller.signal,
      });

      clearTimeout(timeout);
      console.log(`[LocalP2P] [P2P] Direct response delivered to peer at ${ip}`);
    } catch {
      // Offline peer unreachable on this specific IP
    }
  }

  private async probeLocalPeers(): Promise<void> {
    if (!this.isListening) return;

    // Check for active broadcasts from nearby peers
    const targetIps = this.generateSubnetTargetIps();

    for (const ip of targetIps) {
      this.fetchPeerStatus(ip).catch(() => {});
    }
  }

  private async fetchPeerStatus(ip: string): Promise<void> {
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 800);

      const res = await fetch(`http://${ip}:${LOCAL_P2P_PORT}/p2p/status`, {
        method: 'GET',
        signal: controller.signal,
      });

      clearTimeout(timeout);
      if (res.ok) {
        const data = await res.json();
        if (data && data.activeSOS && this.onPacketReceived) {
          this.onPacketReceived(data.activeSOS);
        }
        if (data && data.activeResponse && this.onResponseReceived) {
          this.onResponseReceived(data.activeResponse);
        }
      }
    } catch {
      // Peer not active on this IP
    }
  }

  public getActiveDistressPayload(): OfflineSOSPacket | null {
    return this.activeDistressPacket;
  }

  public getActiveResponsePayload(): OfflineSOSResponsePacket | null {
    return this.activeResponsePacket;
  }
}

export const localSubnetP2PEngine = new LocalSubnetP2PEngine();
