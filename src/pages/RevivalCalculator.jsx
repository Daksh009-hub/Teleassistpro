import React, { useState, useEffect } from 'react';
import { calculateRevival } from '../utils/revivalCalc';
import { getAllFromStore, putInStore } from '../utils/offlineDB';
import { WhatsAppTemplatePicker } from '../components/WhatsAppTemplatePicker';
import { useGamification } from '../context/GamificationContext';

export function RevivalCalculator() {
  const { awardXP } = useGamification();
  const [clients, setClients] = useState([]);
  const [selectedClientId, setSelectedClientId] = useState('');

  const [policyNumber, setPolicyNumber] = useState('554433221');
  const [planName, setPlanName] = useState('LIC Jeevan Umang (Plan 945)');
  const [premiumAmount, setPremiumAmount] = useState(72000);
  const [lastPaidDate, setLastPaidDate] = useState(
    new Date(Date.now() - 240 * 86400000).toISOString().split('T')[0] // 8 months ago
  );
  const [interestRate, setInterestRate] = useState(8.0); // 8% p.a.
  const [showWhatsApp, setShowWhatsApp] = useState(false);
  const [saveSuccessNotice, setSaveSuccessNotice] = useState(null);

  useEffect(() => {
    getAllFromStore('clients').then(res => setClients(res || []));
  }, []);

  const revivalResult = calculateRevival({
    premiumAmount,
    lastPaidDate,
    interestRateAnnual: interestRate
  });

  const handleSelectClient = (clientId) => {
    setSelectedClientId(clientId);
    const c = clients.find(item => item.id === clientId);
    if (c) {
      // Look up if client has a lapsed policy
      getAllFromStore('policies').then(policies => {
        const p = policies.find(pol => pol.client_id === clientId && pol.status === 'lapsed');
        if (p) {
          setPolicyNumber(p.policy_number || '123456789');
          setPlanName(p.policy_name || 'LIC Policy');
          setPremiumAmount(p.premium_amount || 25000);
          if (p.next_due_date) setLastPaidDate(p.next_due_date);
        }
      });
    }
  };

  const handleSaveToClientTimeline = async () => {
    if (!selectedClientId) return;
    const targetClient = clients.find(c => c.id === selectedClientId);

    const actRecord = {
      id: `act-${Date.now()}`,
      agent_id: targetClient?.agent_id || '00000000-0000-0000-0000-000000000001',
      client_id: selectedClientId,
      activity_type: 'note',
      title: `Policy Revival Estimate: ${planName}`,
      description: `Lapsed for ${revivalResult.lapseMonths} months. Original Premium: ₹${premiumAmount.toLocaleString('en-IN')}, Late Fee: ₹${revivalResult.lateFee.toLocaleString('en-IN')}, Net Payable: ₹${revivalResult.netPayable.toLocaleString('en-IN')}`,
      status: 'done',
      completed_at: new Date().toISOString()
    };

    await putInStore('activities', actRecord);
    await awardXP('call_logged', `Saved revival estimate for ${targetClient?.full_name || 'Client'}`);
    setSaveSuccessNotice('✓ Revival estimate saved to client relationship timeline!');
    setTimeout(() => setSaveSuccessNotice(null), 4000);
  };

  const activeClientObj = clients.find(c => c.id === selectedClientId) || {
    full_name: 'Valued Policyholder',
    phone: '9833445566'
  };

  return (
    <div className="container py-3 px-3">
      {/* Title */}
      <div className="d-flex justify-content-between align-items-center mb-3">
        <h5 className="fw-bold mb-0 text-dark d-flex align-items-center">
          <i className="bi bi-calculator-fill text-primary me-2"></i>
          Auto-Revival Calculator
        </h5>
        <span className="badge bg-warning text-dark">8% p.a. Late Fee</span>
      </div>

      <div className="card shadow-sm border-0 mb-3 bg-white">
        <div className="card-body p-3">
          {/* Quick Client Selector */}
          <div className="mb-3">
            <label className="form-label small fw-bold text-muted">LINK TO CLIENT (OPTIONAL)</label>
            <select
              className="form-select form-select-sm"
              value={selectedClientId}
              onChange={(e) => handleSelectClient(e.target.value)}
            >
              <option value="">Choose a client...</option>
              {clients.map(c => (
                <option key={c.id} value={c.id}>
                  {c.full_name} ({c.phone})
                </option>
              ))}
            </select>
          </div>

          {/* Input Fields */}
          <div className="mb-2">
            <label className="form-label small fw-bold text-muted">PLAN NAME</label>
            <input
              type="text"
              className="form-control form-control-sm"
              value={planName}
              onChange={(e) => setPlanName(e.target.value)}
            />
          </div>

          <div className="row g-2 mb-2">
            <div className="col-6">
              <label className="form-label small fw-bold text-muted">POLICY NUMBER</label>
              <input
                type="text"
                className="form-control form-control-sm"
                value={policyNumber}
                onChange={(e) => setPolicyNumber(e.target.value)}
              />
            </div>
            <div className="col-6">
              <label className="form-label small fw-bold text-muted">PREMIUM AMOUNT (₹)</label>
              <input
                type="number"
                className="form-control form-control-sm"
                value={premiumAmount}
                onChange={(e) => setPremiumAmount(parseFloat(e.target.value) || 0)}
              />
            </div>
          </div>

          <div className="row g-2 mb-3">
            <div className="col-6">
              <label className="form-label small fw-bold text-muted">LAST PAID / DUE DATE</label>
              <input
                type="date"
                className="form-control form-control-sm"
                value={lastPaidDate}
                onChange={(e) => setLastPaidDate(e.target.value)}
              />
            </div>
            <div className="col-6">
              <label className="form-label small fw-bold text-muted">LATE FEE RATE (% P.A.)</label>
              <input
                type="number"
                step="0.5"
                className="form-control form-control-sm"
                value={interestRate}
                onChange={(e) => setInterestRate(parseFloat(e.target.value) || 8)}
              />
            </div>
          </div>

          {/* Results Display Card */}
          <div className="card bg-light border-primary p-3 mb-3">
            <div className="d-flex justify-content-between align-items-center mb-2">
              <span className="fw-bold small text-primary text-uppercase">Revival Calculation Breakdown</span>
              <span className={`badge ${revivalResult.isLapsed ? 'bg-danger' : 'bg-success'}`}>
                {revivalResult.isLapsed ? `Lapsed: ${revivalResult.lapseMonths} Mos` : 'Within Grace Period'}
              </span>
            </div>

            <div className="row g-2 small mb-2">
              <div className="col-6 text-muted">Original Premium:</div>
              <div className="col-6 text-end fw-bold">₹{premiumAmount.toLocaleString('en-IN')}</div>

              <div className="col-6 text-muted">Lapsed Period:</div>
              <div className="col-6 text-end">{revivalResult.lapseMonths} Months ({revivalResult.lapseDays} Days)</div>

              <div className="col-6 text-muted">Estimated Late Fee (8% p.a.):</div>
              <div className="col-6 text-end text-danger fw-bold">+ ₹{revivalResult.lateFee.toLocaleString('en-IN')}</div>
            </div>

            <div className="d-flex justify-content-between align-items-center pt-2 border-top border-secondary border-opacity-25">
              <div className="fw-bold fs-6 text-dark">Estimated Net Payable:</div>
              <div className="fw-bold fs-4 text-primary">₹{revivalResult.netPayable.toLocaleString('en-IN')}</div>
            </div>

            <div className="text-muted mt-2" style={{ fontSize: '0.68rem' }}>
              *Disclaimer: This is an automated estimate based on standard LIC interest rules. Final revival figures subject to branch confirmation.
            </div>
          </div>

          {saveSuccessNotice && (
            <div className="alert alert-success py-2 small mb-2 animate__animated animate__fadeIn">
              {saveSuccessNotice}
            </div>
          )}

          {/* Actions */}
          <div className="d-flex gap-2">
            <button
              type="button"
              className="btn btn-outline-primary flex-fill btn-sm py-2 fw-bold"
              disabled={!selectedClientId}
              onClick={handleSaveToClientTimeline}
            >
              <i className="bi bi-journal-plus me-1"></i> Save to Timeline
            </button>

            <button
              type="button"
              className="btn btn-success flex-fill btn-sm py-2 fw-bold"
              onClick={() => setShowWhatsApp(true)}
            >
              <i className="bi bi-whatsapp me-1"></i> Send WhatsApp Alert
            </button>
          </div>
        </div>
      </div>

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
              client={activeClientObj}
              policy={{
                policy_name: planName,
                premium_amount: premiumAmount
              }}
              defaultTemplate="revival_reminder"
              onClose={() => setShowWhatsApp(false)}
            />
          </div>
        </div>
      )}
    </div>
  );
}
