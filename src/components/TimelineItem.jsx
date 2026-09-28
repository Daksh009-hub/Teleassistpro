import React from 'react';

export function TimelineItem({ activity }) {
  const getIconAndColor = () => {
    switch (activity.activity_type) {
      case 'call':
        return { icon: 'bi-telephone-fill', color: 'primary' };
      case 'document':
      case 'kyc':
        return { icon: 'bi-file-earmark-check-fill', color: 'success' };
      case 'follow_up':
        return { icon: 'bi-calendar-check-fill', color: 'info' };
      case 'claim':
        return { icon: 'bi-hospital-fill', color: 'danger' };
      case 'service_request':
        return { icon: 'bi-tools', color: 'warning' };
      default:
        return { icon: 'bi-journal-text', color: 'secondary' };
    }
  };

  const { icon, color } = getIconAndColor();
  const formattedDate = activity.completed_at || activity.created_at
    ? new Date(activity.completed_at || activity.created_at).toLocaleDateString('en-IN', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      })
    : 'Recent';

  return (
    <div className="position-relative mb-3 ps-4">
      {/* Icon Marker */}
      <div
        className={`timeline-marker text-${color} border-${color}`}
        style={{ position: 'absolute', left: '-12px', top: '2px' }}
      >
        <i className={`bi ${icon}`} style={{ fontSize: '0.75rem' }}></i>
      </div>

      {/* Content Box */}
      <div className="bg-white p-3 rounded shadow-sm border">
        <div className="d-flex justify-content-between align-items-baseline mb-1">
          <h6 className="fw-bold small mb-0 text-dark">{activity.title}</h6>
          <span className="text-muted" style={{ fontSize: '0.68rem' }}>
            {formattedDate}
          </span>
        </div>

        {activity.description && (
          <p className="small text-secondary mb-2" style={{ fontSize: '0.8rem' }}>
            {activity.description}
          </p>
        )}

        {/* AI Summary Card */}
        {activity.ai_summary && (
          <div className="bg-primary-subtle border border-primary border-opacity-25 rounded p-2 small mt-2">
            <div className="d-flex align-items-center fw-bold text-primary mb-1" style={{ fontSize: '0.72rem' }}>
              <span className="me-1">✨</span> AI Summary
            </div>
            <div className="text-dark" style={{ fontSize: '0.78rem' }}>
              {activity.ai_summary}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
