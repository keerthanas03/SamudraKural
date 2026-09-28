import { networkService } from './networkService';
import { offlineP2PTransport } from './transports/offlineP2PTransport';
import { onlineTransport } from './transports/onlineTransport';

class SOSSyncService {
  private isSyncing: boolean = false;
  private syncListeners: Set<(count: number) => void> = new Set();
  private initialized: boolean = false;

  constructor() {
    this.init();
  }

  public init() {
    if (this.initialized) return;
    this.initialized = true;

    // Listen for network recovery
    networkService.subscribe((isOnline) => {
      if (isOnline) {
        console.log('[SOSSyncService] Network restored. Triggering offline sync...');
        this.syncPendingData();
      }
    });
  }

  public onSyncCompleted(listener: (count: number) => void): () => void {
    this.syncListeners.add(listener);
    return () => {
      this.syncListeners.delete(listener);
    };
  }

  public async syncPendingData(): Promise<number> {
    if (this.isSyncing) {
      console.log('[SOSSyncService] Sync already in progress, skipping concurrent run.');
      return 0;
    }

    const isOnline = await networkService.getIsOnline();
    if (!isOnline) {
      return 0;
    }

    this.isSyncing = true;
    let syncedCount = 0;

    try {
      // 1. Sync pending offline SOS alerts
      const pendingSOS = await offlineP2PTransport.getQueuedSOS();
      console.log(`[SOSSyncService] Found ${pendingSOS.length} pending offline SOS records.`);

      for (const packet of pendingSOS) {
        try {
          console.log(`[SOSSyncService] Uploading offline SOS ${packet.public_sos_id} to server...`);
          await onlineTransport.sendSOS({
            ...packet,
            delivery_status: 'SYNCED',
          });
          // Remove only on successful upload
          await offlineP2PTransport.removeQueuedSOS(packet.public_sos_id);
          syncedCount += 1;
        } catch (err) {
          console.error(`[SOSSyncService] Failed to sync SOS ${packet.public_sos_id}:`, err);
        }
      }

      // 2. Sync pending offline responses
      const pendingResponses = await offlineP2PTransport.getQueuedResponses();
      console.log(`[SOSSyncService] Found ${pendingResponses.length} pending offline responses.`);

      for (const resp of pendingResponses) {
        try {
          console.log(`[SOSSyncService] Uploading offline response for SOS ${resp.public_sos_id}...`);
          await onlineTransport.sendResponse(resp);
          await offlineP2PTransport.removeQueuedResponses(resp.public_sos_id);
          syncedCount += 1;
        } catch (err) {
          console.error(`[SOSSyncService] Failed to sync response for ${resp.public_sos_id}:`, err);
        }
      }

      if (syncedCount > 0) {
        console.log(`[SOSSyncService] Successfully synchronized ${syncedCount} records.`);
        this.syncListeners.forEach((l) => l(syncedCount));
      }
    } catch (err) {
      console.error('[SOSSyncService] Sync error:', err);
    } finally {
      this.isSyncing = false;
    }

    return syncedCount;
  }
}

export const sosSyncService = new SOSSyncService();
