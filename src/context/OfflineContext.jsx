import React, { createContext, useContext, useState, useEffect } from 'react';
import { getSyncQueue, clearSyncQueueItem } from '../utils/offlineDB';
import { supabase, isUsingMock } from '../supabaseClient';

export const OfflineContext = createContext();

export function OfflineProvider({ children }) {
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [pendingSyncCount, setPendingSyncCount] = useState(0);
  const [syncMessage, setSyncMessage] = useState(null);

  const checkPendingQueue = async () => {
    try {
      const queue = await getSyncQueue();
      setPendingSyncCount(queue.length);
    } catch (e) {
      console.warn('Queue check error:', e);
    }
  };

  const processSyncQueue = async () => {
    if (!isOnline || isUsingMock) {
      await checkPendingQueue();
      return;
    }

    try {
      const queue = await getSyncQueue();
      if (queue.length === 0) return;

      let syncedCount = 0;
      for (const item of queue) {
        if (item.operation === 'UPSERT') {
          const { error } = await supabase.from(item.table).upsert(item.data);
          if (!error) {
            await clearSyncQueueItem(item.id);
            syncedCount++;
          }
        } else if (item.operation === 'DELETE') {
          const { error } = await supabase.from(item.table).delete().eq('id', item.data.id);
          if (!error) {
            await clearSyncQueueItem(item.id);
            syncedCount++;
          }
        }
      }

      if (syncedCount > 0) {
        setSyncMessage(`Synced ${syncedCount} pending updates with cloud!`);
        setTimeout(() => setSyncMessage(null), 4000);
      }
      await checkPendingQueue();
    } catch (err) {
      console.warn('Sync queue execution error:', err);
    }
  };

  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true);
      processSyncQueue();
    };

    const handleOffline = () => {
      setIsOnline(false);
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    checkPendingQueue();

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, [isOnline]);

  return (
    <OfflineContext.Provider
      value={{
        isOnline,
        pendingSyncCount,
        syncMessage,
        checkPendingQueue,
        processSyncQueue
      }}
    >
      {children}
    </OfflineContext.Provider>
  );
}

export function useOffline() {
  return useContext(OfflineContext);
}
