import { openDB } from 'idb';
import {
  INITIAL_AGENT,
  INITIAL_CLIENTS,
  INITIAL_POLICIES,
  INITIAL_FOLLOW_UPS,
  INITIAL_ACTIVITIES,
  INITIAL_PAYMENTS,
  INITIAL_LEADS,
  INITIAL_SERVICE_REQUESTS,
  INITIAL_QUOTE_EVENTS
} from './mockData.js';
import { syncMutationToServer } from './realtimeSync.js';

const DB_NAME = 'tele_assist_pro_db';
const DB_VERSION = 3;

let dbPromise = null;

export function getDB() {
  if (!dbPromise) {
    dbPromise = openDB(DB_NAME, DB_VERSION, {
      upgrade(db, oldVersion) {
        const storeNames = [
          'agents', 'clients', 'policies', 'follow_ups', 'activities',
          'payments', 'leads', 'service_requests', 'quote_view_events',
          'agent_xp_log', 'kyc_documents', 'sync_queue'
        ];

        storeNames.forEach(name => {
          if (!db.objectStoreNames.contains(name)) {
            const keyPath = name === 'sync_queue' ? { keyPath: 'id', autoIncrement: true } : { keyPath: 'id' };
            const store = db.createObjectStore(name, keyPath);
            if (name === 'clients') {
              store.createIndex('by_agent', 'agent_id');
              store.createIndex('by_status', 'status');
            }
            if (name === 'policies') {
              store.createIndex('by_client', 'client_id');
              store.createIndex('by_trackable_link', 'trackable_link');
            }
            if (name === 'follow_ups') {
              store.createIndex('by_due_date', 'due_date');
              store.createIndex('by_status', 'status');
            }
          }
        });
      }
    });
  }
  return dbPromise;
}

// Seed initial data if DB is empty
export async function initializeIndexedDB() {
  try {
    const db = await getDB();
    const clientCount = await db.count('clients').catch(() => 0);
    
    if (clientCount === 0) {
      const tx = db.transaction(
        ['agents', 'clients', 'policies', 'follow_ups', 'activities', 'payments', 'leads', 'service_requests', 'quote_view_events', 'agent_xp_log'],
        'readwrite'
      );

      await tx.objectStore('agents').put(INITIAL_AGENT);
      
      for (const c of INITIAL_CLIENTS) {
        await tx.objectStore('clients').put(c);
      }
      for (const p of INITIAL_POLICIES) {
        await tx.objectStore('policies').put(p);
      }
      for (const f of INITIAL_FOLLOW_UPS) {
        await tx.objectStore('follow_ups').put(f);
      }
      for (const a of INITIAL_ACTIVITIES) {
        await tx.objectStore('activities').put(a);
      }
      for (const py of INITIAL_PAYMENTS) {
        await tx.objectStore('payments').put(py);
      }
      for (const l of INITIAL_LEADS) {
        await tx.objectStore('leads').put(l);
      }
      for (const s of INITIAL_SERVICE_REQUESTS) {
        await tx.objectStore('service_requests').put(s);
      }
      for (const qe of INITIAL_QUOTE_EVENTS) {
        await tx.objectStore('quote_view_events').put(qe);
      }

      await tx.objectStore('agent_xp_log').put({
        id: 'xp-init-1',
        agent_id: INITIAL_AGENT.id,
        action: 'daily_goal',
        xp_earned: 50,
        description: 'Completed daily follow-ups goal',
        earned_at: new Date(Date.now() - 86400000).toISOString()
      });

      await tx.done;
    }
  } catch (err) {
    console.warn('IndexedDB init warning:', err);
  }
}

// Fallback seed mapping in memory
const FALLBACK_SEED = {
  agents: [INITIAL_AGENT],
  clients: INITIAL_CLIENTS,
  policies: INITIAL_POLICIES,
  follow_ups: INITIAL_FOLLOW_UPS,
  activities: INITIAL_ACTIVITIES,
  payments: INITIAL_PAYMENTS,
  leads: INITIAL_LEADS,
  service_requests: INITIAL_SERVICE_REQUESTS,
  quote_view_events: INITIAL_QUOTE_EVENTS,
  agent_xp_log: []
};

// Generic CRUD helpers for offline store
export async function getFromStore(storeName, key) {
  try {
    const db = await getDB();
    const item = await db.get(storeName, key);
    if (item) return item;
  } catch (e) {}

  const fallbackList = FALLBACK_SEED[storeName] || [];
  return fallbackList.find(item => item.id === key) || null;
}

export async function getAllFromStore(storeName) {
  try {
    const db = await getDB();
    const items = await db.getAll(storeName);
    if (items && items.length > 0) return items;
    
    // Auto-seed if empty
    await initializeIndexedDB();
    const recheck = await db.getAll(storeName);
    if (recheck && recheck.length > 0) return recheck;
  } catch (e) {}

  // Fallback to rich seed list if IndexedDB not yet ready
  return FALLBACK_SEED[storeName] || [];
}

export async function putInStore(storeName, val, recordSync = true) {
  try {
    const db = await getDB();
    await db.put(storeName, val);
    
    if (recordSync) {
      try {
        await db.put('sync_queue', {
          table: storeName,
          operation: 'UPSERT',
          data: val,
          timestamp: Date.now(),
          synced: false
        });
      } catch (e) {}
    }
  } catch (e) {}

  // Update in-memory fallback list too
  if (FALLBACK_SEED[storeName]) {
    const idx = FALLBACK_SEED[storeName].findIndex(item => item.id === val.id);
    if (idx >= 0) {
      FALLBACK_SEED[storeName][idx] = val;
    } else {
      FALLBACK_SEED[storeName].push(val);
    }
  }

  // Push mutation to central server for instant global sync across all devices
  syncMutationToServer(storeName, 'put', val);

  return val;
}

export async function deleteFromStore(storeName, key, recordSync = true) {
  try {
    const db = await getDB();
    await db.delete(storeName, key);
    
    if (recordSync) {
      try {
        await db.put('sync_queue', {
          table: storeName,
          operation: 'DELETE',
          data: { id: key },
          timestamp: Date.now(),
          synced: false
        });
      } catch (e) {}
    }
  } catch (e) {}

  if (FALLBACK_SEED[storeName]) {
    FALLBACK_SEED[storeName] = FALLBACK_SEED[storeName].filter(item => item.id !== key);
  }

  // Push deletion to central server for instant global sync across all devices
  syncMutationToServer(storeName, 'delete', key);

  return true;
}

export async function getSyncQueue() {
  try {
    const db = await getDB();
    return await db.getAll('sync_queue');
  } catch (e) {
    return [];
  }
}

export async function clearSyncQueueItem(id) {
  try {
    const db = await getDB();
    return await db.delete('sync_queue', id);
  } catch (e) {}
}
