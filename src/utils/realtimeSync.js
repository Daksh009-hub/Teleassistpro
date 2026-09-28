import { getDB } from './offlineDB.js';

let isInitialized = false;
let eventSource = null;
let lastServerTimestamp = 0;

/**
 * Syncs the local IndexedDB with the central server state.
 */
export async function syncWithServer() {
  if (typeof fetch === 'undefined') return;

  try {
    const res = await fetch(`/api/db?since=${lastServerTimestamp}`);
    if (res.status === 304) return; // Not modified
    if (!res.ok) return;

    const data = await res.json();
    if (!data || typeof data !== 'object') return;

    const db = await getDB();
    const stores = [
      'agents', 'clients', 'policies', 'follow_ups',
      'activities', 'payments', 'leads', 'service_requests',
      'quote_view_events', 'agent_xp_log'
    ];

    for (const store of stores) {
      if (Array.isArray(data[store])) {
        // Clear and reload store with server authoritative list
        const tx = db.transaction(store, 'readwrite');
        await tx.objectStore(store).clear();
        for (const record of data[store]) {
          await tx.objectStore(store).put(record);
        }
        await tx.done;
      }
    }

    if (data.lastUpdated) {
      lastServerTimestamp = data.lastUpdated;
    }

    // Notify all UI components to refresh
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('app-sync-full', { detail: data }));
    }
  } catch (err) {
    // Silent fallback if offline
    console.debug('Server sync fallback (offline):', err);
  }
}

/**
 * Initializes real-time SSE listener and periodic sync.
 */
export function initRealtimeSync() {
  if (isInitialized || typeof window === 'undefined') return;
  isInitialized = true;

  // Initial sync on app load
  syncWithServer();

  // Listen to Window Focus to re-check server
  window.addEventListener('focus', () => syncWithServer());
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') {
      syncWithServer();
    }
  });

  // Connect to SSE for instant push
  connectSSE();
}

function connectSSE() {
  if (typeof window === 'undefined' || typeof EventSource === 'undefined') return;

  try {
    if (eventSource) {
      eventSource.close();
    }

    eventSource = new EventSource('/api/events');

    eventSource.onmessage = async (e) => {
      try {
        const event = JSON.parse(e.data);
        if (event.type === 'db_update') {
          const { store, action, item, id, lastUpdated } = event;
          if (lastUpdated) lastServerTimestamp = lastUpdated;

          const db = await getDB();
          if (action === 'put' && item && item.id) {
            await db.put(store, item);
          } else if (action === 'delete' && id) {
            await db.delete(store, id);
          }

          // Broadcast to React hooks & components
          window.dispatchEvent(new CustomEvent('app-sync-update', { detail: event }));
        }
      } catch (err) {
        console.debug('Error processing SSE event:', err);
      }
    };

    eventSource.onerror = () => {
      // Reconnect after 5 seconds if connection drops
      if (eventSource) {
        eventSource.close();
        eventSource = null;
      }
      setTimeout(connectSSE, 5000);
    };
  } catch (err) {
    console.debug('SSE connection error:', err);
  }
}

/**
 * Pushes a local change to the central server so other devices get it immediately.
 */
export function syncMutationToServer(storeName, action, payload) {
  if (typeof fetch === 'undefined') return;
  if (!storeName || storeName === 'sync_queue') return;

  try {
    if (action === 'put') {
      fetch(`/api/db/${storeName}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      }).catch(() => {});
    } else if (action === 'delete') {
      const id = typeof payload === 'object' ? payload.id : payload;
      if (id) {
        fetch(`/api/db/${storeName}/${id}`, {
          method: 'DELETE'
        }).catch(() => {});
      }
    }
  } catch (err) {
    // Offline resilience
  }
}
