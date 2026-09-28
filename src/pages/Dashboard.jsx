import React, { useState, useEffect } from 'react';
import { useClients } from '../hooks/useClients';
import { useFollowUps } from '../hooks/useFollowUps';
import { ActionEngineCard } from '../components/ActionEngineCard';
import { ClientCard } from '../components/ClientCard';
import { FollowUpBanner } from '../components/FollowUpBanner';
import { CallWrapUpModal } from '../components/CallWrapUpModal';
import { WhatsAppTemplatePicker } from '../components/WhatsAppTemplatePicker';
import { ExcelImportModal } from '../components/ExcelImportModal';
import { LoadingSkeleton } from '../components/LoadingSkeleton';
import { parseNaturalLanguageSearch } from '../utils/gemini';
import { getAllFromStore, putInStore } from '../utils/offlineDB';
import { safeGetItem, safeSetItem, safeRemoveItem } from '../utils/storage';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export function Dashboard() {
  const { agent } = useAuth();
  const { clients, loading: clientsLoading, addClient, refreshClients } = useClients();
  const { followUps, todayPending, overduePending, loading: fuLoading, markDone, reschedule, refreshFollowUps } = useFollowUps();

  const [activeFilter, setActiveFilter] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [isAiSearching, setIsAiSearching] = useState(false);
  const [aiFilterNotice, setAiFilterNotice] = useState(null);
  const [dismissedNudge, setDismissedNudge] = useState(false);

  const [policies, setPolicies] = useState([]);
  const [showAddClientModal, setShowAddClientModal] = useState(false);
  const [showExcelModal, setShowExcelModal] = useState(false);
  const [activeCallClient, setActiveCallClient] = useState(null);
  const [callStartTime, setCallStartTime] = useState(null);
  const [whatsAppTarget, setWhatsAppTarget] = useState(null);
  const [newClientForm, setNewClientForm] = useState({
    full_name: '',
    phone: '',
    email: '',
    dob: '1990-01-01',
    tags: 'Term Plan',
    policy_name: 'LIC Jeevan Labh (Plan 936)',
    policy_number: '',
    plan_type: 'Endowment',
    sum_assured: 1000000,
    premium_amount: 35000,
    premium_frequency: 'yearly',
    start_date: new Date().toISOString().split('T')[0],
    next_due_date: new Date(Date.now() + 365 * 86400000).toISOString().split('T')[0]
  });

  // Load policies for quote tracker nudges & policy counters
  useEffect(() => {
    getAllFromStore('policies').then(res => setPolicies(res || []));
  }, []);

  // In-app dialer visibility change listener (PRD Screen 3C)
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (typeof document !== 'undefined' && document.visibilityState === 'visible') {
        const pendingCallClientId = safeGetItem('pending_call_client');
        const recordedStartTime = safeGetItem('pending_call_start_time');
        if (pendingCallClientId) {
          const clientObj = clients.find(c => c.id === pendingCallClientId);
          if (clientObj) {
            setActiveCallClient(clientObj);
            setCallStartTime(recordedStartTime ? parseInt(recordedStartTime, 10) : Date.now() - 45000);
          }
          safeRemoveItem('pending_call_client');
          safeRemoveItem('pending_call_start_time');
        }
      }
    };

    if (typeof document !== 'undefined') {
      document.addEventListener('visibilitychange', handleVisibilityChange);
      return () => {
        document.removeEventListener('visibilitychange', handleVisibilityChange);
      };
    }
  }, [clients]);

  // Initiate call flow
  const handleInitiateCall = (client) => {
    safeSetItem('pending_call_client', client.id);
    safeSetItem('pending_call_start_time', Date.now().toString());
    if (typeof window !== 'undefined') {
      window.location.href = `tel:${client.phone || ''}`;
    }
    
    // Also trigger wrap-up directly for desktop testing convenience
    setTimeout(() => {
      if (!activeCallClient) {
        setActiveCallClient(client);
        setCallStartTime(Date.now() - 40000);
      }
    }, 1500);
  };

  // Natural Language AI Search Handler (Feature D)
  const handleNaturalLanguageSearch = async (e) => {
    e.preventDefault();
    if (!searchQuery.trim()) {
      setAiFilterNotice(null);
      return;
    }

    setIsAiSearching(true);
    try {
      const parsedFilters = await parseNaturalLanguageSearch(searchQuery);
      if (parsedFilters) {
        if (parsedFilters.kyc_status) {
          setActiveFilter('docs');
          setAiFilterNotice(`AI Filter Applied: KYC ${parsedFilters.kyc_status}`);
        } else if (parsedFilters.follow_up_due === 'overdue') {
          setActiveFilter('missed');
          setAiFilterNotice('AI Filter Applied: Overdue follow-ups');
        } else if (parsedFilters.follow_up_due === 'today') {
          setActiveFilter('follow_up');
          setAiFilterNotice('AI Filter Applied: Due today');
        } else if (parsedFilters.policy_status === 'lapsed') {
          setActiveFilter('all');
          setAiFilterNotice('AI Filter Applied: Lapsed policies');
        } else {
          setAiFilterNotice(null);
        }
      }
    } catch (err) {
      console.warn('AI search error:', err);
    } finally {
      setIsAiSearching(false);
    }
  };

  // Check 3-day unopened quote nudges (Screen 6 Nudge logic)
  const threeDaysAgo = new Date(Date.now() - 3 * 86400000).toISOString();
  const unOpenedQuotes = policies.filter(
    p => p.trackable_link && !p.quote_last_viewed_at && !p.quote_nudge_sent_at && p.created_at < threeDaysAgo
  );

  // Filter clients based on action engine badge and search
  const filteredClients = clients.filter(c => {
    // 1. Text filter
    if (searchQuery && !aiFilterNotice) {
      const q = searchQuery.toLowerCase();
      const matchName = c.full_name?.toLowerCase().includes(q);
      const matchPhone = c.phone?.includes(q);
      const matchTags = c.tags?.some(t => t.toLowerCase().includes(q));
      if (!matchName && !matchPhone && !matchTags) return false;
    }

    // 2. Action engine filter
    if (activeFilter === 'follow_up') {
      return todayPending.some(f => f.client_id === c.id);
    }
    if (activeFilter === 'callback') {
      return todayPending.some(f => f.client_id === c.id && f.action_type === 'callback');
    }
    if (activeFilter === 'docs') {
      return c.kyc_status === 'pending' || c.kyc_status === 'flagged';
    }
    if (activeFilter === 'missed') {
      return overduePending.some(f => f.client_id === c.id);
    }

    return true;
  });

  const handleOpenAddClientModal = () => {
    setNewClientForm(prev => ({
      ...prev,
      policy_number: prev.policy_number || `LIC${Math.floor(100000000 + Math.random() * 900000000)}`
    }));
    setShowAddClientModal(true);
  };

  const handleClientPlanChange = (planName) => {
    let pType = 'Endowment';
    let sa = 1000000;
    let prem = 35000;

    if (planName.includes('Tech Term')) {
      pType = 'Term Insurance';
      sa = 5000000;
      prem = 28000;
    } else if (planName.includes('Tarun')) {
      pType = 'Child Education';
      sa = 1000000;
      prem = 32000;
    } else if (planName.includes('Umang')) {
      pType = 'Whole Life / Pension';
      sa = 1500000;
      prem = 48000;
    } else if (planName.includes('SIIP')) {
      pType = 'ULIP';
      sa = 1000000;
      prem = 50000;
    } else if (planName.includes('Cancer')) {
      pType = 'Health Insurance';
      sa = 2000000;
      prem = 18000;
    } else if (planName.includes('Anand')) {
      pType = 'Endowment & Whole Life';
      sa = 1000000;
      prem = 38000;
    }

    setNewClientForm(prev => ({
      ...prev,
      policy_name: planName,
      plan_type: pType,
      sum_assured: sa,
      premium_amount: prem
    }));
  };

  const handleClientFrequencyChange = (freq) => {
    let monthsToAdd = 12;
    if (freq === 'half-yearly') monthsToAdd = 6;
    else if (freq === 'quarterly') monthsToAdd = 3;
    else if (freq === 'monthly') monthsToAdd = 1;

    const baseDate = newClientForm.start_date ? new Date(newClientForm.start_date) : new Date();
    baseDate.setMonth(baseDate.getMonth() + monthsToAdd);

    setNewClientForm(prev => ({
      ...prev,
      premium_frequency: freq,
      next_due_date: baseDate.toISOString().split('T')[0]
    }));
  };

  const handleCreateClient = async (e) => {
    e.preventDefault();
    if (!newClientForm.full_name || !newClientForm.phone) return;

    try {
      // 1. Create client
      const newClient = await addClient({
        full_name: newClientForm.full_name.trim(),
        phone: newClientForm.phone.trim(),
        email: newClientForm.email?.trim() || '',
        dob: newClientForm.dob,
        tags: newClientForm.tags ? newClientForm.tags.split(',').map(t => t.trim()).filter(Boolean) : []
      });

      // 2. Create policy
      const polNum = newClientForm.policy_number?.trim() || `LIC${Math.floor(100000000 + Math.random() * 900000000)}`;
      const newPolicy = {
        id: `pol-${Date.now()}`,
        client_id: newClient.id,
        agent_id: agent?.id || '00000000-0000-0000-0000-000000000001',
        policy_number: polNum,
        policy_name: newClientForm.policy_name || 'LIC Jeevan Labh (Plan 936)',
        plan_type: newClientForm.plan_type || 'Endowment',
        sum_assured: parseFloat(newClientForm.sum_assured) || 1000000,
        premium_amount: parseFloat(newClientForm.premium_amount) || 25000,
        premium_frequency: newClientForm.premium_frequency || 'yearly',
        start_date: newClientForm.start_date || new Date().toISOString().split('T')[0],
        maturity_date: new Date(Date.now() + 20 * 365 * 86400000).toISOString().split('T')[0],
        next_due_date: newClientForm.next_due_date || new Date(Date.now() + 365 * 86400000).toISOString().split('T')[0],
        status: 'active',
        pdf_url: null,
        trackable_link: `quote-${(newClient.full_name || 'client').toLowerCase().replace(/[^a-z0-9]/g, '-')}-${Date.now().toString().slice(-4)}`,
        link_views: 0,
        created_at: new Date().toISOString()
      };
      await putInStore('policies', newPolicy);

      // 3. Log activity
      await putInStore('activities', {
        id: `act-${Date.now()}`,
        agent_id: agent?.id || '00000000-0000-0000-0000-000000000001',
        client_id: newClient.id,
        activity_type: 'policy',
        title: 'New Client & Policy Registered',
        description: `Added client ${newClient.full_name} with policy ${newPolicy.policy_name} (#${newPolicy.policy_number}).`,
        status: 'done',
        completed_at: new Date().toISOString()
      });

      // 4. Update local state
      setPolicies(prev => [...prev, newPolicy]);
      setShowAddClientModal(false);

      // 5. Reset form
      setNewClientForm({
        full_name: '',
        phone: '',
        email: '',
        dob: '1990-01-01',
        tags: 'Term Plan',
        policy_name: 'LIC Jeevan Labh (Plan 936)',
        policy_number: `LIC${Math.floor(100000000 + Math.random() * 900000000)}`,
        plan_type: 'Endowment',
        sum_assured: 1000000,
        premium_amount: 35000,
        premium_frequency: 'yearly',
        start_date: new Date().toISOString().split('T')[0],
        next_due_date: new Date(Date.now() + 365 * 86400000).toISOString().split('T')[0]
      });
    } catch (err) {
      console.error('Failed to create client with policy:', err);
    }
  };

  return (
    <div className="container py-3 px-3">
      {/* Missed Follow-up Overdue Alert Banner */}
      <FollowUpBanner
        overdueList={overduePending}
        onMarkDone={markDone}
        onReschedule={reschedule}
      />

      {/* 3-Day Unopened Quote Nudge Alert (PRD Screen 6) */}
      {unOpenedQuotes.length > 0 && !dismissedNudge && (
        <div className="alert alert-warning shadow-sm border-0 d-flex align-items-center justify-content-between p-3 mb-3">
          <div className="d-flex align-items-center me-2">
            <span className="fs-4 me-2">⏰</span>
            <div className="small">
              <strong>{unOpenedQuotes.length} Quote{unOpenedQuotes.length > 1 ? 's' : ''} not opened in 3 days!</strong>
              <div className="text-muted" style={{ fontSize: '0.72rem' }}>
                Send a quick friendly WhatsApp reminder to re-engage.
              </div>
            </div>
          </div>
          <div className="d-flex align-items-center gap-2">
            <button
              className="btn btn-sm btn-warning fw-bold text-nowrap"
              style={{ fontSize: '0.75rem' }}
              onClick={() => {
                const targetPolicy = unOpenedQuotes[0];
                const client = clients.find(c => c.id === targetPolicy.client_id) || {};
                setWhatsAppTarget({ client, policy: targetPolicy, template: 'quote_nudge' });
              }}
            >
              Send Nudge
            </button>
            <button
              type="button"
              className="btn-close"
              style={{ fontSize: '0.65rem' }}
              title="Dismiss"
              onClick={() => setDismissedNudge(true)}
            ></button>
          </div>
        </div>
      )}

      {/* Action Engine Badges */}
      <ActionEngineCard
        followUpsCount={todayPending.length}
        callbacksCount={todayPending.filter(f => f.action_type === 'callback').length}
        docsPendingCount={clients.filter(c => c.kyc_status === 'pending' || c.kyc_status === 'flagged').length}
        missedCount={overduePending.length}
        activeFilter={activeFilter}
        onSelectFilter={(f) => {
          setActiveFilter(f);
          setAiFilterNotice(null);
        }}
      />

      {/* Natural Language AI Search Bar */}
      <form onSubmit={handleNaturalLanguageSearch} className="mb-3">
        <div className="input-group shadow-sm">
          <input
            type="text"
            className="form-control border-0"
            placeholder='Try "KYC pending clients" or "September renewals"...'
            value={searchQuery}
            onChange={(e) => {
              setSearchQuery(e.target.value);
              if (!e.target.value) setAiFilterNotice(null);
            }}
          />
          <button
            type="submit"
            className="btn btn-primary px-3 d-flex align-items-center"
            disabled={isAiSearching}
          >
            {isAiSearching ? (
              <span className="spinner-border spinner-border-sm" role="status"></span>
            ) : (
              <>
                <i className="bi bi-stars me-1"></i>
                <span className="d-none d-sm-inline">AI Search</span>
              </>
            )}
          </button>
        </div>
      </form>

      {aiFilterNotice && (
        <div className="d-flex justify-content-between align-items-center alert alert-info py-1 px-3 small mb-3">
          <span>✨ {aiFilterNotice}</span>
          <button
            className="btn btn-sm btn-link text-info p-0"
            onClick={() => {
              setAiFilterNotice(null);
              setActiveFilter('all');
              setSearchQuery('');
            }}
          >
            Reset
          </button>
        </div>
      )}

      {/* Client List Header + Bulk Excel Import button */}
      <div className="d-flex justify-content-between align-items-center mb-2 px-1">
        <div className="fw-bold small text-muted text-uppercase">
          Client Directory ({filteredClients.length})
        </div>
        <button
          type="button"
          className="btn btn-sm btn-outline-success d-flex align-items-center py-1 px-2"
          style={{ fontSize: '0.75rem' }}
          onClick={() => setShowExcelModal(true)}
        >
          <i className="bi bi-file-earmark-spreadsheet me-1"></i>
          Import Excel / CSV
        </button>
      </div>

      {/* Client Cards List */}
      {clientsLoading || fuLoading ? (
        <LoadingSkeleton rows={4} />
      ) : filteredClients.length === 0 ? (
        <div className="card border-0 p-4 text-center text-muted bg-white my-3">
          <i className="bi bi-inbox fs-1 text-secondary mb-2"></i>
          <h6 className="fw-bold">No clients match this filter</h6>
          <p className="small mb-3">Try clearing search or adding a new client.</p>
          <button
            className="btn btn-sm btn-outline-primary mx-auto"
            onClick={() => {
              setActiveFilter('all');
              setSearchQuery('');
              setAiFilterNotice(null);
            }}
          >
            Clear Filters
          </button>
        </div>
      ) : (
        filteredClients.map(client => {
          const clientPolicies = policies.filter(p => p.client_id === client.id);
          const nextFu = followUps.find(f => f.client_id === client.id && f.status === 'pending');
          return (
            <ClientCard
              key={client.id}
              client={client}
              policiesCount={clientPolicies.length}
              nextFollowUp={nextFu}
              onInitiateCall={handleInitiateCall}
              onOpenWhatsApp={(c) => setWhatsAppTarget({ client: c, policy: clientPolicies[0] || {} })}
            />
          );
        })
      )}

      {/* Floating Action Button (FAB) for Add Client */}
      <button
        type="button"
        className="fab-btn"
        title="Add Client"
        onClick={handleOpenAddClientModal}
      >
        <i className="bi bi-person-plus-fill"></i>
      </button>

      {/* Add Client & Policy Modal */}
      {showAddClientModal && (
        <div
          className="modal show d-block"
          tabIndex="-1"
          style={{ backgroundColor: 'rgba(0,0,0,0.65)', zIndex: 1060, overflowY: 'auto' }}
          onClick={(e) => { if (e.target === e.currentTarget) setShowAddClientModal(false); }}
        >
          <div className="modal-dialog modal-dialog-centered modal-dialog-scrollable my-2" style={{ maxHeight: '94vh' }}>
            <div className="modal-content border-0 shadow" style={{ maxHeight: '92vh', display: 'flex', flexDirection: 'column' }}>
              <div className="modal-header bg-primary text-white flex-shrink-0">
                <div>
                  <h5 className="modal-title fs-6 fw-bold mb-0 d-flex align-items-center">
                    <i className="bi bi-person-plus-fill me-2"></i>
                    Add Client & Policy
                  </h5>
                  <small className="opacity-75" style={{ fontSize: '0.72rem' }}>
                    Register client with their active policy details
                  </small>
                </div>
                <button type="button" className="btn-close btn-close-white" onClick={() => setShowAddClientModal(false)}></button>
              </div>
              <form onSubmit={handleCreateClient} className="d-flex flex-column" style={{ minHeight: 0, flex: '1 1 auto', overflow: 'hidden' }}>
                <div className="modal-body p-3" style={{ overflowY: 'auto', flex: '1 1 auto', WebkitOverflowScrolling: 'touch' }}>
                  {/* Section 1: Client Information */}
                  <div className="d-flex align-items-center mb-2">
                    <span className="badge bg-primary me-2">1</span>
                    <strong className="text-dark small">Client Information</strong>
                  </div>

                  <div className="row g-2 mb-2">
                    <div className="col-6">
                      <label className="form-label small fw-bold mb-1">Full Name *</label>
                      <input
                        type="text"
                        className="form-control form-control-sm"
                        required
                        placeholder="e.g. Sunil Mehta"
                        value={newClientForm.full_name}
                        onChange={(e) => setNewClientForm({ ...newClientForm, full_name: e.target.value })}
                      />
                    </div>
                    <div className="col-6">
                      <label className="form-label small fw-bold mb-1">Phone Number *</label>
                      <input
                        type="tel"
                        className="form-control form-control-sm"
                        required
                        placeholder="98XXXXXXXX"
                        value={newClientForm.phone}
                        onChange={(e) => setNewClientForm({ ...newClientForm, phone: e.target.value })}
                      />
                    </div>
                  </div>

                  <div className="row g-2 mb-2">
                    <div className="col-6">
                      <label className="form-label small fw-bold mb-1">Email Address</label>
                      <input
                        type="email"
                        className="form-control form-control-sm"
                        placeholder="client@example.com"
                        value={newClientForm.email}
                        onChange={(e) => setNewClientForm({ ...newClientForm, email: e.target.value })}
                      />
                    </div>
                    <div className="col-6">
                      <label className="form-label small fw-bold mb-1">Date of Birth</label>
                      <input
                        type="date"
                        className="form-control form-control-sm"
                        value={newClientForm.dob}
                        onChange={(e) => setNewClientForm({ ...newClientForm, dob: e.target.value })}
                      />
                    </div>
                  </div>

                  <div className="mb-3">
                    <label className="form-label small fw-bold mb-1">Tags (Comma separated)</label>
                    <input
                      type="text"
                      className="form-control form-control-sm"
                      placeholder="HNW, Term Plan"
                      value={newClientForm.tags}
                      onChange={(e) => setNewClientForm({ ...newClientForm, tags: e.target.value })}
                    />
                  </div>

                  <hr className="my-3 opacity-25" />

                  {/* Section 2: Policy Details */}
                  <div className="d-flex align-items-center mb-2">
                    <span className="badge bg-success me-2">2</span>
                    <strong className="text-dark small">Policy Details *</strong>
                  </div>

                  <div className="mb-2">
                    <label className="form-label small fw-bold mb-1">Plan Name *</label>
                    <select
                      className="form-select form-select-sm"
                      value={newClientForm.policy_name}
                      onChange={(e) => handleClientPlanChange(e.target.value)}
                      required
                    >
                      <option value="LIC Jeevan Labh (Plan 936)">LIC Jeevan Labh (Plan 936)</option>
                      <option value="LIC Jeevan Umang (Plan 945)">LIC Jeevan Umang (Plan 945)</option>
                      <option value="LIC Jeevan Tarun (Plan 934)">LIC Jeevan Tarun (Plan 934)</option>
                      <option value="LIC Tech Term (Plan 854)">LIC Tech Term (Plan 854)</option>
                      <option value="LIC SIIP (Plan 852)">LIC SIIP (Plan 852)</option>
                      <option value="LIC New Jeevan Anand (Plan 915)">LIC New Jeevan Anand (Plan 915)</option>
                      <option value="LIC Cancer Cover (Plan 905)">LIC Cancer Cover (Plan 905)</option>
                    </select>
                  </div>

                  <div className="row g-2 mb-2">
                    <div className="col-7">
                      <label className="form-label small fw-bold mb-1">Policy Number *</label>
                      <input
                        type="text"
                        className="form-control form-control-sm"
                        placeholder="e.g. 123456789"
                        required
                        value={newClientForm.policy_number}
                        onChange={(e) => setNewClientForm({ ...newClientForm, policy_number: e.target.value })}
                      />
                    </div>
                    <div className="col-5">
                      <label className="form-label small fw-bold mb-1">Plan Category</label>
                      <input
                        type="text"
                        className="form-control form-control-sm"
                        value={newClientForm.plan_type}
                        onChange={(e) => setNewClientForm({ ...newClientForm, plan_type: e.target.value })}
                      />
                    </div>
                  </div>

                  <div className="row g-2 mb-2">
                    <div className="col-6">
                      <label className="form-label small fw-bold mb-1">Sum Assured (₹) *</label>
                      <input
                        type="number"
                        className="form-control form-control-sm"
                        min="10000"
                        step="10000"
                        required
                        value={newClientForm.sum_assured}
                        onChange={(e) => setNewClientForm({ ...newClientForm, sum_assured: e.target.value })}
                      />
                    </div>
                    <div className="col-6">
                      <label className="form-label small fw-bold mb-1">Premium Amount (₹) *</label>
                      <input
                        type="number"
                        className="form-control form-control-sm"
                        min="100"
                        step="100"
                        required
                        value={newClientForm.premium_amount}
                        onChange={(e) => setNewClientForm({ ...newClientForm, premium_amount: e.target.value })}
                      />
                    </div>
                  </div>

                  <div className="row g-2 mb-2">
                    <div className="col-6">
                      <label className="form-label small fw-bold mb-1">Premium Frequency</label>
                      <select
                        className="form-select form-select-sm"
                        value={newClientForm.premium_frequency}
                        onChange={(e) => handleClientFrequencyChange(e.target.value)}
                      >
                        <option value="yearly">Yearly</option>
                        <option value="half-yearly">Half-Yearly</option>
                        <option value="quarterly">Quarterly</option>
                        <option value="monthly">Monthly</option>
                      </select>
                    </div>
                    <div className="col-6">
                      <label className="form-label small fw-bold mb-1">Start Date *</label>
                      <input
                        type="date"
                        className="form-control form-control-sm"
                        required
                        value={newClientForm.start_date}
                        onChange={(e) => setNewClientForm({ ...newClientForm, start_date: e.target.value })}
                      />
                    </div>
                  </div>

                  <div className="mb-1">
                    <label className="form-label small fw-bold mb-1">Next Premium Due Date *</label>
                    <input
                      type="date"
                      className="form-control form-control-sm"
                      required
                      value={newClientForm.next_due_date}
                      onChange={(e) => setNewClientForm({ ...newClientForm, next_due_date: e.target.value })}
                    />
                  </div>
                </div>
                <div className="modal-footer bg-light p-2 d-flex justify-content-between flex-shrink-0">
                  <button type="button" className="btn btn-sm btn-secondary" onClick={() => setShowAddClientModal(false)}>
                    Cancel
                  </button>
                  <button type="submit" className="btn btn-sm btn-primary px-3 fw-bold d-flex align-items-center">
                    <i className="bi bi-check-circle-fill me-1"></i>
                    Save Client & Policy
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* Call Wrap-Up Modal */}
      {activeCallClient && (
        <CallWrapUpModal
          client={activeCallClient}
          callStartTime={callStartTime}
          onClose={() => setActiveCallClient(null)}
          onSaveSuccess={() => {
            refreshClients();
            refreshFollowUps();
          }}
        />
      )}

      {/* WhatsApp Template Picker Modal */}
      {whatsAppTarget && (
        <div
          className="modal show d-block"
          tabIndex="-1"
          style={{ backgroundColor: 'rgba(0,0,0,0.6)', zIndex: 1060 }}
          onClick={(e) => { if (e.target === e.currentTarget) setWhatsAppTarget(null); }}
        >
          <div className="modal-dialog modal-dialog-centered">
            <WhatsAppTemplatePicker
              client={whatsAppTarget.client}
              policy={whatsAppTarget.policy}
              defaultTemplate={whatsAppTarget.template || 'renewal_reminder'}
              onClose={() => setWhatsAppTarget(null)}
            />
          </div>
        </div>
      )}

      {/* Bulk Excel Import Modal */}
      {showExcelModal && (
        <ExcelImportModal
          onClose={() => setShowExcelModal(false)}
          onImportSuccess={() => {
            refreshClients();
            getAllFromStore('policies').then(res => setPolicies(res || []));
          }}
        />
      )}
    </div>
  );
}
