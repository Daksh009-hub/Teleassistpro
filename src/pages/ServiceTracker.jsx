import React, { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { getAllFromStore, putInStore } from '../utils/offlineDB';
import { useGamification } from '../context/GamificationContext';

const STAGES = ['received', 'doc_pending', 'processing', 'completed'];
const STAGE_LABELS = {
  received: '1. Received',
  doc_pending: '2. Doc Pending',
  processing: '3. Processing',
  completed: '4. Completed'
};

export function ServiceTracker() {
  const { id } = useParams();
  const { awardXP } = useGamification();

  const [client, setClient] = useState(null);
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);

  // New Request Form
  const [showNewModal, setShowNewModal] = useState(false);
  const [newType, setNewType] = useState('nominee_change');
  const [newNotes, setNewNotes] = useState('');

  const loadRequests = async () => {
    setLoading(true);
    const clients = await getAllFromStore('clients');
    const c = clients.find(item => item.id === id);
    setClient(c || null);

    const allReqs = await getAllFromStore('service_requests');
    setRequests(allReqs.filter(r => r.client_id === id));
    setLoading(false);
  };

  useEffect(() => {
    loadRequests();
  }, [id]);

  const handleCreateRequest = async (e) => {
    e.preventDefault();
    const req = {
      id: `sr-${Date.now()}`,
      client_id: id,
      request_type: newType,
      status: 'received',
      notes: newNotes,
      documents: [],
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };

    await putInStore('service_requests', req);
    setShowNewModal(false);
    setNewNotes('');
    await awardXP('call_logged', `Created service request (${newType}) for ${client.full_name}`);
    await loadRequests();
  };

  const handleUpdateStatus = async (reqId, newStatus) => {
    const existing = requests.find(r => r.id === reqId);
    if (!existing) return;

    const updated = {
      ...existing,
      status: newStatus,
      updated_at: new Date().toISOString()
    };

    await putInStore('service_requests', updated);
    if (newStatus === 'completed') {
      await awardXP('followup_done', `Completed service request: ${existing.request_type}`);
    }
    await loadRequests();
  };

  if (loading) {
    return (
      <div className="container py-4 text-center">
        <div className="spinner-border text-primary" role="status"></div>
      </div>
    );
  }

  return (
    <div className="container py-3 px-3">
      {/* Header */}
      <div className="d-flex justify-content-between align-items-center mb-3">
        <Link to={`/client/${id}`} className="btn btn-sm btn-light border py-1 px-2 d-flex align-items-center">
          <i className="bi bi-arrow-left me-1"></i> Back to Profile
        </Link>
        <span className="badge bg-warning text-dark">📋 Service & Claim Tracker</span>
      </div>

      <div className="d-flex justify-content-between align-items-center mb-3">
        <div>
          <h5 className="fw-bold mb-0 text-dark">Service Requests for {client?.full_name}</h5>
          <div className="small text-muted">Track endorsements, nominee changes, address updates and claims</div>
        </div>
        <button
          className="btn btn-sm btn-primary py-1 px-2 fw-bold"
          style={{ fontSize: '0.75rem' }}
          onClick={() => setShowNewModal(true)}
        >
          + New Ticket
        </button>
      </div>

      {requests.length === 0 ? (
        <div className="card shadow-sm border-0 bg-white p-4 text-center text-muted">
          <i className="bi bi-folder-check fs-1 text-secondary mb-2"></i>
          <h6 className="fw-bold">No active service tickets</h6>
          <p className="small mb-3">Add a new ticket for nominee update, address change, or death/maturity claim.</p>
          <button className="btn btn-sm btn-outline-primary mx-auto" onClick={() => setShowNewModal(true)}>
            Create Service Ticket
          </button>
        </div>
      ) : (
        requests.map(req => {
          const currentStageIndex = STAGES.indexOf(req.status);

          return (
            <div key={req.id} className="card shadow-sm border-0 mb-3 bg-white">
              <div className="card-body p-3">
                <div className="d-flex justify-content-between align-items-start mb-2">
                  <div>
                    <h6 className="fw-bold mb-0 text-primary text-capitalize">
                      {req.request_type?.replace(/_/g, ' ')}
                    </h6>
                    <div className="small text-muted" style={{ fontSize: '0.72rem' }}>
                      Created on: {new Date(req.created_at).toLocaleDateString('en-IN')}
                    </div>
                  </div>
                  <span className={`badge ${req.status === 'completed' ? 'bg-success' : 'bg-warning text-dark'}`} style={{ fontSize: '0.7rem' }}>
                    {STAGE_LABELS[req.status] || req.status}
                  </span>
                </div>

                {/* Stepper */}
                <div className="d-flex justify-content-between my-3 px-2">
                  {STAGES.map((stg, i) => {
                    const isDone = i <= currentStageIndex;
                    const isCurrent = i === currentStageIndex;
                    return (
                      <div
                        key={stg}
                        className="text-center flex-fill position-relative cursor-pointer"
                        style={{ cursor: 'pointer' }}
                        onClick={() => handleUpdateStatus(req.id, stg)}
                      >
                        <div
                          className={`rounded-circle mx-auto d-flex align-items-center justify-content-center fw-bold ${
                            isCurrent
                              ? 'bg-primary text-white ring'
                              : isDone
                              ? 'bg-success text-white'
                              : 'bg-light text-muted border'
                          }`}
                          style={{ width: '28px', height: '28px', fontSize: '0.75rem' }}
                        >
                          {i + 1}
                        </div>
                        <div
                          className={`small mt-1 text-capitalize ${isCurrent ? 'fw-bold text-primary' : 'text-muted'}`}
                          style={{ fontSize: '0.62rem' }}
                        >
                          {stg.replace(/_/g, ' ')}
                        </div>
                      </div>
                    );
                  })}
                </div>

                {req.notes && (
                  <div className="bg-light p-2 rounded small text-dark mb-2" style={{ fontSize: '0.78rem' }}>
                    <strong>Notes:</strong> {req.notes}
                  </div>
                )}

                {/* Status Changer Buttons */}
                <div className="d-flex gap-1 pt-2 border-top">
                  <span className="small text-muted me-2 align-self-center" style={{ fontSize: '0.7rem' }}>Move stage:</span>
                  {STAGES.map(s => (
                    <button
                      key={s}
                      type="button"
                      className={`btn btn-sm py-0 px-2 ${req.status === s ? 'btn-primary' : 'btn-outline-secondary'}`}
                      style={{ fontSize: '0.68rem' }}
                      onClick={() => handleUpdateStatus(req.id, s)}
                    >
                      {s.replace(/_/g, ' ')}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          );
        })
      )}

      {/* New Request Modal */}
      {showNewModal && (
        <div
          className="modal show d-block"
          tabIndex="-1"
          style={{ backgroundColor: 'rgba(0,0,0,0.6)', zIndex: 1060 }}
          onClick={(e) => { if (e.target === e.currentTarget) setShowNewModal(false); }}
        >
          <div className="modal-dialog modal-dialog-centered">
            <div className="modal-content border-0 shadow">
              <div className="modal-header bg-primary text-white">
                <h5 className="modal-title fs-6 fw-bold">New Service Request Ticket</h5>
                <button type="button" className="btn-close btn-close-white" onClick={() => setShowNewModal(false)}></button>
              </div>
              <form onSubmit={handleCreateRequest}>
                <div className="modal-body">
                  <div className="mb-3">
                    <label className="form-label small fw-bold">Request Category</label>
                    <select
                      className="form-select form-select-sm"
                      value={newType}
                      onChange={(e) => setNewType(e.target.value)}
                    >
                      <option value="nominee_change">Nominee Change (Form 3750)</option>
                      <option value="address_change">Address / Contact Update</option>
                      <option value="maturity_claim">Maturity Claim Settlement</option>
                      <option value="death_claim">Death Claim Assistance</option>
                      <option value="revival">Policy Revival Endorsement</option>
                      <option value="loan_request">Policy Loan Application</option>
                    </select>
                  </div>
                  <div className="mb-3">
                    <label className="form-label small fw-bold">Notes & Documents Received</label>
                    <textarea
                      className="form-control form-control-sm"
                      rows="3"
                      required
                      placeholder="e.g. Received Form 3750 with updated marriage certificate copy."
                      value={newNotes}
                      onChange={(e) => setNewNotes(e.target.value)}
                    ></textarea>
                  </div>
                </div>
                <div className="modal-footer bg-light p-2 d-flex justify-content-between">
                  <button type="button" className="btn btn-sm btn-secondary" onClick={() => setShowNewModal(false)}>
                    Cancel
                  </button>
                  <button type="submit" className="btn btn-sm btn-primary px-4 fw-bold">
                    Create Ticket
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
