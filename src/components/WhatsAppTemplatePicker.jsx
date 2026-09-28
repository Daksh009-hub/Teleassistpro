import React, { useState, useEffect } from 'react';
import {
  TEMPLATES,
  formatIndianPhone,
  buildDirectWhatsAppURL,
  buildDirectWhatsAppWebURL
} from '../utils/whatsappTemplates';
import { useAuth } from '../context/AuthContext';
import { useGamification } from '../context/GamificationContext';
import { putInStore } from '../utils/offlineDB';
import { buildPublicUrl } from '../utils/publicUrl';

export function WhatsAppTemplatePicker({ client = {}, policy = {}, defaultTemplate = 'renewal_reminder', initialMessage = '', onClose }) {
  const { agent } = useAuth();
  const { awardXP } = useGamification();

  const [selectedKey, setSelectedKey] = useState(defaultTemplate);
  const [recipientPhone, setRecipientPhone] = useState(client.phone || '9811223344');
  const [messageText, setMessageText] = useState(initialMessage || '');
  const [copied, setCopied] = useState(false);
  const [sentNotice, setSentNotice] = useState(null);

  const templateData = {
    clientName: client.full_name || 'Customer',
    agentName: agent?.full_name || 'Rajesh Verma',
    agentPhone: agent?.phone || '+91 98765 43210',
    policyName: policy.policy_name || 'LIC Jeevan Labh (Plan 936)',
    premiumAmount: (policy.premium_amount || 25000).toLocaleString('en-IN'),
    dueDate: policy.next_due_date || 'in 15 days',
    docList: '1. Aadhaar Card (Front & Back)\n2. PAN Card copy\n3. Bank Account Cancelled Cheque',
    kycLink: buildPublicUrl(`/kyc/${client.id || 'demo'}`),
    quoteLink: buildPublicUrl(`/view/${policy.trackable_link || 'quote-demo'}`),
    interestArea: client.tags?.[0] || 'Term & Pension Planning',
    netPayable: (policy.premium_amount ? policy.premium_amount * 1.1 : 27500).toLocaleString('en-IN'),
    lateFee: '2,500'
  };

  // Update message text when template changes unless initial custom message provided
  useEffect(() => {
    if (initialMessage) {
      setMessageText(initialMessage);
    } else {
      const currentTemplate = TEMPLATES[selectedKey] || TEMPLATES.renewal_reminder;
      setMessageText(currentTemplate.template(templateData));
    }
  }, [selectedKey, initialMessage]);

  const currentTemplate = TEMPLATES[selectedKey] || TEMPLATES.renewal_reminder;
  const waAppUrl = buildDirectWhatsAppURL(recipientPhone, messageText);
  const waWebUrl = buildDirectWhatsAppWebURL(recipientPhone, messageText);

  const handleCopyMessage = () => {
    if (typeof navigator !== 'undefined' && navigator.clipboard) {
      navigator.clipboard.writeText(messageText);
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 3000);
  };

  const handleRecordWhatsAppActivity = async () => {
    if (client.id) {
      await putInStore('activities', {
        id: `act-${Date.now()}`,
        agent_id: client.agent_id || '00000000-0000-0000-0000-000000000001',
        client_id: client.id,
        activity_type: 'call',
        title: `WhatsApp Sent: ${currentTemplate.label}`,
        description: messageText,
        status: 'done',
        completed_at: new Date().toISOString()
      });
      await awardXP('followup_done', `Sent WhatsApp message to ${client.full_name || 'Client'}`);
      setSentNotice('✓ Message logged to Client Relationship Timeline! (+10 XP)');
      setTimeout(() => {
        if (onClose) onClose();
      }, 1500);
    } else {
      if (onClose) onClose();
    }
  };

  return (
    <div className="modal-content card shadow-lg border-0 bg-white" style={{ pointerEvents: 'auto', borderRadius: '16px' }}>
      {/* Header */}
      <div className="card-header bg-success text-white d-flex justify-content-between align-items-center py-3">
        <div className="d-flex align-items-center">
          <i className="bi bi-whatsapp fs-4 me-2"></i>
          <div>
            <h6 className="fw-bold mb-0">Send WhatsApp Message</h6>
            <small className="opacity-75" style={{ fontSize: '0.72rem' }}>
              To: {client.full_name || 'Customer'} ({recipientPhone})
            </small>
          </div>
        </div>
        {onClose && (
          <button type="button" className="btn-close btn-close-white" onClick={onClose}></button>
        )}
      </div>

      <div className="card-body p-3">
        {/* Recipient Phone Field */}
        <div className="mb-2">
          <label className="form-label small fw-bold text-muted mb-1">RECIPIENT WHATSAPP NUMBER</label>
          <div className="input-group input-group-sm">
            <span className="input-group-text bg-light fw-bold text-success">+91</span>
            <input
              type="tel"
              className="form-control font-monospace"
              placeholder="98XXXXXXXX"
              value={recipientPhone}
              onChange={(e) => setRecipientPhone(e.target.value)}
            />
          </div>
        </div>

        {/* Template Selector Chips */}
        <label className="form-label small fw-bold text-muted mb-1">SELECT TEMPLATE</label>
        <div className="d-flex flex-wrap gap-1 mb-2" style={{ maxHeight: '110px', overflowY: 'auto' }}>
          {Object.entries(TEMPLATES).map(([key, item]) => (
            <button
              key={key}
              type="button"
              className={`btn btn-sm ${selectedKey === key ? 'btn-success fw-bold' : 'btn-outline-secondary'}`}
              style={{ fontSize: '0.72rem' }}
              onClick={() => {
                setSelectedKey(key);
                const tmpl = TEMPLATES[key];
                if (tmpl) setMessageText(tmpl.template(templateData));
              }}
            >
              <span className="me-1">{item.icon}</span>
              {item.label}
            </button>
          ))}
        </div>

        {/* Use Case Hint */}
        <div className="alert alert-info py-1 px-2 small mb-2 d-flex align-items-center" style={{ fontSize: '0.72rem' }}>
          <i className="bi bi-info-circle-fill me-1 text-info"></i>
          <span>{currentTemplate.useCases}</span>
        </div>

        {/* Editable Message Text Box */}
        <div className="d-flex justify-content-between align-items-center mb-1">
          <label className="form-label small fw-bold text-muted mb-0">MESSAGE CONTENT (EDITABLE)</label>
          <button
            type="button"
            className="btn btn-sm btn-link p-0 text-success text-decoration-none fw-bold"
            style={{ fontSize: '0.75rem' }}
            onClick={handleCopyMessage}
          >
            {copied ? '✓ Copied!' : '📋 Copy Text'}
          </button>
        </div>

        <textarea
          className="form-control form-control-sm font-monospace mb-3"
          rows="5"
          style={{ fontSize: '0.8rem', backgroundColor: '#f4fbf7', border: '1px solid #c3e6cb' }}
          value={messageText}
          onChange={(e) => setMessageText(e.target.value)}
        ></textarea>

        {sentNotice && (
          <div className="alert alert-success py-2 small mb-3 text-center animate__animated animate__fadeIn">
            {sentNotice}
          </div>
        )}

        {/* WhatsApp Launch Action Buttons */}
        <div className="row g-2 mb-2">
          <div className="col-6">
            <a
              href={waWebUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="btn btn-success btn-sm w-100 fw-bold py-2 d-flex align-items-center justify-content-center text-decoration-none shadow-sm"
              onClick={() => handleRecordWhatsAppActivity()}
            >
              <i className="bi bi-globe me-1"></i>
              WhatsApp Web ↗
            </a>
          </div>

          <div className="col-6">
            <a
              href={waAppUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="btn btn-outline-success btn-sm w-100 fw-bold py-2 d-flex align-items-center justify-content-center text-decoration-none shadow-sm"
              onClick={() => handleRecordWhatsAppActivity()}
            >
              <i className="bi bi-phone me-1"></i>
              WhatsApp App ↗
            </a>
          </div>
        </div>

        {/* Secondary Actions */}
        <div className="d-flex gap-2 pt-2 border-top">
          {onClose && (
            <button
              type="button"
              className="btn btn-sm btn-light border flex-fill py-1"
              onClick={onClose}
            >
              Close
            </button>
          )}

          <button
            type="button"
            className="btn btn-sm btn-outline-primary flex-fill py-1 fw-bold"
            onClick={handleRecordWhatsAppActivity}
          >
            <i className="bi bi-check2-circle me-1"></i>
            Log to Timeline (+10 XP)
          </button>
        </div>
      </div>
    </div>
  );
}
