import React, { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { getAllFromStore, putInStore } from '../utils/offlineDB';
import { useGamification } from '../context/GamificationContext';

export function ReferralMap() {
  const { id } = useParams();
  const { awardXP } = useGamification();

  const [currentClient, setCurrentClient] = useState(null);
  const [allClients, setAllClients] = useState([]);
  const [policies, setPolicies] = useState([]);
  const [loading, setLoading] = useState(true);

  const [showAddReferralModal, setShowAddReferralModal] = useState(false);
  const [selectedReferredId, setSelectedReferredId] = useState('');

  const loadReferralData = async () => {
    setLoading(true);
    const clients = await getAllFromStore('clients');
    setAllClients(clients);
    const c = clients.find(item => item.id === id);
    setCurrentClient(c || null);

    const pols = await getAllFromStore('policies');
    setPolicies(pols);
    setLoading(false);
  };

  useEffect(() => {
    loadReferralData();
  }, [id]);

  const handleLinkReferral = async () => {
    if (!selectedReferredId) return;
    const target = allClients.find(c => c.id === selectedReferredId);
    if (target) {
      const updated = { ...target, referral_from: id };
      await putInStore('clients', updated);
      await awardXP('client_added', `Linked referral: ${target.full_name} referred by ${currentClient.full_name}`);
      setShowAddReferralModal(false);
      await loadReferralData();
    }
  };

  if (loading) {
    return (
      <div className="container py-4 text-center">
        <div className="spinner-border text-primary" role="status"></div>
      </div>
    );
  }

  // Find Who Referred This Client
  const referrer = allClients.find(c => c.id === currentClient?.referral_from);

  // Find Clients Referred By This Client
  const referredByThis = allClients.filter(c => c.referral_from === id);

  return (
    <div className="container py-3 px-3">
      {/* Header */}
      <div className="d-flex justify-content-between align-items-center mb-3">
        <Link to={`/client/${id}`} className="btn btn-sm btn-light border py-1 px-2 d-flex align-items-center">
          <i className="bi bi-arrow-left me-1"></i> Back to Profile
        </Link>
        <span className="badge bg-secondary text-white">🌳 Referral Network</span>
      </div>

      <div className="card shadow-sm border-0 mb-3 bg-white">
        <div className="card-body p-3 text-center">
          <h5 className="fw-bold text-dark mb-1">Referral Network: {currentClient?.full_name}</h5>
          <p className="text-muted small mb-3">
            Track word-of-mouth client introductions and high-conversion referral trees.
          </p>

          <button
            className="btn btn-sm btn-primary py-1 px-3 mb-3 fw-bold"
            onClick={() => setShowAddReferralModal(true)}
          >
            + Link Referred Client
          </button>

          {/* Visual Referral Tree Layout */}
          <div className="bg-light p-3 rounded border">
            {/* Level 1: Referrer (if any) */}
            {referrer && (
              <div className="mb-3">
                <div className="small text-muted text-uppercase mb-1">Referred By:</div>
                <div className="card bg-white border border-primary p-2 d-inline-block shadow-sm">
                  <div className="fw-bold text-primary small">{referrer.full_name}</div>
                  <div className="text-muted" style={{ fontSize: '0.7rem' }}>{referrer.phone}</div>
                </div>
                <div className="text-primary fs-5 my-1">↓</div>
              </div>
            )}

            {/* Level 2: Current Focus Client */}
            <div className="card bg-primary text-white p-3 d-inline-block shadow mx-auto mb-3" style={{ minWidth: '220px', borderRadius: '12px' }}>
              <div className="fw-bold fs-6">{currentClient?.full_name}</div>
              <div className="small opacity-75">{currentClient?.phone}</div>
              <div className="badge bg-warning text-dark mt-2">
                {policies.filter(p => p.client_id === id).length} Policies Active
              </div>
            </div>

            {/* Level 3: Downline Referrals */}
            <div>
              <div className="text-success fs-5 my-1">↓</div>
              <div className="small text-muted text-uppercase mb-2">Introduced / Referred Clients ({referredByThis.length}):</div>

              {referredByThis.length === 0 ? (
                <div className="small text-muted italic bg-white p-2 rounded border d-inline-block">
                  No downstream referrals linked yet.
                </div>
              ) : (
                <div className="d-flex flex-wrap gap-2 justify-content-center">
                  {referredByThis.map(ref => (
                    <div key={ref.id} className="card bg-white border border-success p-2 shadow-sm text-start" style={{ minWidth: '160px' }}>
                      <div className="fw-bold text-success small">{ref.full_name}</div>
                      <div className="text-muted" style={{ fontSize: '0.7rem' }}>{ref.phone}</div>
                      <Link to={`/client/${ref.id}`} className="small text-decoration-none mt-1" style={{ fontSize: '0.72rem' }}>
                        Open 360° Profile →
                      </Link>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Link Referral Modal */}
      {showAddReferralModal && (
        <div
          className="modal show d-block"
          tabIndex="-1"
          style={{ backgroundColor: 'rgba(0,0,0,0.6)', zIndex: 1060 }}
          onClick={(e) => { if (e.target === e.currentTarget) setShowAddReferralModal(false); }}
        >
          <div className="modal-dialog modal-dialog-centered">
            <div className="modal-content border-0 shadow">
              <div className="modal-header bg-primary text-white">
                <h5 className="modal-title fs-6 fw-bold">Link Referred Client</h5>
                <button type="button" className="btn-close btn-close-white" onClick={() => setShowAddReferralModal(false)}></button>
              </div>
              <div className="modal-body">
                <p className="small text-muted">
                  Select which client was introduced by <strong>{currentClient?.full_name}</strong>:
                </p>
                <select
                  className="form-select form-select-sm mb-3"
                  value={selectedReferredId}
                  onChange={(e) => setSelectedReferredId(e.target.value)}
                >
                  <option value="">Choose client...</option>
                  {allClients
                    .filter(c => c.id !== id && c.referral_from !== id)
                    .map(c => (
                      <option key={c.id} value={c.id}>
                        {c.full_name} ({c.phone})
                      </option>
                    ))}
                </select>
              </div>
              <div className="modal-footer bg-light p-2 d-flex justify-content-between">
                <button type="button" className="btn btn-sm btn-secondary" onClick={() => setShowAddReferralModal(false)}>
                  Cancel
                </button>
                <button
                  type="button"
                  className="btn btn-sm btn-primary px-3 fw-bold"
                  disabled={!selectedReferredId}
                  onClick={handleLinkReferral}
                >
                  Link to Referral Tree
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
