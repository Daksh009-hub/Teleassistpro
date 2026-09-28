import React, { useState, useEffect } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { getAllFromStore, putInStore, deleteFromStore } from '../utils/offlineDB';
import { supabase } from '../supabaseClient';
import { TimelineItem } from '../components/TimelineItem';
import { CallWrapUpModal } from '../components/CallWrapUpModal';
import { WhatsAppTemplatePicker } from '../components/WhatsAppTemplatePicker';
import { extractFollowUpIntent } from '../utils/gemini';
import { useGamification } from '../context/GamificationContext';
import { safeSetItem } from '../utils/storage';

export function ClientProfile() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { awardXP } = useGamification();

  const [client, setClient] = useState(null);
  const [policies, setPolicies] = useState([]);
  const [activities, setActivities] = useState([]);
  const [followUps, setFollowUps] = useState([]);
  const [loading, setLoading] = useState(true);

  // Quick note state
  const [quickNote, setQuickNote] = useState('');
  const [isSavingNote, setIsSavingNote] = useState(false);
  const [noteAutoNotice, setNoteAutoNotice] = useState(null);

  // Modals state
  const [showCallModal, setShowCallModal] = useState(false);
  const [callStartTime, setCallStartTime] = useState(null);
  const [showWhatsApp, setShowWhatsApp] = useState(false);
  const [showAddPolicyModal, setShowAddPolicyModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [policyForm, setPolicyForm] = useState({
    policy_name: 'LIC Jeevan Labh (Plan 936)',
    policy_number: '',
    plan_type: 'Endowment',
    sum_assured: 1000000,
    premium_amount: 35000,
    premium_frequency: 'yearly',
    start_date: new Date().toISOString().split('T')[0],
    next_due_date: new Date(Date.now() + 365 * 86400000).toISOString().split('T')[0]
  });

  const handleDeleteClient = async () => {
    if (!client) return;
    setIsDeleting(true);
    try {
      // 1. Delete associated policies
      for (const pol of policies) {
        await deleteFromStore('policies', pol.id);
      }
      // 2. Delete associated follow-ups
      for (const fu of followUps) {
        await deleteFromStore('follow_ups', fu.id);
      }
      // 3. Delete associated activities
      for (const act of activities) {
        await deleteFromStore('activities', act.id);
      }
      // 4. Delete client record
      await deleteFromStore('clients', client.id);

      // 5. If this client was converted from a digital card lead, revert the lead back to 'contacted'
      try {
        const allLeads = await getAllFromStore('leads');
        const cleanClientPhone = String(client?.phone || '').replace(/\D/g, '');
        for (const lead of allLeads) {
          const cleanLeadPhone = String(lead?.phone || '').replace(/\D/g, '');
          if (lead.converted_client_id === client.id || (cleanClientPhone && cleanLeadPhone && cleanClientPhone === cleanLeadPhone)) {
            const revertedLead = {
              ...lead,
              status: 'contacted',
              converted_client_id: null
            };
            await putInStore('leads', revertedLead);
            try {
              await supabase.from('leads').update({ status: 'contacted', converted_client_id: null }).eq('id', lead.id);
            } catch (e) {}
          }
        }
      } catch (leadSyncErr) {
        console.warn('Error syncing leads on client delete:', leadSyncErr);
      }

      setShowDeleteModal(false);
      navigate('/dashboard', { replace: true });
    } catch (err) {
      console.error('Failed to delete client:', err);
      alert('Failed to delete client. Please try again.');
    } finally {
      setIsDeleting(false);
    }
  };

  const loadClientData = async () => {
    setLoading(true);
    try {
      const allClients = await getAllFromStore('clients');
      const foundClient = allClients.find(c => c.id === id);
      setClient(foundClient || null);

      const allPolicies = await getAllFromStore('policies');
      setPolicies(allPolicies.filter(p => p.client_id === id));

      const allActivities = await getAllFromStore('activities');
      setActivities(
        allActivities
          .filter(a => a.client_id === id)
          .sort((a, b) => new Date(b.created_at || b.completed_at) - new Date(a.created_at || a.completed_at))
      );

      const allFollowUps = await getAllFromStore('follow_ups');
      setFollowUps(allFollowUps.filter(f => f.client_id === id));
    } catch (e) {
      console.error('Failed to load client details:', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadClientData();
  }, [id]);

  // Initiate call flow
  const handleCall = () => {
    safeSetItem('pending_call_client', client.id);
    safeSetItem('pending_call_start_time', Date.now().toString());
    if (typeof window !== 'undefined') {
      window.location.href = `tel:${client.phone || ''}`;
    }
    
    // Fallback trigger modal
    setTimeout(() => {
      setCallStartTime(Date.now() - 45000);
      setShowCallModal(true);
    }, 1500);
  };

  // Quick note with NLP auto-followup detection (PRD Screen 3D & Feature B)
  const handleSaveQuickNote = async (e) => {
    e.preventDefault();
    if (!quickNote.trim()) return;

    setIsSavingNote(true);
    try {
      const actId = `act-${Date.now()}`;
      const newAct = {
        id: actId,
        agent_id: client.agent_id || '00000000-0000-0000-0000-000000000001',
        client_id: client.id,
        activity_type: 'note',
        title: 'Quick Field Note',
        description: quickNote,
        ai_summary: null,
        status: 'done',
        created_at: new Date().toISOString()
      };
      await putInStore('activities', newAct);

      // Extract follow-up intent with NLP (Feature B)
      const intent = await extractFollowUpIntent(quickNote);
      if (intent.needs_followup && intent.date) {
        const newFu = {
          id: `fu-${Date.now()}`,
          agent_id: client.agent_id || '00000000-0000-0000-0000-000000000001',
          client_id: client.id,
          activity_id: actId,
          due_date: intent.date,
          action_type: 'callback',
          notes: `${intent.action || 'Follow-up'}: ${quickNote.slice(0, 60)}`,
          status: 'pending',
          auto_created: true
        };
        await putInStore('follow_ups', newFu);
        setNoteAutoNotice(`📅 Follow-up auto-scheduled for ${intent.date} by AI!`);
        setTimeout(() => setNoteAutoNotice(null), 5000);
      }

      setQuickNote('');
      await awardXP('call_logged', `Added client note for ${client.full_name}`);
      await loadClientData();
    } catch (err) {
      console.warn('Failed to save quick note:', err);
    } finally {
      setIsSavingNote(false);
    }
  };

  const handleAddPolicy = async (e) => {
    e.preventDefault();
    const newPolicy = {
      id: `pol-${Date.now()}`,
      client_id: client.id,
      agent_id: client.agent_id || '00000000-0000-0000-0000-000000000001',
      policy_number: policyForm.policy_number || `LIC${Math.floor(100000000 + Math.random() * 900000000)}`,
      policy_name: policyForm.policy_name,
      plan_type: policyForm.plan_type,
      sum_assured: parseFloat(policyForm.sum_assured) || 1000000,
      premium_amount: parseFloat(policyForm.premium_amount) || 35000,
      premium_frequency: policyForm.premium_frequency,
      start_date: policyForm.start_date,
      next_due_date: policyForm.next_due_date,
      status: 'active',
      trackable_link: `quote-${client.full_name.toLowerCase().replace(/[^a-z0-9]/g, '-')}-${Date.now().toString().slice(-4)}`,
      link_views: 0
    };

    await putInStore('policies', newPolicy);
    setShowAddPolicyModal(false);
    await loadClientData();
  };

  if (loading) {
    return (
      <div className="container py-4 text-center">
        <div className="spinner-border text-primary" role="status"></div>
        <div className="small text-muted mt-2">Loading client profile...</div>
      </div>
    );
  }

  if (!client) {
    return (
      <div className="container py-4 text-center">
        <h5>Client not found</h5>
        <Link to="/dashboard" className="btn btn-sm btn-primary mt-2">Back to Dashboard</Link>
      </div>
    );
  }

  return (
    <div className="container py-3 px-3">
      {/* Top Breadcrumb Header */}
      <div className="d-flex justify-content-between align-items-center mb-3">
        <Link to="/dashboard" className="btn btn-sm btn-light border py-1 px-2 d-flex align-items-center">
          <i className="bi bi-arrow-left me-1"></i> Dashboard
        </Link>
        <div className="d-flex align-items-center gap-2">
          <span className="badge bg-light text-dark border">Client 360° Profile</span>
          <button
            type="button"
            className="btn btn-sm btn-outline-danger py-1 px-2 d-flex align-items-center"
            title="Delete Client"
            onClick={() => setShowDeleteModal(true)}
          >
            <i className="bi bi-trash3-fill me-1"></i> Delete
          </button>
        </div>
      </div>

      {/* 3A. Client Header Card */}
      <div className="card shadow-sm border-0 mb-3 bg-white">
        <div className="card-body p-3">
          <div className="d-flex justify-content-between align-items-start">
            <div className="d-flex align-items-center">
              <div
                className="bg-primary text-white rounded-circle d-flex align-items-center justify-content-center fw-bold fs-5 me-3"
                style={{ width: '52px', height: '52px' }}
              >
                {client.full_name?.charAt(0)}
              </div>
              <div>
                <h5 className="fw-bold mb-0 text-dark">{client.full_name}</h5>
                <div className="small text-muted d-flex align-items-center mt-1">
                  <i className="bi bi-telephone me-1"></i> {client.phone}
                </div>
                {client.email && (
                  <div className="small text-muted" style={{ fontSize: '0.75rem' }}>
                    <i className="bi bi-envelope me-1"></i> {client.email}
                  </div>
                )}
              </div>
            </div>

            <div>
              {client.kyc_status === 'verified' && (
                <span className="badge bg-success-subtle text-success border border-success">✓ KYC Verified</span>
              )}
              {client.kyc_status === 'flagged' && (
                <span className="badge bg-danger-subtle text-danger border border-danger">⚠️ KYC Mismatch</span>
              )}
              {client.kyc_status === 'pending' && (
                <span className="badge bg-warning-subtle text-warning border border-warning">⌛ KYC Pending</span>
              )}
            </div>
          </div>

          {/* Tags */}
          <div className="d-flex flex-wrap gap-1 mt-3">
            {client.tags?.map((tag, i) => (
              <span key={i} className="badge bg-light text-secondary border">
                {tag}
              </span>
            ))}
          </div>

          {/* Call & WhatsApp Action Buttons */}
          <div className="d-flex gap-2 mt-3 pt-2 border-top">
            <button
              type="button"
              className="btn btn-primary flex-fill d-flex align-items-center justify-content-center py-2"
              onClick={handleCall}
            >
              <i className="bi bi-telephone-outbound-fill me-2"></i>
              Call Client
            </button>

            <button
              type="button"
              className="btn btn-success flex-fill d-flex align-items-center justify-content-center py-2"
              onClick={() => setShowWhatsApp(true)}
            >
              <i className="bi bi-whatsapp me-2"></i>
              WhatsApp
            </button>
          </div>
        </div>
      </div>

      {/* Quick Navigation Action Grid (Tabs) */}
      <div className="row g-2 mb-3">
        <div className="col-4">
          <Link to={`/client/${client.id}/family`} className="btn btn-outline-primary btn-sm w-100 p-2 text-center h-100 d-flex flex-column align-items-center justify-content-center">
            <i className="bi bi-people-fill fs-5 mb-1 text-primary"></i>
            <span style={{ fontSize: '0.72rem' }} className="fw-semibold">Family Passbook</span>
          </Link>
        </div>
        <div className="col-4">
          <Link to={`/kyc/${client.id}`} className="btn btn-outline-info btn-sm w-100 p-2 text-center h-100 d-flex flex-column align-items-center justify-content-center">
            <i className="bi bi-shield-lock-fill fs-5 mb-1 text-info"></i>
            <span style={{ fontSize: '0.72rem' }} className="fw-semibold">KYC Drop-Box</span>
          </Link>
        </div>
        <div className="col-4">
          <Link to={`/client/${client.id}/tax-proof`} className="btn btn-outline-success btn-sm w-100 p-2 text-center h-100 d-flex flex-column align-items-center justify-content-center">
            <i className="bi bi-file-earmark-pdf-fill fs-5 mb-1 text-success"></i>
            <span style={{ fontSize: '0.72rem' }} className="fw-semibold">80C Tax Proof</span>
          </Link>
        </div>
        <div className="col-4">
          <Link to={`/client/${client.id}/service`} className="btn btn-outline-warning btn-sm w-100 p-2 text-center h-100 d-flex flex-column align-items-center justify-content-center">
            <i className="bi bi-headset fs-5 mb-1 text-warning"></i>
            <span style={{ fontSize: '0.72rem' }} className="fw-semibold">Service / Claim</span>
          </Link>
        </div>
        <div className="col-4">
          <Link to={`/client/${client.id}/referrals`} className="btn btn-outline-secondary btn-sm w-100 p-2 text-center h-100 d-flex flex-column align-items-center justify-content-center">
            <i className="bi bi-diagram-3-fill fs-5 mb-1 text-secondary"></i>
            <span style={{ fontSize: '0.72rem' }} className="fw-semibold">Referral Map</span>
          </Link>
        </div>
        <div className="col-4">
          <button
            className="btn btn-outline-dark btn-sm w-100 p-2 text-center h-100 d-flex flex-column align-items-center justify-content-center"
            onClick={() => setShowAddPolicyModal(true)}
          >
            <i className="bi bi-plus-circle-fill fs-5 mb-1 text-dark"></i>
            <span style={{ fontSize: '0.72rem' }} className="fw-semibold">Add Policy</span>
          </button>
        </div>
      </div>

      {/* Policies Section & Quote Tracker links */}
      <div className="card shadow-sm border-0 mb-3 bg-white">
        <div className="card-header bg-white border-0 d-flex justify-content-between align-items-center pt-3 pb-0 px-3">
          <h6 className="fw-bold mb-0 text-dark d-flex align-items-center">
            <i className="bi bi-shield-check text-primary me-2"></i>
            Active Policies ({policies.length})
          </h6>
          <button
            className="btn btn-sm btn-link p-0 text-primary"
            onClick={() => setShowAddPolicyModal(true)}
          >
            + New
          </button>
        </div>
        <div className="card-body p-3">
          {policies.length === 0 ? (
            <div className="small text-muted text-center py-2">No policies linked yet.</div>
          ) : (
            policies.map(p => (
              <div key={p.id} className="border rounded p-2 mb-2 bg-light">
                <div className="d-flex justify-content-between align-items-start">
                  <div>
                    <div className="fw-bold small text-primary">{p.policy_name}</div>
                    <div className="small text-muted" style={{ fontSize: '0.75rem' }}>
                      No: {p.policy_number} • Premium: ₹{(p.premium_amount || 0).toLocaleString('en-IN')}/{p.premium_frequency || 'yr'}
                    </div>
                  </div>
                  <span className={`badge ${p.status === 'lapsed' ? 'bg-danger' : 'bg-success'}`} style={{ fontSize: '0.65rem' }}>
                    {p.status}
                  </span>
                </div>

                {/* Smart Quote Link & Analytics */}
                <div className="d-flex justify-content-between align-items-center mt-2 pt-2 border-top">
                  <div className="small text-muted" style={{ fontSize: '0.72rem' }}>
                    <i className="bi bi-eye me-1"></i> {p.link_views || 0} Views
                    {p.quote_total_time_sec > 0 && ` • ⏱ ${Math.round(p.quote_total_time_sec / 60)}m ${p.quote_total_time_sec % 60}s`}
                  </div>
                  <Link
                    to={`/quote/${p.id}`}
                    className="btn btn-sm btn-outline-primary py-0 px-2"
                    style={{ fontSize: '0.72rem' }}
                  >
                    Quote Analytics ↗
                  </Link>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* 3D. Quick Note with NLP Auto Follow-Up (Feature B) */}
      <div className="card shadow-sm border-0 mb-3 bg-white">
        <div className="card-body p-3">
          <div className="d-flex justify-content-between align-items-center mb-2">
            <h6 className="fw-bold mb-0 text-dark d-flex align-items-center">
              <i className="bi bi-pencil-square text-primary me-2"></i>
              Quick Note
            </h6>
            <span className="badge bg-info-subtle text-info border border-info" style={{ fontSize: '0.65rem' }}>
              ✨ NLP Auto-Followup
            </span>
          </div>

          <form onSubmit={handleSaveQuickNote}>
            <textarea
              className="form-control form-control-sm mb-2"
              rows="2"
              placeholder='Type note e.g. "Spoke regarding daughter marriage plan. Call next Friday."'
              value={quickNote}
              onChange={(e) => setQuickNote(e.target.value)}
            ></textarea>

            {noteAutoNotice && (
              <div className="alert alert-success py-1 px-2 small mb-2 animate__animated animate__fadeIn">
                {noteAutoNotice}
              </div>
            )}

            <button
              type="submit"
              className="btn btn-sm btn-primary w-100 fw-bold"
              disabled={isSavingNote || !quickNote.trim()}
            >
              {isSavingNote ? 'Saving & Analyzing...' : 'Save Note (+10 XP)'}
            </button>
          </form>
        </div>
      </div>

      {/* 3B. Relationship Timeline */}
      <div className="card shadow-sm border-0 mb-3 bg-white">
        <div className="card-header bg-white border-0 pt-3 pb-1 px-3">
          <h6 className="fw-bold mb-0 text-dark d-flex align-items-center">
            <i className="bi bi-clock-history text-primary me-2"></i>
            Relationship Timeline
          </h6>
        </div>
        <div className="card-body p-3">
          {activities.length === 0 ? (
            <div className="text-center py-3 text-muted small">No activities logged yet.</div>
          ) : (
            <div className="timeline-list">
              {activities.map(act => (
                <TimelineItem key={act.id} activity={act} />
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Danger Zone */}
      <div className="card shadow-sm border border-danger-subtle bg-white mb-4">
        <div className="card-body p-3 d-flex flex-column flex-sm-row justify-content-between align-items-sm-center gap-2">
          <div>
            <h6 className="fw-bold text-danger mb-1 d-flex align-items-center">
              <i className="bi bi-exclamation-triangle-fill me-2"></i>
              Delete Client Profile
            </h6>
            <p className="small text-muted mb-0">
              Permanently remove {client.full_name} along with all linked policies, notes, and activity history.
            </p>
          </div>
          <button
            type="button"
            className="btn btn-outline-danger btn-sm fw-bold text-nowrap px-3 py-2 align-self-start align-self-sm-center"
            onClick={() => setShowDeleteModal(true)}
          >
            <i className="bi bi-trash3-fill me-1"></i> Delete Client
          </button>
        </div>
      </div>

      {/* Call Wrap-Up Modal */}
      {showCallModal && (
        <CallWrapUpModal
          client={client}
          callStartTime={callStartTime}
          onClose={() => setShowCallModal(false)}
          onSaveSuccess={() => loadClientData()}
        />
      )}

      {/* WhatsApp Modal */}
      {showWhatsApp && (
        <div
          className="modal show d-block"
          tabIndex="-1"
          style={{ backgroundColor: 'rgba(0,0,0,0.6)', zIndex: 1060 }}
          onClick={(e) => { if (e.target === e.currentTarget) setShowWhatsApp(false); }}
        >
          <div className="modal-dialog modal-dialog-centered">
            <WhatsAppTemplatePicker
              client={client}
              policy={policies[0] || {}}
              defaultTemplate="renewal_reminder"
              onClose={() => setShowWhatsApp(false)}
            />
          </div>
        </div>
      )}

      {/* Add Policy Modal */}
      {showAddPolicyModal && (
        <div
          className="modal show d-block"
          tabIndex="-1"
          style={{ backgroundColor: 'rgba(0,0,0,0.6)', zIndex: 1060 }}
          onClick={(e) => { if (e.target === e.currentTarget) setShowAddPolicyModal(false); }}
        >
          <div className="modal-dialog modal-dialog-centered">
            <div className="modal-content border-0 shadow">
              <div className="modal-header bg-primary text-white">
                <h5 className="modal-title fs-6 fw-bold">Link New Policy to {client.full_name}</h5>
                <button type="button" className="btn-close btn-close-white" onClick={() => setShowAddPolicyModal(false)}></button>
              </div>
              <form onSubmit={handleAddPolicy}>
                <div className="modal-body">
                  <div className="mb-2">
                    <label className="form-label small fw-bold">Plan Name</label>
                    <select
                      className="form-select form-select-sm"
                      value={policyForm.policy_name}
                      onChange={(e) => setPolicyForm({ ...policyForm, policy_name: e.target.value })}
                    >
                      <option>LIC Jeevan Labh (Plan 936)</option>
                      <option>LIC Jeevan Umang (Plan 945)</option>
                      <option>LIC Jeevan Tarun (Plan 934)</option>
                      <option>LIC Tech Term (Plan 854)</option>
                      <option>LIC SIIP (Plan 852)</option>
                      <option>LIC New Jeevan Anand (Plan 915)</option>
                    </select>
                  </div>
                  <div className="mb-2">
                    <label className="form-label small fw-bold">Policy Number</label>
                    <input
                      type="text"
                      className="form-control form-control-sm"
                      placeholder="e.g. 123456789"
                      value={policyForm.policy_number}
                      onChange={(e) => setPolicyForm({ ...policyForm, policy_number: e.target.value })}
                    />
                  </div>
                  <div className="row g-2 mb-2">
                    <div className="col-6">
                      <label className="form-label small fw-bold">Sum Assured (₹)</label>
                      <input
                        type="number"
                        className="form-control form-control-sm"
                        value={policyForm.sum_assured}
                        onChange={(e) => setPolicyForm({ ...policyForm, sum_assured: e.target.value })}
                      />
                    </div>
                    <div className="col-6">
                      <label className="form-label small fw-bold">Premium Amount (₹)</label>
                      <input
                        type="number"
                        className="form-control form-control-sm"
                        value={policyForm.premium_amount}
                        onChange={(e) => setPolicyForm({ ...policyForm, premium_amount: e.target.value })}
                      />
                    </div>
                  </div>
                  <div className="mb-2">
                    <label className="form-label small fw-bold">Next Due Date</label>
                    <input
                      type="date"
                      className="form-control form-control-sm"
                      value={policyForm.next_due_date}
                      onChange={(e) => setPolicyForm({ ...policyForm, next_due_date: e.target.value })}
                    />
                  </div>
                </div>
                <div className="modal-footer bg-light p-2 d-flex justify-content-between">
                  <button type="button" className="btn btn-sm btn-secondary" onClick={() => setShowAddPolicyModal(false)}>
                    Cancel
                  </button>
                  <button type="submit" className="btn btn-sm btn-primary px-4 fw-bold">
                    Save Policy
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* Delete Client Confirmation Modal */}
      {showDeleteModal && (
        <div
          className="modal show d-block"
          tabIndex="-1"
          style={{ backgroundColor: 'rgba(0,0,0,0.65)', zIndex: 1070 }}
          onClick={(e) => { if (e.target === e.currentTarget && !isDeleting) setShowDeleteModal(false); }}
        >
          <div className="modal-dialog modal-dialog-centered">
            <div className="modal-content border-0 shadow-lg" style={{ borderRadius: '16px' }}>
              <div className="modal-header bg-danger text-white">
                <h5 className="modal-title fs-6 fw-bold d-flex align-items-center">
                  <i className="bi bi-exclamation-triangle-fill me-2"></i>
                  Delete Client Confirmation
                </h5>
                <button
                  type="button"
                  className="btn-close btn-close-white"
                  disabled={isDeleting}
                  onClick={() => setShowDeleteModal(false)}
                ></button>
              </div>
              <div className="modal-body p-4">
                <p className="mb-2 fs-6">
                  Are you sure you want to permanently delete <strong>{client.full_name}</strong>?
                </p>
                <div className="alert alert-warning py-2 small mb-3">
                  <div className="fw-bold mb-1">
                    <i className="bi bi-info-circle-fill me-1"></i>
                    This action will permanently delete:
                  </div>
                  <ul className="mb-0 ps-3">
                    <li>Client profile ({client.phone})</li>
                    <li>{policies.length} linked policy record{policies.length === 1 ? '' : 's'}</li>
                    <li>{activities.length} timeline notes & interactions</li>
                    <li>{followUps.length} pending follow-up task{followUps.length === 1 ? '' : 's'}</li>
                  </ul>
                </div>
                <p className="small text-muted mb-0">
                  ⚠️ This action cannot be undone. All data will be removed from your offline database and cloud sync.
                </p>
              </div>
              <div className="modal-footer bg-light p-3 d-flex justify-content-between">
                <button
                  type="button"
                  className="btn btn-sm btn-secondary px-3"
                  disabled={isDeleting}
                  onClick={() => setShowDeleteModal(false)}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  className="btn btn-sm btn-danger px-4 fw-bold d-flex align-items-center"
                  disabled={isDeleting}
                  onClick={handleDeleteClient}
                >
                  {isDeleting ? (
                    <>
                      <span className="spinner-border spinner-border-sm me-2" role="status"></span>
                      Deleting...
                    </>
                  ) : (
                    <>
                      <i className="bi bi-trash3-fill me-1"></i> Yes, Delete Permanently
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
