import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useGamification } from '../context/GamificationContext';
import { getAllFromStore, putInStore, deleteFromStore } from '../utils/offlineDB';
import { supabase } from '../supabaseClient';
import { formatIndianPhone, buildDirectWhatsAppURL, buildDirectWhatsAppWebURL } from '../utils/whatsappTemplates';
import { buildPublicUrl } from '../utils/publicUrl';

export function Leads() {
  const { agent } = useAuth();
  const { awardXP } = useGamification();

  const [leads, setLeads] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('new'); // 'new', 'contacted', 'converted'
  const [hasUserSelectedFilter, setHasUserSelectedFilter] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [actionNotice, setActionNotice] = useState(null);
  const [copiedLink, setCopiedLink] = useState(false);
  const [copiedPhoneId, setCopiedPhoneId] = useState(null);

  // Policy Entry Modal State for Lead Conversion
  const [convertingLead, setConvertingLead] = useState(null);
  const [isSubmittingPolicy, setIsSubmittingPolicy] = useState(false);
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

  const cardSlug = agent?.card_slug || 'rajesh-verma';
  const cardUrl = buildPublicUrl(`/card/${cardSlug}`);

  const loadLeads = async (isSilent = false) => {
    if (!isSilent) {
      setLoading(true);
    }
    try {
      // 1. Fetch from Central Web Service API (syncs leads submitted from visiting cards across all devices)
      let apiLeads = [];
      try {
        const res = await fetch('/api/leads');
        if (res.ok) {
          const data = await res.json();
          if (Array.isArray(data)) {
            apiLeads = data;
          }
        }
      } catch (e) {
        // Fallback silently if offline
      }

      // 2. Fetch from Supabase (or mock)
      let remoteLeads = [];
      try {
        const { data } = await supabase.from('leads').select('*').order('created_at', { ascending: false });
        if (data && Array.isArray(data)) {
          remoteLeads = data;
        }
      } catch (e) {
        console.warn('Supabase fetch leads warning:', e);
      }

      // 3. Fetch from local IndexedDB
      const localLeads = await getAllFromStore('leads');
      const allClients = await getAllFromStore('clients');

      // 4. Merge unique leads by ID
      const map = new Map();
      [...localLeads, ...remoteLeads, ...apiLeads].forEach(l => {
        if (l && l.id) {
          map.set(l.id, l);
        }
      });

      // 4. Validate converted leads against active clients in database
      const validatedLeads = [];
      for (const lead of map.values()) {
        if (lead.status === 'converted') {
          const cleanLeadPhone = String(lead?.phone || '').replace(/\D/g, '');
          const clientStillExists = allClients.some(c => {
            const cp = String(c?.phone || '').replace(/\D/g, '');
            return (lead.converted_client_id && c.id === lead.converted_client_id) ||
                   (cleanLeadPhone && cp && cp === cleanLeadPhone);
          });

          if (!clientStillExists) {
            // Client was deleted from the clients book!
            // Automatically revert lead so "Convert to Client" button appears again
            const reverted = { ...lead, status: 'contacted', converted_client_id: null };
            await putInStore('leads', reverted).catch(() => {});
            try {
              await supabase.from('leads').update({ status: 'contacted', converted_client_id: null }).eq('id', lead.id);
            } catch (e) {}
            validatedLeads.push(reverted);
            continue;
          }
        }
        validatedLeads.push(lead);
      }

      const merged = validatedLeads.sort(
        (a, b) => new Date(b.created_at || 0) - new Date(a.created_at || 0)
      );

      // Prevent re-rendering if data is unchanged
      setLeads(prev => {
        if (
          prev.length === merged.length &&
          prev.every((item, idx) => item.id === merged[idx]?.id && item.status === merged[idx]?.status)
        ) {
          return prev;
        }
        return merged;
      });

      // Auto-select initial tab if user hasn't explicitly selected one
      if (!hasUserSelectedFilter) {
        const countNew = merged.filter(l => l.status === 'new').length;
        const countContacted = merged.filter(l => l.status === 'contacted').length;
        if (countNew > 0) {
          setFilter('new');
        } else if (countContacted > 0) {
          setFilter('contacted');
        } else if (merged.length > 0) {
          setFilter('converted');
        }
      }
    } catch (err) {
      console.error('Failed to load leads:', err);
    } finally {
      if (!isSilent) {
        setLoading(false);
      }
    }
  };

  useEffect(() => {
    // Initial fetch shows loading indicator
    loadLeads(false);

    // Silent background refresh on window focus
    const handleWindowFocus = () => {
      loadLeads(true);
    };

    window.addEventListener('focus', handleWindowFocus);
    document.addEventListener('visibilitychange', handleWindowFocus);

    // Silent background polling every 4 seconds to sync leads across devices without flicker
    const pollInterval = setInterval(() => {
      loadLeads(true);
    }, 4000);

    // Subscribe to real-time new leads
    const channel = supabase
      .channel('leads-page-channel')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'leads' },
        () => {
          loadLeads(true);
        }
      )
      .subscribe();

    // Real-time broadcast sync listener
    const handleSync = (e) => {
      if (!e.detail || e.detail.store === 'leads' || e.detail.store === 'clients' || e.type === 'app-sync-full') {
        loadLeads(true);
      }
    };

    window.addEventListener('app-sync-update', handleSync);
    window.addEventListener('app-sync-full', handleSync);

    return () => {
      clearInterval(pollInterval);
      window.removeEventListener('focus', handleWindowFocus);
      document.removeEventListener('visibilitychange', handleWindowFocus);
      window.removeEventListener('app-sync-update', handleSync);
      window.removeEventListener('app-sync-full', handleSync);
      supabase.removeChannel(channel);
    };
  }, [agent?.id]);

  const showNotice = (msg) => {
    setActionNotice(msg);
    setTimeout(() => setActionNotice(null), 4000);
  };

  const handleUpdateStatus = async (lead, newStatus) => {
    try {
      const updated = { ...lead, status: newStatus };
      try {
        await fetch(`/api/leads/${lead.id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ status: newStatus })
        });
      } catch (apiErr) {
        // Fallback silently if offline
      }
      try {
        await supabase.from('leads').update({ status: newStatus }).eq('id', lead.id);
      } catch (e) {
        console.warn('Supabase update warning:', e);
      }
      await putInStore('leads', updated);

      setLeads(prev => prev.map(l => (l.id === lead.id ? updated : l)));

      if (newStatus === 'contacted') {
        if (typeof awardXP === 'function') {
          await awardXP('call_logged', `Contacted lead: ${lead.full_name}`).catch(() => {});
        }
        showNotice(`✓ Marked ${lead.full_name} as Contacted`);
        setFilter('contacted');
      } else if (newStatus === 'new') {
        showNotice(`✓ Marked ${lead.full_name} as New`);
        setFilter('new');
      }
    } catch (err) {
      console.error('Failed to update lead status:', err);
      showNotice(`Failed to update status: ${err.message}`);
    }
  };

  const handleOpenConvertModal = (lead) => {
    const interest = String(lead?.interest_area || '').toLowerCase();
    let defaultPlan = 'LIC Jeevan Labh (Plan 936)';
    let defaultPlanType = 'Endowment';
    let defaultSA = 1000000;
    let defaultPrem = 35000;

    if (interest.includes('term')) {
      defaultPlan = 'LIC Tech Term (Plan 854)';
      defaultPlanType = 'Term Insurance';
      defaultSA = 5000000;
      defaultPrem = 28000;
    } else if (interest.includes('child') || interest.includes('education')) {
      defaultPlan = 'LIC Jeevan Tarun (Plan 934)';
      defaultPlanType = 'Child Education';
      defaultSA = 1000000;
      defaultPrem = 32000;
    } else if (interest.includes('retire') || interest.includes('pension') || interest.includes('umang')) {
      defaultPlan = 'LIC Jeevan Umang (Plan 945)';
      defaultPlanType = 'Whole Life / Pension';
      defaultSA = 1500000;
      defaultPrem = 48000;
    } else if (interest.includes('health') || interest.includes('cancer')) {
      defaultPlan = 'LIC Cancer Cover (Plan 905)';
      defaultPlanType = 'Health Insurance';
      defaultSA = 2000000;
      defaultPrem = 18000;
    } else if (interest.includes('siip') || interest.includes('ulip')) {
      defaultPlan = 'LIC SIIP (Plan 852)';
      defaultPlanType = 'ULIP';
      defaultSA = 1000000;
      defaultPrem = 50000;
    } else if (interest.includes('anand')) {
      defaultPlan = 'LIC New Jeevan Anand (Plan 915)';
      defaultPlanType = 'Endowment & Whole Life';
      defaultSA = 1000000;
      defaultPrem = 38000;
    }

    const randomPolNum = `LIC${Math.floor(100000000 + Math.random() * 900000000)}`;

    setPolicyForm({
      policy_name: defaultPlan,
      policy_number: randomPolNum,
      plan_type: defaultPlanType,
      sum_assured: defaultSA,
      premium_amount: defaultPrem,
      premium_frequency: 'yearly',
      start_date: new Date().toISOString().split('T')[0],
      next_due_date: new Date(Date.now() + 365 * 86400000).toISOString().split('T')[0]
    });

    setConvertingLead(lead);
  };

  const handlePlanChange = (planName) => {
    let pType = 'Endowment';
    let defaultSA = policyForm.sum_assured;
    let defaultPrem = policyForm.premium_amount;

    if (planName.includes('Tech Term')) {
      pType = 'Term Insurance';
      defaultSA = 5000000;
      defaultPrem = 28000;
    } else if (planName.includes('Tarun')) {
      pType = 'Child Education';
      defaultSA = 1000000;
      defaultPrem = 32000;
    } else if (planName.includes('Umang')) {
      pType = 'Whole Life / Pension';
      defaultSA = 1500000;
      defaultPrem = 48000;
    } else if (planName.includes('SIIP')) {
      pType = 'ULIP';
      defaultSA = 1000000;
      defaultPrem = 50000;
    } else if (planName.includes('Cancer')) {
      pType = 'Health Insurance';
      defaultSA = 2000000;
      defaultPrem = 18000;
    } else if (planName.includes('Anand')) {
      pType = 'Endowment & Whole Life';
      defaultSA = 1000000;
      defaultPrem = 38000;
    }

    setPolicyForm(prev => ({
      ...prev,
      policy_name: planName,
      plan_type: pType,
      sum_assured: defaultSA,
      premium_amount: defaultPrem
    }));
  };

  const handleFrequencyChange = (freq) => {
    let monthsToAdd = 12;
    if (freq === 'half-yearly') monthsToAdd = 6;
    else if (freq === 'quarterly') monthsToAdd = 3;
    else if (freq === 'monthly') monthsToAdd = 1;

    const baseDate = policyForm.start_date ? new Date(policyForm.start_date) : new Date();
    baseDate.setMonth(baseDate.getMonth() + monthsToAdd);

    setPolicyForm(prev => ({
      ...prev,
      premium_frequency: freq,
      next_due_date: baseDate.toISOString().split('T')[0]
    }));
  };

  const handleConfirmConvert = async (e) => {
    if (e) e.preventDefault();
    if (!convertingLead) return;

    setIsSubmittingPolicy(true);
    try {
      const allClients = await getAllFromStore('clients');
      const cleanLeadPhone = String(convertingLead?.phone || '').replace(/\D/g, '');
      const matchedClient = allClients.find(c => {
        const cp = String(c?.phone || '').replace(/\D/g, '');
        return cp && cleanLeadPhone && cp === cleanLeadPhone;
      });

      let clientId = matchedClient?.id;
      if (!matchedClient) {
        clientId = `client-${Date.now()}`;
        const newClient = {
          id: clientId,
          agent_id: agent?.id || '00000000-0000-0000-0000-000000000001',
          full_name: convertingLead.full_name || 'Card Lead',
          phone: convertingLead.phone || '',
          email: convertingLead.email || '',
          dob: '',
          address: '',
          aadhaar_last4: '',
          pan_number: '',
          kyc_status: 'pending',
          lead_source: 'visiting_card',
          status: 'active',
          tags: [convertingLead.interest_area || 'Term Plan', 'Digital Card Lead'],
          created_at: new Date().toISOString()
        };
        await putInStore('clients', newClient);
      }

      // Create policy in 'policies' store
      const policyNum = policyForm.policy_number?.trim() || `LIC${Math.floor(100000000 + Math.random() * 900000000)}`;
      const newPolicy = {
        id: `pol-${Date.now()}`,
        client_id: clientId,
        agent_id: agent?.id || '00000000-0000-0000-0000-000000000001',
        policy_number: policyNum,
        policy_name: policyForm.policy_name,
        plan_type: policyForm.plan_type || 'Endowment',
        sum_assured: parseFloat(policyForm.sum_assured) || 1000000,
        premium_amount: parseFloat(policyForm.premium_amount) || 25000,
        premium_frequency: policyForm.premium_frequency || 'yearly',
        start_date: policyForm.start_date || new Date().toISOString().split('T')[0],
        maturity_date: new Date(Date.now() + 20 * 365 * 86400000).toISOString().split('T')[0],
        next_due_date: policyForm.next_due_date || new Date(Date.now() + 365 * 86400000).toISOString().split('T')[0],
        status: 'active',
        pdf_url: null,
        trackable_link: `quote-${(convertingLead.full_name || 'client').toLowerCase().replace(/[^a-z0-9]/g, '-')}-${Date.now().toString().slice(-4)}`,
        link_views: 0,
        created_at: new Date().toISOString()
      };
      await putInStore('policies', newPolicy);

      // Add activity
      await putInStore('activities', {
        id: `act-${Date.now()}`,
        agent_id: agent?.id || '00000000-0000-0000-0000-000000000001',
        client_id: clientId,
        activity_type: 'lead',
        title: 'Visiting Card Lead Converted & Policy Issued',
        description: `Policy ${newPolicy.policy_name} (#${newPolicy.policy_number}) registered with Sum Assured ₹${Number(newPolicy.sum_assured).toLocaleString('en-IN')}. Note: "${convertingLead.message || 'None'}"`,
        status: 'done',
        completed_at: new Date().toISOString()
      });

      // Mark lead as converted
      const updatedLead = { ...convertingLead, status: 'converted', converted_client_id: clientId };
      try {
        await fetch(`/api/leads/${convertingLead.id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ status: 'converted', converted_client_id: clientId })
        });
      } catch (apiErr) {
        // Fallback silently if offline
      }
      try {
        await supabase.from('leads').update({ status: 'converted', converted_client_id: clientId }).eq('id', convertingLead.id);
      } catch (e) {
        console.warn('Supabase update warning:', e);
      }
      await putInStore('leads', updatedLead);

      setLeads(prev => prev.map(l => (l.id === convertingLead.id ? updatedLead : l)));

      if (typeof awardXP === 'function') {
        await awardXP('lead_captured', `Converted ${convertingLead.full_name} to Client! (+20 XP)`).catch(() => {});
      }

      showNotice(`🎉 Converted ${convertingLead.full_name} to Client! Added to your client list.`);
      setFilter('converted');
      setConvertingLead(null);
    } catch (err) {
      console.error('Failed to convert lead:', err);
      showNotice(`Error converting lead: ${err.message}`);
    } finally {
      setIsSubmittingPolicy(false);
    }
  };

  const handleCall = async (lead) => {
    const rawPhone = String(lead?.phone || '');
    const cleanDigits = rawPhone.replace(/\D/g, '');
    if (!cleanDigits) {
      showNotice('No phone number available.');
      return;
    }

    // 1. Copy phone to clipboard
    if (typeof navigator !== 'undefined' && navigator.clipboard) {
      navigator.clipboard.writeText(cleanDigits).catch(() => {});
    }

    // 2. Mark as contacted if new
    if (lead.status === 'new') {
      await handleUpdateStatus(lead, 'contacted');
    }

    // 3. Trigger phone call
    window.location.href = `tel:${cleanDigits}`;
    showNotice(`📞 Calling ${lead.full_name} (${cleanDigits}). Copied to clipboard!`);
  };

  const handleWhatsApp = async (lead) => {
    const rawPhone = String(lead?.phone || '');
    const cleanPhone = formatIndianPhone(rawPhone);
    const greeting = `Hello ${lead.full_name || 'Friend'}, thank you for visiting my LIC digital card regarding ${lead.interest_area || 'an insurance policy'}! I would be glad to share complete details and plan quotations.`;

    const waUrl = buildDirectWhatsAppURL(cleanPhone, greeting);
    window.open(waUrl, '_blank', 'noopener,noreferrer');

    // Mark as contacted if new
    if (lead.status === 'new') {
      await handleUpdateStatus(lead, 'contacted');
    } else {
      showNotice(`💬 Opened WhatsApp for ${lead.full_name}`);
    }
  };

  const handleCopyPhone = (lead) => {
    const cleanDigits = String(lead?.phone || '').replace(/\D/g, '');
    if (typeof navigator !== 'undefined' && navigator.clipboard) {
      navigator.clipboard.writeText(cleanDigits).then(() => {
        setCopiedPhoneId(lead.id);
        setTimeout(() => setCopiedPhoneId(null), 2500);
        showNotice(`📋 Copied ${cleanDigits} to clipboard`);
      });
    }
  };

  const handleDeleteLead = async (leadId, leadName) => {
    if (window.confirm(`Delete lead "${leadName}"?`)) {
      try {
        try {
          await fetch(`/api/leads/${leadId}`, { method: 'DELETE' });
        } catch (apiErr) {
          // Fallback silently if offline
        }
        try {
          await supabase.from('leads').delete().eq('id', leadId);
        } catch (e) {
          console.warn('Supabase delete warning:', e);
        }
        await deleteFromStore('leads', leadId);
        setLeads(prev => prev.filter(l => l.id !== leadId));
        showNotice(`Deleted lead for ${leadName}.`);
      } catch (err) {
        console.error('Failed to delete lead:', err);
      }
    }
  };

  const handleCopyCardLink = () => {
    if (typeof navigator !== 'undefined' && navigator.clipboard) {
      navigator.clipboard.writeText(cardUrl).then(() => {
        setCopiedLink(true);
        setTimeout(() => setCopiedLink(false), 3000);
        showNotice('📋 Copied visiting card URL to clipboard!');
      });
    }
  };

  // Filtered leads
  const filteredLeads = leads.filter(l => {
    const matchesFilter = l.status === filter;
    const matchesSearch = !searchQuery ||
      l.full_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      l.phone?.includes(searchQuery) ||
      l.interest_area?.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesFilter && matchesSearch;
  });

  const countNew = leads.filter(l => l.status === 'new').length;
  const countContacted = leads.filter(l => l.status === 'contacted').length;
  const countConverted = leads.filter(l => l.status === 'converted').length;

  return (
    <div className="container py-3 px-3">
      {/* Header */}
      <div className="d-flex justify-content-between align-items-center mb-3">
        <div>
          <h5 className="fw-bold text-dark mb-0 d-flex align-items-center">
            <i className="bi bi-people-fill text-primary me-2"></i>
            Digital Card Leads
          </h5>
          <small className="text-muted">Inquiries captured via your Digital Visiting Card</small>
        </div>

        <Link
          to={`/card/${cardSlug}`}
          target="_blank"
          className="btn btn-sm btn-outline-primary d-flex align-items-center"
          title="View Digital Visiting Card"
        >
          <i className="bi bi-card-heading me-1"></i>
          My Card
        </Link>
      </div>

      {/* Visiting Card Share Banner */}
      <div className="card shadow-sm border-0 mb-3 bg-primary bg-gradient text-white" style={{ borderRadius: '12px' }}>
        <div className="card-body p-3 d-flex justify-content-between align-items-center flex-wrap gap-2">
          <div>
            <div className="fw-bold small mb-1">
              <i className="bi bi-qr-code me-1"></i> Share Your Card to Get Leads
            </div>
            <div className="small opacity-75 font-monospace" style={{ fontSize: '0.72rem' }}>
              /card/{cardSlug}
            </div>
          </div>
          <div className="d-flex gap-2">
            <button
              type="button"
              className="btn btn-light btn-sm text-primary fw-bold px-2 py-1"
              style={{ fontSize: '0.75rem' }}
              onClick={handleCopyCardLink}
            >
              <i className={`bi ${copiedLink ? 'bi-check-lg text-success' : 'bi-clipboard'} me-1`}></i>
              {copiedLink ? 'Copied!' : 'Copy Link'}
            </button>
            <a
              href={`https://wa.me/?text=Hello!%20Here%20is%20my%20digital%20visiting%20card.%20You%20can%20save%20my%20contact%20or%20request%20an%20insurance%20policy%20consultation:%20${encodeURIComponent(cardUrl)}`}
              target="_blank"
              rel="noreferrer"
              className="btn btn-success btn-sm fw-bold px-2 py-1 d-flex align-items-center"
              style={{ fontSize: '0.75rem' }}
            >
              <i className="bi bi-whatsapp me-1"></i> Share
            </a>
          </div>
        </div>
      </div>

      {actionNotice && (
        <div className="alert alert-success py-2 px-3 small mb-3 animate__animated animate__fadeIn">
          {actionNotice}
        </div>
      )}

      {/* Filter Tabs & Search */}
      <div className="card shadow-sm border-0 mb-3 bg-white">
        <div className="card-body p-2">
          {/* Status Filters */}
          <div className="btn-group w-100 mb-2" role="group">
            <button
              type="button"
              className={`btn btn-sm ${filter === 'new' ? 'btn-danger' : 'btn-outline-danger'}`}
              onClick={() => {
                setFilter('new');
                setHasUserSelectedFilter(true);
              }}
              style={{ fontSize: '0.75rem' }}
            >
              New ({countNew})
            </button>
            <button
              type="button"
              className={`btn btn-sm ${filter === 'contacted' ? 'btn-info text-white' : 'btn-outline-info'}`}
              onClick={() => {
                setFilter('contacted');
                setHasUserSelectedFilter(true);
              }}
              style={{ fontSize: '0.75rem' }}
            >
              Contacted ({countContacted})
            </button>
            <button
              type="button"
              className={`btn btn-sm ${filter === 'converted' ? 'btn-success' : 'btn-outline-success'}`}
              onClick={() => {
                setFilter('converted');
                setHasUserSelectedFilter(true);
              }}
              style={{ fontSize: '0.75rem' }}
            >
              Converted ({countConverted})
            </button>
          </div>

          {/* Search Input */}
          <div className="input-group input-group-sm">
            <span className="input-group-text bg-light border-end-0">
              <i className="bi bi-search text-muted"></i>
            </span>
            <input
              type="text"
              className="form-control border-start-0"
              placeholder="Search by name, phone or plan..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
            {searchQuery && (
              <button
                className="btn btn-outline-secondary"
                type="button"
                onClick={() => setSearchQuery('')}
              >
                ✕
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Leads List */}
      {loading ? (
        <div className="text-center py-5">
          <div className="spinner-border text-primary" role="status"></div>
          <div className="small text-muted mt-2">Loading leads...</div>
        </div>
      ) : filteredLeads.length === 0 ? (
        <div className="card shadow-sm border-0 bg-white text-center p-4">
          <div className="display-6 text-muted mb-2">📇</div>
          <h6 className="fw-bold text-dark mb-1">
            {leads.length === 0 ? 'No Leads Yet' : 'No matching leads found'}
          </h6>
          <p className="text-muted small mb-3">
            {leads.length === 0
              ? 'When visitors fill the consultation request form on your digital visiting card, they will appear here instantly!'
              : 'Try changing your filter or search keywords.'}
          </p>
          {leads.length === 0 && (
            <div>
              <a
                href={cardUrl}
                target="_blank"
                rel="noreferrer"
                className="btn btn-primary btn-sm px-3 py-2 fw-bold"
              >
                <i className="bi bi-box-arrow-up-right me-1"></i> Open & Test Your Card
              </a>
            </div>
          )}
        </div>
      ) : (
        <div className="d-flex flex-column gap-3 mb-4">
          {filteredLeads.map((lead) => {
            const createdDate = lead.created_at
              ? new Date(lead.created_at).toLocaleDateString('en-IN', {
                  day: 'numeric',
                  month: 'short',
                  year: 'numeric',
                  hour: '2-digit',
                  minute: '2-digit'
                })
              : 'Recently';

            return (
              <div
                key={lead.id}
                className={`card shadow-sm border-0 bg-white border-start border-4 ${
                  lead.status === 'new'
                    ? 'border-danger'
                    : lead.status === 'contacted'
                    ? 'border-info'
                    : 'border-success'
                }`}
                style={{ borderRadius: '10px' }}
              >
                <div className="card-body p-3">
                  {/* Top Row: Name, Status & Date */}
                  <div className="d-flex justify-content-between align-items-start mb-2">
                    <div>
                      <div className="fw-bold text-dark fs-6 d-flex align-items-center flex-wrap gap-1">
                        <span>{lead.full_name}</span>
                        {lead.status === 'new' && (
                          <span className="badge bg-danger" style={{ fontSize: '0.65rem' }}>
                            NEW
                          </span>
                        )}
                        {lead.status === 'contacted' && (
                          <span className="badge bg-info text-dark" style={{ fontSize: '0.65rem' }}>
                            CONTACTED
                          </span>
                        )}
                        {lead.status === 'converted' && (
                          <span className="badge bg-success" style={{ fontSize: '0.65rem' }}>
                            CONVERTED
                          </span>
                        )}
                      </div>
                      <div className="text-muted" style={{ fontSize: '0.72rem' }}>
                        <i className="bi bi-clock me-1"></i>
                        {createdDate}
                      </div>
                    </div>

                    <div className="d-flex align-items-center gap-1">
                      {/* Quick status toggle button */}
                      {lead.status === 'new' ? (
                        <button
                          type="button"
                          className="btn btn-sm btn-outline-info py-0 px-2 text-nowrap"
                          style={{ fontSize: '0.7rem' }}
                          title="Mark as Contacted"
                          onClick={() => handleUpdateStatus(lead, 'contacted')}
                        >
                          Mark Contacted
                        </button>
                      ) : lead.status === 'contacted' ? (
                        <button
                          type="button"
                          className="btn btn-sm btn-outline-secondary py-0 px-2 text-nowrap"
                          style={{ fontSize: '0.7rem' }}
                          title="Revert to New"
                          onClick={() => handleUpdateStatus(lead, 'new')}
                        >
                          Mark New
                        </button>
                      ) : null}

                      <button
                        type="button"
                        className="btn btn-sm btn-link text-muted p-1 text-decoration-none"
                        title="Delete lead"
                        onClick={() => handleDeleteLead(lead.id, lead.full_name)}
                      >
                        <i className="bi bi-trash text-danger"></i>
                      </button>
                    </div>
                  </div>

                  {/* Interested Plan Badge */}
                  <div className="mb-2">
                    <span className="badge bg-primary-subtle text-primary border border-primary px-2 py-1">
                      <i className="bi bi-shield-check me-1"></i>
                      Interested in: {lead.interest_area || 'LIC Policy'}
                    </span>
                  </div>

                  {/* Customer Note */}
                  {lead.message && (
                    <div
                      className="p-2 mb-2 rounded bg-light border-start border-3 border-primary text-secondary small fst-italic"
                      style={{ fontSize: '0.75rem' }}
                    >
                      "{lead.message}"
                    </div>
                  )}

                  {/* Contact Details */}
                  <div className="d-flex flex-wrap gap-3 small text-muted mb-3" style={{ fontSize: '0.75rem' }}>
                    <div className="d-flex align-items-center">
                      <i className="bi bi-telephone text-success me-1"></i>
                      <strong className="text-dark me-1">{lead.phone}</strong>
                      <button
                        type="button"
                        className="btn btn-link btn-sm p-0 text-muted ms-1"
                        title="Copy phone"
                        onClick={() => handleCopyPhone(lead)}
                      >
                        <i className={`bi ${copiedPhoneId === lead.id ? 'bi-check-lg text-success' : 'bi-copy'}`}></i>
                      </button>
                    </div>
                    {lead.email && (
                      <div className="d-flex align-items-center">
                        <i className="bi bi-envelope text-primary me-1"></i>
                        <span>{lead.email}</span>
                      </div>
                    )}
                  </div>

                  {/* Action Buttons */}
                  <div className="d-flex gap-2 flex-wrap">
                    {/* Call Button */}
                    <button
                      type="button"
                      className="btn btn-outline-success btn-sm flex-fill d-flex align-items-center justify-content-center py-2"
                      style={{ fontSize: '0.78rem', minWidth: '90px' }}
                      onClick={() => handleCall(lead)}
                    >
                      <i className="bi bi-telephone-fill me-1"></i> Call
                    </button>

                    {/* WhatsApp Button */}
                    <button
                      type="button"
                      className="btn btn-success btn-sm flex-fill d-flex align-items-center justify-content-center py-2"
                      style={{ fontSize: '0.78rem', minWidth: '100px' }}
                      onClick={() => handleWhatsApp(lead)}
                    >
                      <i className="bi bi-whatsapp me-1"></i> WhatsApp
                    </button>

                    {/* Convert to Client Button */}
                    {lead.status !== 'converted' ? (
                      <button
                        type="button"
                        className="btn btn-primary btn-sm flex-fill d-flex align-items-center justify-content-center py-2"
                        style={{ fontSize: '0.78rem', minWidth: '130px' }}
                        onClick={() => handleOpenConvertModal(lead)}
                      >
                        <i className="bi bi-person-plus-fill me-1"></i> Convert to Client
                      </button>
                    ) : (
                      <Link
                        to={lead.converted_client_id ? `/client/${lead.converted_client_id}` : '/dashboard'}
                        className="btn btn-outline-primary btn-sm flex-fill d-flex align-items-center justify-content-center py-2 text-decoration-none"
                        style={{ fontSize: '0.78rem', minWidth: '130px' }}
                      >
                        <i className="bi bi-person-check-fill me-1"></i> View Client →
                      </Link>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Policy Entry Modal on Lead Conversion */}
      {convertingLead && (
        <div
          className="modal show d-block"
          tabIndex="-1"
          style={{ backgroundColor: 'rgba(0,0,0,0.65)', zIndex: 1060, overflowY: 'auto' }}
          onClick={(e) => {
            if (e.target === e.currentTarget && !isSubmittingPolicy) {
              setConvertingLead(null);
            }
          }}
        >
          <div className="modal-dialog modal-dialog-centered modal-dialog-scrollable my-2" style={{ maxHeight: '94vh' }}>
            <div className="modal-content border-0 shadow" style={{ maxHeight: '92vh', display: 'flex', flexDirection: 'column' }}>
              {/* Modal Header */}
              <div className="modal-header bg-primary text-white flex-shrink-0">
                <div>
                  <h5 className="modal-title fs-6 fw-bold mb-0 d-flex align-items-center">
                    <i className="bi bi-file-earmark-plus-fill me-2"></i>
                    Add Policy & Convert Lead
                  </h5>
                  <small className="opacity-75" style={{ fontSize: '0.72rem' }}>
                    Enter policy details to add {convertingLead.full_name} as a client
                  </small>
                </div>
                <button
                  type="button"
                  className="btn-close btn-close-white"
                  disabled={isSubmittingPolicy}
                  onClick={() => setConvertingLead(null)}
                ></button>
              </div>

              {/* Policy Entry Form */}
              <form onSubmit={handleConfirmConvert} className="d-flex flex-column" style={{ minHeight: 0, flex: '1 1 auto', overflow: 'hidden' }}>
                <div className="modal-body p-3" style={{ overflowY: 'auto', flex: '1 1 auto', WebkitOverflowScrolling: 'touch' }}>
                  {/* Lead Summary Preview Card */}
                  <div className="p-2 mb-3 rounded bg-light border">
                    <div className="d-flex justify-content-between align-items-center mb-1">
                      <span className="fw-bold text-dark small">{convertingLead.full_name}</span>
                      <span className="badge bg-primary-subtle text-primary border border-primary" style={{ fontSize: '0.68rem' }}>
                        {convertingLead.interest_area || 'Visiting Card Inquiry'}
                      </span>
                    </div>
                    <div className="d-flex flex-wrap gap-2 text-muted" style={{ fontSize: '0.75rem' }}>
                      <span><i className="bi bi-telephone text-success me-1"></i>{convertingLead.phone}</span>
                      {convertingLead.email && (
                        <span><i className="bi bi-envelope text-primary me-1"></i>{convertingLead.email}</span>
                      )}
                    </div>
                    {convertingLead.message && (
                      <div className="mt-1 text-secondary fst-italic" style={{ fontSize: '0.72rem' }}>
                        "{convertingLead.message}"
                      </div>
                    )}
                  </div>

                  {/* Plan Name */}
                  <div className="mb-2">
                    <label className="form-label small fw-bold mb-1">Plan Name *</label>
                    <select
                      className="form-select form-select-sm"
                      value={policyForm.policy_name}
                      onChange={(e) => handlePlanChange(e.target.value)}
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

                  {/* Policy Number & Plan Type */}
                  <div className="row g-2 mb-2">
                    <div className="col-7">
                      <label className="form-label small fw-bold mb-1">Policy Number *</label>
                      <input
                        type="text"
                        className="form-control form-control-sm"
                        placeholder="e.g. 123456789"
                        value={policyForm.policy_number}
                        onChange={(e) => setPolicyForm({ ...policyForm, policy_number: e.target.value })}
                        required
                      />
                    </div>
                    <div className="col-5">
                      <label className="form-label small fw-bold mb-1">Plan Category</label>
                      <input
                        type="text"
                        className="form-control form-control-sm"
                        value={policyForm.plan_type}
                        onChange={(e) => setPolicyForm({ ...policyForm, plan_type: e.target.value })}
                      />
                    </div>
                  </div>

                  {/* Sum Assured & Premium */}
                  <div className="row g-2 mb-2">
                    <div className="col-6">
                      <label className="form-label small fw-bold mb-1">Sum Assured (₹) *</label>
                      <input
                        type="number"
                        className="form-control form-control-sm"
                        min="10000"
                        step="10000"
                        value={policyForm.sum_assured}
                        onChange={(e) => setPolicyForm({ ...policyForm, sum_assured: e.target.value })}
                        required
                      />
                    </div>
                    <div className="col-6">
                      <label className="form-label small fw-bold mb-1">Premium Amount (₹) *</label>
                      <input
                        type="number"
                        className="form-control form-control-sm"
                        min="100"
                        step="100"
                        value={policyForm.premium_amount}
                        onChange={(e) => setPolicyForm({ ...policyForm, premium_amount: e.target.value })}
                        required
                      />
                    </div>
                  </div>

                  {/* Premium Frequency & Start Date */}
                  <div className="row g-2 mb-2">
                    <div className="col-6">
                      <label className="form-label small fw-bold mb-1">Premium Frequency</label>
                      <select
                        className="form-select form-select-sm"
                        value={policyForm.premium_frequency}
                        onChange={(e) => handleFrequencyChange(e.target.value)}
                      >
                        <option value="yearly">Yearly</option>
                        <option value="half-yearly">Half-Yearly</option>
                        <option value="quarterly">Quarterly</option>
                        <option value="monthly">Monthly</option>
                      </select>
                    </div>
                    <div className="col-6">
                      <label className="form-label small fw-bold mb-1">Start Date</label>
                      <input
                        type="date"
                        className="form-control form-control-sm"
                        value={policyForm.start_date}
                        onChange={(e) => setPolicyForm({ ...policyForm, start_date: e.target.value })}
                        required
                      />
                    </div>
                  </div>

                  {/* Next Due Date */}
                  <div className="mb-1">
                    <label className="form-label small fw-bold mb-1">Next Premium Due Date</label>
                    <input
                      type="date"
                      className="form-control form-control-sm"
                      value={policyForm.next_due_date}
                      onChange={(e) => setPolicyForm({ ...policyForm, next_due_date: e.target.value })}
                      required
                    />
                  </div>
                </div>

                <div className="modal-footer bg-light p-2 d-flex justify-content-between flex-shrink-0">
                  <button
                    type="button"
                    className="btn btn-sm btn-secondary"
                    disabled={isSubmittingPolicy}
                    onClick={() => setConvertingLead(null)}
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="btn btn-sm btn-primary px-3 fw-bold d-flex align-items-center"
                    disabled={isSubmittingPolicy}
                  >
                    {isSubmittingPolicy ? (
                      <>
                        <span className="spinner-border spinner-border-sm me-1" role="status"></span>
                        Saving...
                      </>
                    ) : (
                      <>
                        <i className="bi bi-check-circle-fill me-1"></i>
                        Save Policy & Add Client
                      </>
                    )}
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
