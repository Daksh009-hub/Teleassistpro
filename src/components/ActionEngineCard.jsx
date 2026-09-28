import React from 'react';

export function ActionEngineCard({
  followUpsCount = 0,
  callbacksCount = 0,
  docsPendingCount = 0,
  missedCount = 0,
  activeFilter = 'all',
  onSelectFilter
}) {
  const filters = [
    { id: 'all', label: 'All Clients', count: null, icon: 'bi-people-fill', color: 'primary' },
    { id: 'follow_up', label: 'Follow-ups', count: followUpsCount, icon: 'bi-calendar-event', color: 'info' },
    { id: 'callback', label: 'Callbacks', count: callbacksCount, icon: 'bi-telephone-inbound', color: 'success' },
    { id: 'docs', label: 'Docs Pending', count: docsPendingCount, icon: 'bi-file-earmark-text', color: 'warning' },
    { id: 'missed', label: 'Overdue', count: missedCount, icon: 'bi-exclamation-triangle', color: 'danger' }
  ];

  return (
    <div className="card shadow-sm border-0 mb-3 bg-white">
      <div className="card-body p-3">
        <div className="d-flex justify-content-between align-items-center mb-2">
          <div className="fw-bold small text-muted text-uppercase d-flex align-items-center">
            <i className="bi bi-lightning-charge-fill text-warning me-1"></i>
            Today's Action Engine
          </div>
          <span className="badge bg-light text-dark border">
            {new Date().toLocaleDateString('en-IN', { weekday: 'short', month: 'short', day: 'numeric' })}
          </span>
        </div>

        <div className="d-flex gap-2 overflow-x-auto pb-1" style={{ scrollbarWidth: 'none' }}>
          {filters.map(f => {
            const isSelected = activeFilter === f.id;
            return (
              <button
                key={f.id}
                type="button"
                className={`btn btn-sm d-flex flex-column align-items-center justify-content-center p-2 rounded-3 text-nowrap action-engine-badge ${
                  isSelected
                    ? `btn-${f.color} shadow-sm text-white`
                    : `btn-outline-${f.color} bg-${f.color}-subtle border-0 text-${f.color}`
                }`}
                style={{ minWidth: '78px', flex: '1 0 auto' }}
                onClick={() => onSelectFilter(activeFilter === f.id ? 'all' : f.id)}
              >
                <div className="d-flex align-items-center mb-1">
                  <i className={`bi ${f.icon} me-1`}></i>
                  {f.count !== null && (
                    <span className="fw-bold">{f.count}</span>
                  )}
                </div>
                <span style={{ fontSize: '0.68rem' }}>{f.label}</span>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
