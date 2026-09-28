import NetInfo, { NetInfoState } from '@react-native-community/netinfo';

type NetworkListener = (isConnected: boolean, state: NetInfoState) => void;

class NetworkService {
  private isConnected: boolean = true;
  private listeners: Set<NetworkListener> = new Set();
  private unsubscribeNetInfo: (() => void) | null = null;
  private initialized: boolean = false;

  constructor() {
    this.init();
  }

  private init() {
    if (this.initialized) return;
    this.initialized = true;

    // Listen to real network changes
    this.unsubscribeNetInfo = NetInfo.addEventListener((state) => {
      const online = Boolean(state.isConnected && (state.isInternetReachable ?? true));
      const changed = this.isConnected !== online;
      this.isConnected = online;

      if (changed) {
        console.log(`[NetworkService] Network state changed: online=${online}, type=${state.type}`);
        this.notifyListeners(state);
      }
    });

    // Check initial state
    NetInfo.fetch().then((state) => {
      this.isConnected = Boolean(state.isConnected && (state.isInternetReachable ?? true));
      this.notifyListeners(state);
    }).catch((err) => {
      console.warn('[NetworkService] Initial fetch error:', err);
    });
  }

  private notifyListeners(state: NetInfoState) {
    this.listeners.forEach((listener) => {
      try {
        listener(this.isConnected, state);
      } catch (err) {
        console.error('[NetworkService] Listener error:', err);
      }
    });
  }

  public async getIsOnline(): Promise<boolean> {
    try {
      const state = await NetInfo.fetch();
      this.isConnected = Boolean(state.isConnected && (state.isInternetReachable ?? true));
      return this.isConnected;
    } catch {
      return this.isConnected;
    }
  }

  public isOnlineSync(): boolean {
    return this.isConnected;
  }

  public subscribe(listener: NetworkListener): () => void {
    this.listeners.add(listener);
    // Immediately emit current state
    NetInfo.fetch().then((state) => {
      listener(this.isConnected, state);
    }).catch(() => {
      listener(this.isConnected, {} as NetInfoState);
    });

    return () => {
      this.listeners.delete(listener);
    };
  }

  public cleanup() {
    if (this.unsubscribeNetInfo) {
      this.unsubscribeNetInfo();
      this.unsubscribeNetInfo = null;
    }
    this.listeners.clear();
    this.initialized = false;
  }
}

export const networkService = new NetworkService();
