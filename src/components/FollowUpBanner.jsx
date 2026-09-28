import React, { useState } from 'react';

export function FollowUpBanner({ overdueList = [], onMarkDone, onReschedule }) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [rescheduleId, setRescheduleId] = useState(null);
  const [newDate, setNewDate] = useState('');

  if (!overdueList || overdueList.length === 0) return null;

  const handleSaveReschedule = (id) => {
    if (newDate) {
      onReschedule(id, newDate);
      setRescheduleId(null);
      setNewDate('');
    }
  };

  return (
    <div className="card border-0 shadow-sm mb-3 bg-danger-subtle border-start border-danger border-4">
      <div className="card-body p-3">
        <div className="d-flex justify-content-between align-items-center">
          <div className="d-flex align-items-center">
            <span className="fs-5 me-2 text-danger">⚠️</span>
            <div>
              <div className="fw-bold text-danger small">
                {overdueList.length} Follow-up{overdueList.length > 1 ? 's' : ''} Overdue
              </div>
              <div className="text-muted" style={{ fontSize: '0.72rem' }}>
                Pending action required to prevent client churn
              </div>
            </div>
          </div>
          <button
            className="btn btn-sm btn-outline-danger py-1 px-2"
            style={{ fontSize: '0.75rem' }}
            onClick={() => setIsExpanded(!isExpanded)}
          >
            {isExpanded ? 'Hide' : 'Review'}
          </button>
        </div>

        {isExpanded && (
          <div className="mt-3 pt-2 border-top border-danger-subtle">
            {overdueList.map(item => (
              <div key={item.id} className="bg-white p-2 rounded mb-2 border border-danger-subtle">
                <div className="d-flex justify-content-between align-items-start mb-1">
                  <span className="badge bg-danger-subtle text-danger text-uppercase" style={{ fontSize: '0.65rem' }}>
                    {item.action_type || 'Follow-up'} • Due {item.due_date}
                  </span>
                  {item.auto_created && (
                    <span className="badge bg-info-subtle text-info border border-info" style={{ fontSize: '0.6rem' }}>
                      ✨ AI Scheduled
                    </span>
                  )}
                </div>

                <div className="small fw-semibold text-dark mb-2">
                  {item.notes}
                </div>

                {rescheduleId === item.id ? (
                  <div className="d-flex gap-2 align-items-center mt-2">
                    <input
                      type="date"
                      className="form-control form-control-sm"
                      value={newDate}
                      onChange={(e) => setNewDate(e.target.value)}
                    />
                    <button
                      className="btn btn-sm btn-primary"
                      onClick={() => handleSaveReschedule(item.id)}
                    >
                      Save
                    </button>
                    <button
                      className="btn btn-sm btn-outline-secondary"
                      onClick={() => setRescheduleId(null)}
                    >
                      Cancel
                    </button>
                  </div>
                ) : (
                  <div className="d-flex gap-2">
                    <button
                      type="button"
                      className="btn btn-sm btn-success flex-fill py-0"
                      style={{ fontSize: '0.75rem' }}
                      onClick={() => onMarkDone(item.id)}
                    >
                      <i className="bi bi-check-lg me-1"></i> Mark Done
                    </button>
                    <button
                      type="button"
                      className="btn btn-sm btn-outline-secondary flex-fill py-0"
                      style={{ fontSize: '0.75rem' }}
                      onClick={() => {
                        setRescheduleId(item.id);
                        setNewDate(new Date(Date.now() + 86400000).toISOString().split('T')[0]);
                      }}
                    >
                      <i className="bi bi-calendar-date me-1"></i> Reschedule
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
