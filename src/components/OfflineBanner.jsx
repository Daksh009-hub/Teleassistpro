import React from 'react';
import { useOffline } from '../context/OfflineContext';

export function OfflineBanner() {
  const { isOnline, pendingSyncCount, syncMessage, processSyncQueue } = useOffline();

  if (syncMessage) {
    return (
      <div className="bg-success text-white py-1 px-3 text-center small d-flex align-items-center justify-content-center animate__animated animate__fadeIn">
        <i className="bi bi-cloud-check-fill me-2"></i>
        <span>{syncMessage}</span>
      </div>
    );
  }

  if (!isOnline) {
    return (
      <div className="bg-dark text-white py-1 px-3 text-center small d-flex align-items-center justify-content-between">
        <div className="d-flex align-items-center">
          <i className="bi bi-wifi-off text-warning me-2"></i>
          <span>Offline Mode — {pendingSyncCount} changes queued</span>
        </div>
        <button
          className="btn btn-outline-light btn-sm py-0 px-2"
          style={{ fontSize: '0.7rem' }}
          onClick={() => processSyncQueue()}
        >
          Retry
        </button>
      </div>
    );
  }

  return null;
}
