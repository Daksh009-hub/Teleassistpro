import React, { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { getAllFromStore } from '../utils/offlineDB';
import { WhatsAppTemplatePicker } from '../components/WhatsAppTemplatePicker';
import { buildPublicUrl } from '../utils/publicUrl';

export function QuoteTracker() {
  const { policyId } = useParams();
  const [policy, setPolicy] = useState(null);
  const [client, setClient] = useState(null);
  const [viewEvents, setViewEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState(false);
  const [showWhatsApp, setShowWhatsApp] = useState(false);

  useEffect(() => {
    async function loadData() {
      setLoading(true);
      const allPolicies = await getAllFromStore('policies');
      const found = allPolicies.find(p => p.id === policyId || p.trackable_link === policyId);
      setPolicy(found || null);

      if (found) {
        const allClients = await getAllFromStore('clients');
        const c = allClients.find(item => item.id === found.client_id);
        setClient(c || null);

        const allEvents = await getAllFromStore('quote_view_events');
        const events = allEvents.filter(e => e.policy_id === found.id);
        setViewEvents(events);
      }
      setLoading(false);
    }
    loadData();
  }, [policyId]);

  if (loading) {
    return (
      <div className="container py-4 text-center">
        <div className="spinner-border text-primary" role="status"></div>
      </div>
    );
  }

  if (!policy) {
    return (
      <div className="container py-4 text-center">
        <h5>Policy quote not found</h5>
        <Link to="/dashboard" className="btn btn-sm btn-primary mt-2">Back to Dashboard</Link>
      </div>
    );
  }

  const publicLink = buildPublicUrl(`/view/${policy.trackable_link || 'demo'}`);

  const handleCopyLink = () => {
    navigator.clipboard.writeText(publicLink);
    setCopied(true);
    setTimeout(() => setCopied(false), 3000);
  };

  const totalTimeMinutes = Math.floor((policy.quote_total_time_sec || 0) / 60);
  const totalTimeSeconds = (policy.quote_total_time_sec || 0) % 60;

  return (
    <div className="container py-3 px-3">
      {/* Header */}
      <div className="d-flex justify-content-between align-items-center mb-3">
        <Link to={client ? `/client/${client.id}` : '/dashboard'} className="btn btn-sm btn-light border py-1 px-2 d-flex align-items-center">
          <i className="bi bi-arrow-left me-1"></i> Back
        </Link>
        <span className="badge bg-primary text-white">📊 Smart Quote Tracker</span>
      </div>

      {/* Quote Summary Card */}
      <div className="card shadow-sm border-0 mb-3 bg-white">
        <div className="card-body p-3">
          <div className="d-flex justify-content-between align-items-start mb-2">
            <div>
              <h5 className="fw-bold mb-0 text-primary">{policy.policy_name}</h5>
              <div className="small text-muted">Shared with: {client?.full_name || 'Client'} ({client?.phone})</div>
            </div>
            <span className="badge bg-light text-dark border">
              Sum Assured: ₹{(policy.sum_assured || 0).toLocaleString('en-IN')}
            </span>
          </div>

          {/* Share Link Box */}
          <div className="bg-light p-2 rounded border mb-3">
            <label className="form-label small fw-bold text-muted mb-1">TRACKABLE CLIENT VIEW LINK</label>
            <div className="input-group input-group-sm mb-2">
              <input type="text" className="form-control bg-white font-monospace small" readOnly value={publicLink} />
              <button className="btn btn-outline-primary" onClick={handleCopyLink}>
                {copied ? <i className="bi bi-check2"></i> : <i className="bi bi-clipboard"></i>}
              </button>
            </div>
            <div className="d-flex gap-2">
              <button
                type="button"
                className="btn btn-sm btn-success flex-fill d-flex align-items-center justify-content-center"
                onClick={() => setShowWhatsApp(true)}
              >
                <i className="bi bi-whatsapp me-1"></i> Share Quote via WhatsApp
              </button>
              <a
                href={publicLink}
                target="_blank"
                rel="noreferrer"
                className="btn btn-sm btn-outline-secondary"
                title="Preview client view"
              >
                <i className="bi bi-box-arrow-up-right"></i>
              </a>
            </div>
          </div>

          {/* Realtime Analytics Grid */}
          <h6 className="fw-bold small text-muted text-uppercase mb-2">Engagement Analytics</h6>
          <div className="row g-2 mb-3">
            <div className="col-4">
              <div className="bg-primary-subtle border border-primary border-opacity-25 rounded p-2 text-center">
                <div className="fs-4 fw-bold text-primary">{policy.link_views || 0}</div>
                <div className="text-muted" style={{ fontSize: '0.68rem' }}>Total Opens</div>
              </div>
            </div>
            <div className="col-4">
              <div className="bg-info-subtle border border-info border-opacity-25 rounded p-2 text-center">
                <div className="fs-5 fw-bold text-info mt-1">
                  {totalTimeMinutes}m {totalTimeSeconds}s
                </div>
                <div className="text-muted" style={{ fontSize: '0.68rem' }}>Time Spent</div>
              </div>
            </div>
            <div className="col-4">
              <div className="bg-success-subtle border border-success border-opacity-25 rounded p-2 text-center">
                <div className="fs-5 fw-bold text-success mt-1 text-capitalize">
                  {policy.quote_device_type || 'Mobile'}
                </div>
                <div className="text-muted" style={{ fontSize: '0.68rem' }}>Top Device</div>
              </div>
            </div>
          </div>

          {/* Last Viewed details */}
          <div className="small text-muted bg-light p-2 rounded mb-3">
            <i className="bi bi-clock-history me-1"></i>
            Last Viewed: <strong>{policy.quote_last_viewed_at ? new Date(policy.quote_last_viewed_at).toLocaleString('en-IN') : 'Not opened yet'}</strong>
          </div>
        </div>
      </div>

      {/* View Events Timeline (PRD Section 14) */}
      <div className="card shadow-sm border-0 mb-3 bg-white">
        <div className="card-header bg-white border-0 pt-3 pb-1 px-3">
          <h6 className="fw-bold mb-0 text-dark d-flex align-items-center">
            <i className="bi bi-list-check text-primary me-2"></i>
            Individual Open Sessions
          </h6>
        </div>
        <div className="card-body p-3">
          {viewEvents.length === 0 ? (
            <div className="text-center py-3 text-muted small">
              No sessions recorded yet. Open the link in a new window to test live duration tracking!
            </div>
          ) : (
            <ul className="list-group list-group-flush">
              {viewEvents.map((evt, idx) => (
                <li key={evt.id || idx} className="list-group-item px-0 py-2 d-flex justify-content-between align-items-center">
                  <div>
                    <div className="fw-semibold small text-dark d-flex align-items-center">
                      <span className="me-2">{evt.device_type === 'desktop' ? '💻' : '📱'}</span>
                      Session #{idx + 1} ({evt.device_type || 'Mobile'})
                    </div>
                    <div className="text-muted" style={{ fontSize: '0.7rem' }}>
                      {new Date(evt.viewed_at).toLocaleString('en-IN')}
                    </div>
                  </div>
                  <span className="badge bg-light text-dark border">
                    ⏱ {Math.floor((evt.time_spent_sec || 0) / 60)}m {(evt.time_spent_sec || 0) % 60}s
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      {/* WhatsApp Template Picker */}
      {showWhatsApp && (
        <div
          className="modal show d-block"
          tabIndex="-1"
          style={{ backgroundColor: 'rgba(0,0,0,0.6)', zIndex: 1060 }}
          onClick={(e) => { if (e.target === e.currentTarget) setShowWhatsApp(false); }}
        >
          <div className="modal-dialog modal-dialog-centered">
            <WhatsAppTemplatePicker
              client={client || {}}
              policy={policy}
              defaultTemplate="quote_followup"
              onClose={() => setShowWhatsApp(false)}
            />
          </div>
        </div>
      )}
    </div>
  );
}
