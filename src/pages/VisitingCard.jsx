import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { getAllFromStore, putInStore } from '../utils/offlineDB';
import { supabase } from '../supabaseClient';
import { QRCodeSVG } from 'qrcode.react';
import { buildPublicUrl } from '../utils/publicUrl';

export function VisitingCard() {
  const { agentSlug } = useParams();
  const [agent, setAgent] = useState(null);
  const [loading, setLoading] = useState(true);

  // Lead Form
  const [form, setForm] = useState({
    full_name: '',
    phone: '',
    email: '',
    interest_area: 'Term Plan',
    message: ''
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submittedSuccess, setSubmittedSuccess] = useState(false);

  useEffect(() => {
    async function loadAgent() {
      setLoading(true);
      const agents = await getAllFromStore('agents');
      const found = agents.find(a => a.card_slug === agentSlug || a.id === agentSlug) || agents[0];
      setAgent(found || null);
      setLoading(false);
    }
    loadAgent();
  }, [agentSlug]);

  const handleSubmitLead = async (e) => {
    e.preventDefault();
    if (!form.full_name || !form.phone) return;

    setIsSubmitting(true);
    try {
      const newLead = {
        id: `lead-${Date.now()}`,
        agent_id: agent?.id || '00000000-0000-0000-0000-000000000001',
        full_name: form.full_name,
        phone: form.phone,
        email: form.email || '',
        interest_area: form.interest_area,
        message: form.message || '',
        source: 'visiting_card',
        status: 'new',
        created_at: new Date().toISOString()
      };

      // 1. Send to Central Server API (so it updates in real time on the Agent's Dashboard across devices)
      try {
        await fetch('/api/leads', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(newLead)
        });
      } catch (apiErr) {
        console.warn('API leads post fallback:', apiErr);
      }

      // 2. Also save to Supabase / local IndexedDB
      await supabase.from('leads').insert(newLead).catch(() => {});
      await putInStore('leads', newLead).catch(() => {});
      setSubmittedSuccess(true);
      setForm({ full_name: '', phone: '', email: '', interest_area: 'Term Plan', message: '' });
    } catch (err) {
      console.error('Lead submission failed:', err);
    } finally {
      setIsSubmitting(false);
    }
  };

  const slug = agentSlug || agent?.card_slug || 'rajesh-verma';
  const cardUrl = buildPublicUrl(`/card/${slug}`);

  if (loading) {
    return (
      <div className="container py-5 text-center">
        <div className="spinner-border text-primary" role="status"></div>
      </div>
    );
  }

  const agentName = agent?.full_name || 'Rajesh Verma';
  const agentPhone = agent?.phone || '+91 98765 43210';
  const licenseNo = agent?.license_number || 'LIC/2019/DEL/849201';

  return (
    <div className="container py-4 px-3" style={{ maxWidth: '460px' }}>
      {/* Digital Visiting Card Canvas */}
      <div className="card shadow-lg border-0 mb-4 text-white overflow-hidden" style={{ borderRadius: '20px', background: 'linear-gradient(135deg, #0d6efd 0%, #0a4da8 100%)' }}>
        <div className="card-body p-4 text-center">
          <div className="d-flex justify-content-between align-items-center mb-3">
            <span className="fs-3">🛡️</span>
            <span className="badge bg-warning text-dark fw-bold px-2 py-1">LIC OF INDIA</span>
          </div>

          {/* Profile Photo */}
          <div className="mb-3">
            <div
              className="rounded-circle mx-auto border border-4 border-white shadow-sm d-flex align-items-center justify-content-center bg-white text-primary fw-bold display-6"
              style={{ width: '90px', height: '90px' }}
            >
              {agentName.charAt(0)}
            </div>
          </div>

          <h4 className="fw-bold mb-1">{agentName}</h4>
          <div className="small opacity-75 mb-2">Senior LIC Insurance Advisor & Financial Consultant</div>
          <div className="badge bg-light bg-opacity-25 text-white mb-3" style={{ fontSize: '0.75rem' }}>
            Agency Code: {licenseNo}
          </div>

          {/* Direct Call & WhatsApp Buttons */}
          <div className="d-flex gap-2 justify-content-center mb-4">
            <a
              href={`tel:${agentPhone}`}
              className="btn btn-light text-primary fw-bold btn-sm px-3 py-2 rounded-pill flex-fill d-flex align-items-center justify-content-center shadow-sm"
            >
              <i className="bi bi-telephone-fill me-2"></i> Call Now
            </a>

            <a
              href={`https://wa.me/${agentPhone.replace(/\D/g, '')}?text=Hello%20${encodeURIComponent(agentName)},%20I%20visited%20your%20digital%20card%20and%20would%20like%20insurance%20information.`}
              target="_blank"
              rel="noreferrer"
              className="btn btn-success fw-bold btn-sm px-3 py-2 rounded-pill flex-fill d-flex align-items-center justify-content-center shadow-sm"
            >
              <i className="bi bi-whatsapp me-2"></i> WhatsApp Me
            </a>
          </div>

          {/* QR Code Container */}
          <div className="bg-white p-3 rounded-4 d-inline-block shadow-sm mb-2">
            <QRCodeSVG value={cardUrl} size={110} level="M" />
            <div className="text-dark small fw-bold mt-1" style={{ fontSize: '0.65rem' }}>
              Scan to Save Contact
            </div>
          </div>
        </div>
      </div>

      {/* Lead Capture Form (PRD Screen 9 & Section 13) */}
      <div className="card shadow-sm border-0 mb-4 bg-white" style={{ borderRadius: '16px' }}>
        <div className="card-body p-4">
          <h5 className="fw-bold text-dark mb-1 d-flex align-items-center">
            <i className="bi bi-envelope-check-fill text-primary me-2"></i>
            Request Free Policy Consultation
          </h5>
          <p className="text-muted small mb-3">
            Leave your details and {agentName} will prepare a customized quotation within 2 hours.
          </p>

          {submittedSuccess ? (
            <div className="alert alert-success p-3 rounded-3 text-center animate__animated animate__fadeIn">
              <div className="fs-3 text-success mb-1">🎉</div>
              <h6 className="fw-bold text-success mb-1">Request Received!</h6>
              <p className="small mb-0">
                Thank you, <strong>{form.full_name || 'Friend'}</strong>! {agentName} has received your inquiry and will call you shortly.
              </p>
            </div>
          ) : (
            <form onSubmit={handleSubmitLead}>
              <div className="mb-2">
                <label className="form-label small fw-bold text-muted">Your Name *</label>
                <input
                  type="text"
                  className="form-control form-control-sm"
                  required
                  placeholder="e.g. Rahul Sharma"
                  value={form.full_name}
                  onChange={(e) => setForm({ ...form, full_name: e.target.value })}
                />
              </div>

              <div className="mb-2">
                <label className="form-label small fw-bold text-muted">Phone Number *</label>
                <input
                  type="tel"
                  className="form-control form-control-sm"
                  required
                  placeholder="98XXXXXXXX"
                  value={form.phone}
                  onChange={(e) => setForm({ ...form, phone: e.target.value })}
                />
              </div>

              <div className="mb-2">
                <label className="form-label small fw-bold text-muted">Area of Interest</label>
                <select
                  className="form-select form-select-sm"
                  value={form.interest_area}
                  onChange={(e) => setForm({ ...form, interest_area: e.target.value })}
                >
                  <option>Term Life Plan (1 Cr+ Cover)</option>
                  <option>Guaranteed Return Endowment Plan</option>
                  <option>Child Education & Marriage Fund</option>
                  <option>Retirement & Pension Guaranteed Plan</option>
                  <option>Health & Critical Illness Rider</option>
                  <option>Revival of Old Lapsed Policy</option>
                </select>
              </div>

              <div className="mb-3">
                <label className="form-label small fw-bold text-muted">Your Note / Requirement (Optional)</label>
                <textarea
                  className="form-control form-control-sm"
                  rows="2"
                  placeholder="e.g. Looking for best 20-year savings plan..."
                  value={form.message}
                  onChange={(e) => setForm({ ...form, message: e.target.value })}
                ></textarea>
              </div>

              <button
                type="submit"
                className="btn btn-primary w-100 fw-bold py-2 shadow-sm"
                disabled={isSubmitting}
              >
                {isSubmitting ? (
                  <>
                    <span className="spinner-border spinner-border-sm me-2" role="status"></span>
                    Sending Request...
                  </>
                ) : (
                  'Submit Consultation Request'
                )}
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
