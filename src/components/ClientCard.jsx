import React from 'react';
import { Link } from 'react-router-dom';

export function ClientCard({
  client,
  policiesCount = 0,
  nextFollowUp = null,
  onInitiateCall,
  onOpenWhatsApp
}) {
  const isOverdue = nextFollowUp && nextFollowUp.due_date < new Date().toISOString().split('T')[0] && nextFollowUp.status === 'pending';
  const isDueToday = nextFollowUp && nextFollowUp.due_date === new Date().toISOString().split('T')[0] && nextFollowUp.status === 'pending';

  const getStatusBorder = () => {
    if (isOverdue) return 'border-start border-danger border-4';
    if (isDueToday) return 'border-start border-warning border-4';
    if (client.status === 'cold') return 'border-start border-secondary border-4';
    return 'border-start border-success border-4';
  };

  const getKYCBadge = () => {
    switch (client.kyc_status) {
      case 'verified':
        return <span className="badge bg-success-subtle text-success border border-success" style={{ fontSize: '0.65rem' }}>✓ KYC Verified</span>;
      case 'flagged':
        return <span className="badge bg-danger-subtle text-danger border border-danger" style={{ fontSize: '0.65rem' }}>⚠️ KYC Mismatch</span>;
      default:
        return <span className="badge bg-warning-subtle text-warning border border-warning" style={{ fontSize: '0.65rem' }}>⌛ KYC Pending</span>;
    }
  };

  return (
    <div className={`card shadow-sm mb-2 border-0 bg-white ${getStatusBorder()}`}>
      <div className="card-body p-3">
        <div className="d-flex justify-content-between align-items-start mb-1">
          <Link to={`/client/${client.id}`} className="text-decoration-none text-dark flex-grow-1">
            <h6 className="fw-bold mb-0 text-primary d-flex align-items-center">
              {client.full_name}
              {client.family_head_id && (
                <span className="badge bg-light text-muted ms-2 fw-normal" style={{ fontSize: '0.65rem' }}>
                  Family Member
                </span>
              )}
            </h6>
            <div className="small text-muted d-flex align-items-center mt-1">
              <i className="bi bi-telephone-fill me-1 text-secondary" style={{ fontSize: '0.75rem' }}></i>
              <span>{client.phone || 'No phone'}</span>
              <span className="mx-2">•</span>
              <i className="bi bi-shield-check me-1 text-secondary" style={{ fontSize: '0.75rem' }}></i>
              <span>{policiesCount} {policiesCount === 1 ? 'Policy' : 'Policies'}</span>
            </div>
          </Link>

          <div>{getKYCBadge()}</div>
        </div>

        {/* Tags */}
        {client.tags && client.tags.length > 0 && (
          <div className="d-flex flex-wrap gap-1 mb-2 mt-1">
            {client.tags.slice(0, 3).map((tag, i) => (
              <span key={i} className="badge bg-light text-secondary border" style={{ fontSize: '0.62rem' }}>
                {tag}
              </span>
            ))}
          </div>
        )}

        {/* Next Action / Follow-up line */}
        {nextFollowUp && (
          <div className="bg-light p-2 rounded small mb-2 d-flex justify-content-between align-items-center">
            <div className="text-truncate me-2" style={{ fontSize: '0.75rem' }}>
              <i className={`bi ${isOverdue ? 'bi-exclamation-circle-fill text-danger' : 'bi-clock-fill text-warning'} me-1`}></i>
              <span className={isOverdue ? 'text-danger fw-bold' : ''}>
                {nextFollowUp.action_type || 'Follow-up'}: {nextFollowUp.notes || 'Scheduled'}
              </span>
            </div>
            <span className="badge bg-white text-muted border text-nowrap" style={{ fontSize: '0.65rem' }}>
              {nextFollowUp.due_date}
            </span>
          </div>
        )}

        {/* Action Buttons */}
        <div className="d-flex gap-2 pt-1 border-top">
          <button
            type="button"
            className="btn btn-sm btn-outline-primary flex-fill d-flex align-items-center justify-content-center py-1"
            style={{ fontSize: '0.8rem' }}
            onClick={() => onInitiateCall(client)}
          >
            <i className="bi bi-telephone-outbound-fill me-1"></i>
            Call Client
          </button>

          <button
            type="button"
            className="btn btn-sm btn-outline-success px-3 d-flex align-items-center justify-content-center py-1"
            style={{ fontSize: '0.8rem' }}
            onClick={() => onOpenWhatsApp(client)}
          >
            <i className="bi bi-whatsapp me-1"></i>
            WhatsApp
          </button>

          <Link
            to={`/client/${client.id}`}
            className="btn btn-sm btn-light border px-2 py-1"
            title="360° Profile"
          >
            <i className="bi bi-chevron-right"></i>
          </Link>
        </div>
      </div>
    </div>
  );
}
