import { API_BASE_URL } from './api';
import { getAuthToken } from '../storage/storage';

export type WebSocketEventType =
  | 'SOS_ALERT_CREATED'
  | 'SOS_RESPONSE_RECEIVED'
  | 'SOS_STATUS_UPDATED'
  | 'RESCUE_MISSION_CREATED'
  | 'RESCUE_MISSION_DISPATCHED'
  | 'RESCUE_MISSION_UPDATED'
  | 'PONG'
  | 'ERROR'
  | 'AUTHENTICATED';

export type WebSocketEventHandler = (payload: any) => void;
export type ConnectionState = 'DISCONNECTED' | 'CONNECTING' | 'CONNECTED' | 'RECONNECTING';

class WebSocketService {
  private ws: WebSocket | null = null;
  private listeners: Map<string, Set<WebSocketEventHandler>> = new Map();
  private stateListeners: Set<(state: ConnectionState) => void> = new Set();
  private connectionState: ConnectionState = 'DISCONNECTED';
  private reconnectTimer: any = null;
  private pingTimer: any = null;
  private reconnectAttempts: number = 0;
  private maxReconnectAttempts: number = 10;
  private baseReconnectDelayMs: number = 2000;
  private shouldStayConnected: boolean = false;

  private getWebSocketUrl(token: string): string {
    // Convert http:// to ws:// and https:// to wss://
    let wsUrl = API_BASE_URL.replace(/^http:\/\//i, 'ws://').replace(/^https:\/\//i, 'wss://');
    return `${wsUrl}/ws?token=${encodeURIComponent(token)}`;
  }

  public getConnectionState(): ConnectionState {
    return this.connectionState;
  }

  private setConnectionState(newState: ConnectionState) {
    if (this.connectionState !== newState) {
      this.connectionState = newState;
      this.stateListeners.forEach((listener) => {
        try {
          listener(newState);
        } catch (e) {
          console.error('[WebSocket] State listener error:', e);
        }
      });
    }
  }

  public onConnectionStateChange(listener: (state: ConnectionState) => void): () => void {
    this.stateListeners.add(listener);
    listener(this.connectionState);
    return () => {
      this.stateListeners.delete(listener);
    };
  }

  public async connect(): Promise<void> {
    this.shouldStayConnected = true;

    if (this.ws && (this.ws.readyState === WebSocket.OPEN || this.ws.readyState === WebSocket.CONNECTING)) {
      return;
    }

    const token = await getAuthToken();
    if (!token) {
      console.log('[WebSocket] No auth token available; cannot connect.');
      this.setConnectionState('DISCONNECTED');
      return;
    }

    this.setConnectionState(this.reconnectAttempts > 0 ? 'RECONNECTING' : 'CONNECTING');

    try {
      const url = this.getWebSocketUrl(token);
      this.ws = new WebSocket(url);

      this.ws.onopen = () => {
        console.log('[WebSocket] Connected successfully to:', url.split('?')[0]);
        this.setConnectionState('CONNECTED');
        this.reconnectAttempts = 0;
        this.startHeartbeat();
      };

      this.ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          if (data && data.event) {
            this.handleEvent(data.event, data.payload);
          }
        } catch (err) {
          console.warn('[WebSocket] Error parsing incoming message:', err);
        }
      };

      this.ws.onerror = (error: any) => {
        console.log('[WebSocket] Notice:', error?.message || 'Connection event');
      };

      this.ws.onclose = (event) => {
        console.log(`[WebSocket] Closed (code: ${event.code}, reason: ${event.reason})`);
        this.stopHeartbeat();
        this.ws = null;
        this.setConnectionState('DISCONNECTED');

        if (this.shouldStayConnected) {
          this.scheduleReconnect();
        }
      };
    } catch (err) {
      console.error('[WebSocket] Connection initialization error:', err);
      this.setConnectionState('DISCONNECTED');
      if (this.shouldStayConnected) {
        this.scheduleReconnect();
      }
    }
  }

  private startHeartbeat() {
    this.stopHeartbeat();
    this.pingTimer = setInterval(() => {
      if (this.ws && this.ws.readyState === WebSocket.OPEN) {
        this.ws.send(JSON.stringify({ action: 'ping' }));
      }
    }, 25000);
  }

  private stopHeartbeat() {
    if (this.pingTimer) {
      clearInterval(this.pingTimer);
      this.pingTimer = null;
    }
  }

  private scheduleReconnect() {
    if (this.reconnectTimer) return;
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      console.warn('[WebSocket] Max reconnection attempts reached.');
      return;
    }

    const delay = Math.min(
      this.baseReconnectDelayMs * Math.pow(1.5, this.reconnectAttempts),
      30000
    );
    this.reconnectAttempts += 1;
    console.log(`[WebSocket] Scheduling reconnect attempt #${this.reconnectAttempts} in ${delay}ms...`);

    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null;
      if (this.shouldStayConnected) {
        this.connect();
      }
    }, delay);
  }

  public disconnect() {
    this.shouldStayConnected = false;
    this.stopHeartbeat();
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
    this.setConnectionState('DISCONNECTED');
  }

  public subscribe(eventType: WebSocketEventType | string, handler: WebSocketEventHandler): () => void {
    if (!this.listeners.has(eventType)) {
      this.listeners.set(eventType, new Set());
    }
    this.listeners.get(eventType)!.add(handler);

    return () => {
      const set = this.listeners.get(eventType);
      if (set) {
        set.delete(handler);
      }
    };
  }

  private handleEvent(eventType: string, payload: any) {
    const handlers = this.listeners.get(eventType);
    if (handlers) {
      handlers.forEach((h) => {
        try {
          h(payload);
        } catch (e) {
          console.error(`[WebSocket] Handler error for ${eventType}:`, e);
        }
      });
    }

    // Also trigger wildcard handlers
    const wildcardHandlers = this.listeners.get('*');
    if (wildcardHandlers) {
      wildcardHandlers.forEach((h) => {
        try {
          h({ event: eventType, payload });
        } catch (e) {
          console.error('[WebSocket] Wildcard handler error:', e);
        }
      });
    }
  }
}

export const websocketService = new WebSocketService();
