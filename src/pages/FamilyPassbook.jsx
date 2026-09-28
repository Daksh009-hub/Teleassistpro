import React, { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { getAllFromStore, putInStore } from '../utils/offlineDB';
import { useGamification } from '../context/GamificationContext';

export function FamilyPassbook() {
  const { id } = useParams();
  const { awardXP } = useGamification();

  const [headClient, setHeadClient] = useState(null);
  const [familyMembers, setFamilyMembers] = useState([]);
  const [allPolicies, setAllPolicies] = useState([]);
  const [allClients, setAllClients] = useState([]);
  const [loading, setLoading] = useState(true);

  const [showAddMemberModal, setShowAddMemberModal] = useState(false);
  const [selectedExistingId, setSelectedExistingId] = useState('');
  const [newMemberForm, setNewMemberForm] = useState({
    full_name: '',
    phone: '',
    dob: '1995-01-01',
    relation: 'Spouse'
  });

  const loadFamilyData = async () => {
    setLoading(true);
    try {
      const clients = await getAllFromStore('clients');
      setAllClients(clients);
      const head = clients.find(c => c.id === id);
      setHeadClient(head);

      // Find all family members (head + any member where family_head_id = id or id = head.family_head_id)
      const headId = head?.family_head_id || id;
      const members = clients.filter(c => c.id === headId || c.family_head_id === headId);
      setFamilyMembers(members);

      const policies = await getAllFromStore('policies');
      setAllPolicies(policies);
    } catch (e) {
      console.error('Error loading family passbook:', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadFamilyData();
  }, [id]);

  const handleLinkExistingMember = async () => {
    if (!selectedExistingId) return;
    const existing = allClients.find(c => c.id === selectedExistingId);
    if (existing) {
      const updated = { ...existing, family_head_id: headClient.family_head_id || headClient.id };
      await putInStore('clients', updated);
      await awardXP('client_added', `Linked ${existing.full_name} to Family Passbook`);
      setShowAddMemberModal(false);
      await loadFamilyData();
    }
  };

  const handleCreateNewMember = async (e) => {
    e.preventDefault();
    const newMember = {
      id: `c-fam-${Date.now()}`,
      agent_id: headClient.agent_id || '00000000-0000-0000-0000-000000000001',
      full_name: newMemberForm.full_name,
      phone: newMemberForm.phone || headClient.phone,
      dob: newMemberForm.dob,
      family_head_id: headClient.family_head_id || headClient.id,
      kyc_status: 'pending',
      status: 'active',
      tags: [newMemberForm.relation, 'Family Passbook']
    };

    await putInStore('clients', newMember);
    await awardXP('client_added', `Added family member ${newMember.full_name}`);
    setShowAddMemberModal(false);
    await loadFamilyData();
  };

  if (loading) {
    return (
      <div className="container py-4 text-center">
        <div className="spinner-border text-primary" role="status"></div>
      </div>
    );
  }

  // Calculate Family Total Sum Assured & Total Annual Premium
  const familyClientIds = new Set(familyMembers.map(m => m.id));
  const familyPolicies = allPolicies.filter(p => familyClientIds.has(p.client_id));
  const totalSumAssured = familyPolicies.reduce((sum, p) => sum + (parseFloat(p.sum_assured) || 0), 0);
  const totalAnnualPremium = familyPolicies.reduce((sum, p) => sum + (parseFloat(p.premium_amount) || 0), 0);

  return (
    <div className="container py-3 px-3">
      {/* Navigation Header */}
      <div className="d-flex justify-content-between align-items-center mb-3">
        <Link to={`/client/${id}`} className="btn btn-sm btn-light border py-1 px-2 d-flex align-items-center">
          <i className="bi bi-arrow-left me-1"></i> Back to Profile
        </Link>
        <span className="badge bg-primary text-white">👨‍👩‍👧 Family Passbook</span>
      </div>

      {/* Summary Card */}
      <div className="card shadow-sm border-0 mb-3 text-white" style={{ background: 'linear-gradient(135deg, #0d6efd 0%, #198754 100%)' }}>
        <div className="card-body p-3">
          <div className="d-flex justify-content-between align-items-start mb-2">
            <div>
              <h6 className="fw-bold mb-0">{headClient?.full_name}'s Family Portfolio</h6>
              <div className="small opacity-75">{familyMembers.length} Family Members Linked</div>
            </div>
            <span className="badge bg-warning text-dark fw-bold">
              {familyPolicies.length} Total Policies
            </span>
          </div>

          <div className="row g-2 mt-2 pt-2 border-top border-white border-opacity-25">
            <div className="col-6">
              <div className="small opacity-75">Combined Sum Assured</div>
              <div className="fw-bold fs-6">₹{totalSumAssured.toLocaleString('en-IN')}</div>
            </div>
            <div className="col-6">
              <div className="small opacity-75">Annual Family Premium</div>
              <div className="fw-bold fs-6">₹{totalAnnualPremium.toLocaleString('en-IN')}</div>
            </div>
          </div>
        </div>
      </div>

      {/* Add Member Button */}
      <div className="d-flex justify-content-between align-items-center mb-3">
        <h6 className="fw-bold text-dark mb-0">Family Members & Policies</h6>
        <button
          className="btn btn-sm btn-outline-primary d-flex align-items-center py-1 px-2"
          style={{ fontSize: '0.75rem' }}
          onClick={() => setShowAddMemberModal(true)}
        >
          <i className="bi bi-person-plus-fill me-1"></i> Add Member
        </button>
      </div>

      {/* Accordion list of Family Members */}
      <div className="accordion mb-4" id="familyAccordion">
        {familyMembers.map((member, index) => {
          const memberPolicies = allPolicies.filter(p => p.client_id === member.id);
          const isHead = member.id === (headClient?.family_head_id || headClient?.id);

          return (
            <div key={member.id} className="accordion-item shadow-sm border-0 mb-2 rounded overflow-hidden">
              <h2 className="accordion-header" id={`heading-${member.id}`}>
                <button
                  className="accordion-button bg-white py-3"
                  type="button"
                  data-bs-toggle="collapse"
                  data-bs-target={`#collapse-${member.id}`}
                  aria-expanded="true"
                >
                  <div className="d-flex justify-content-between align-items-center w-100 me-2">
                    <div className="d-flex align-items-center">
                      <div className="bg-light text-primary rounded-circle d-flex align-items-center justify-content-center fw-bold me-2" style={{ width: '36px', height: '36px' }}>
                        {member.full_name?.charAt(0)}
                      </div>
                      <div>
                        <div className="fw-bold small text-dark d-flex align-items-center">
                          {member.full_name}
                          {isHead && (
                            <span className="badge bg-primary-subtle text-primary ms-2" style={{ fontSize: '0.62rem' }}>
                              Family Head
                            </span>
                          )}
                        </div>
                        <div className="small text-muted" style={{ fontSize: '0.72rem' }}>
                          DOB: {member.dob || 'N/A'} • {memberPolicies.length} {memberPolicies.length === 1 ? 'Policy' : 'Policies'}
                        </div>
                      </div>
                    </div>
                  </div>
                </button>
              </h2>

              <div
                id={`collapse-${member.id}`}
                className="accordion-collapse collapse show"
                data-bs-parent="#familyAccordion"
              >
                <div className="accordion-body bg-light pt-2 pb-3">
                  {memberPolicies.length === 0 ? (
                    <div className="small text-muted text-center py-2 bg-white rounded border">
                      No policies found for {member.full_name}.
                    </div>
                  ) : (
                    memberPolicies.map(p => (
                      <div key={p.id} className="card border shadow-none bg-white p-2 mb-2">
                        <div className="d-flex justify-content-between align-items-start">
                          <div>
                            <div className="fw-bold small text-primary">{p.policy_name}</div>
                            <div className="text-muted" style={{ fontSize: '0.72rem' }}>
                              Policy #{p.policy_number}
                            </div>
                          </div>
                          <span className={`badge ${p.status === 'lapsed' ? 'bg-danger' : 'bg-success'}`} style={{ fontSize: '0.65rem' }}>
                            {p.status}
                          </span>
                        </div>

                        <div className="row g-1 mt-2 pt-1 border-top small" style={{ fontSize: '0.75rem' }}>
                          <div className="col-6 text-muted">
                            Sum Assured: <span className="text-dark fw-bold">₹{(p.sum_assured || 0).toLocaleString('en-IN')}</span>
                          </div>
                          <div className="col-6 text-muted">
                            Premium: <span className="text-dark fw-bold">₹{(p.premium_amount || 0).toLocaleString('en-IN')}</span>
                          </div>
                          <div className="col-12 text-muted mt-1">
                            <i className="bi bi-calendar-event me-1"></i> Next Due: <span className="text-dark fw-semibold">{p.next_due_date || 'N/A'}</span>
                          </div>
                        </div>
                      </div>
                    ))
                  )}

                  <div className="text-end mt-2">
                    <Link to={`/client/${member.id}`} className="btn btn-sm btn-link p-0 text-decoration-none" style={{ fontSize: '0.75rem' }}>
                      View Full Profile →
                    </Link>
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Add Member Modal */}
      {showAddMemberModal && (
        <div
          className="modal show d-block"
          tabIndex="-1"
          style={{ backgroundColor: 'rgba(0,0,0,0.6)', zIndex: 1060 }}
          onClick={(e) => { if (e.target === e.currentTarget) setShowAddMemberModal(false); }}
        >
          <div className="modal-dialog modal-dialog-centered">
            <div className="modal-content border-0 shadow">
              <div className="modal-header bg-primary text-white">
                <h5 className="modal-title fs-6 fw-bold">Add Family Member</h5>
                <button type="button" className="btn-close btn-close-white" onClick={() => setShowAddMemberModal(false)}></button>
              </div>
              <div className="modal-body">
                {/* Option 1: Link Existing Client */}
                <div className="card bg-light border p-3 mb-3">
                  <h6 className="fw-bold small mb-2 text-primary">Option 1: Link Existing Client</h6>
                  <div className="d-flex gap-2">
                    <select
                      className="form-select form-select-sm"
                      value={selectedExistingId}
                      onChange={(e) => setSelectedExistingId(e.target.value)}
                    >
                      <option value="">Choose an existing client...</option>
                      {allClients
                        .filter(c => !familyClientIds.has(c.id))
                        .map(c => (
                          <option key={c.id} value={c.id}>
                            {c.full_name} ({c.phone})
                          </option>
                        ))}
                    </select>
                    <button
                      type="button"
                      className="btn btn-sm btn-primary"
                      disabled={!selectedExistingId}
                      onClick={handleLinkExistingMember}
                    >
                      Link
                    </button>
                  </div>
                </div>

                <div className="text-center my-2 text-muted small">— OR —</div>

                {/* Option 2: Create New Family Member */}
                <form onSubmit={handleCreateNewMember}>
                  <h6 className="fw-bold small mb-2 text-success">Option 2: Create New Member</h6>
                  <div className="mb-2">
                    <label className="form-label small fw-bold">Full Name *</label>
                    <input
                      type="text"
                      className="form-control form-control-sm"
                      required
                      placeholder="e.g. Priya Sharma"
                      value={newMemberForm.full_name}
                      onChange={(e) => setNewMemberForm({ ...newMemberForm, full_name: e.target.value })}
                    />
                  </div>
                  <div className="row g-2 mb-2">
                    <div className="col-6">
                      <label className="form-label small fw-bold">Relation</label>
                      <select
                        className="form-select form-select-sm"
                        value={newMemberForm.relation}
                        onChange={(e) => setNewMemberForm({ ...newMemberForm, relation: e.target.value })}
                      >
                        <option>Spouse</option>
                        <option>Child (Son/Daughter)</option>
                        <option>Parent (Father/Mother)</option>
                        <option>Sibling</option>
                      </select>
                    </div>
                    <div className="col-6">
                      <label className="form-label small fw-bold">Date of Birth</label>
                      <input
                        type="date"
                        className="form-control form-control-sm"
                        value={newMemberForm.dob}
                        onChange={(e) => setNewMemberForm({ ...newMemberForm, dob: e.target.value })}
                      />
                    </div>
                  </div>
                  <button type="submit" className="btn btn-sm btn-success w-100 fw-bold mt-2">
                    Save New Member & Link (+10 XP)
                  </button>
                </form>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
