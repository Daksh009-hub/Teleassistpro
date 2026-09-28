import React, { useState, useEffect, useRef } from 'react';
import { useParams } from 'react-router-dom';
import { getAllFromStore, putInStore } from '../utils/offlineDB';
import { analyzePolicyText } from '../utils/gemini';

export function QuoteViewer() {
  const { trackId } = useParams();
  const [policy, setPolicy] = useState(null);
  const [agent, setAgent] = useState(null);
  const [secondsSpent, setSecondsSpent] = useState(0);
  const [loading, setLoading] = useState(true);

  // AI Policy Q&A state (Feature G)
  const [aiQuestion, setAiQuestion] = useState('');
  const [aiAnswer, setAiAnswer] = useState('');
  const [isAskingAi, setIsAskingAi] = useState(false);

  const secondsRef = useRef(0);
  const eventIdRef = useRef(`qe-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`);

  // Detect device type (PRD Section 14)
  const getDeviceType = () => {
    const ua = navigator.userAgent || '';
    if (/Mobi|Android/i.test(ua)) return 'mobile';
    if (/iPad|Tablet/i.test(ua)) return 'tablet';
    return 'desktop';
  };

  useEffect(() => {
    async function initViewer() {
      setLoading(true);
      const policies = await getAllFromStore('policies');
      const found = policies.find(p => p.trackable_link === trackId || p.id === trackId) || policies[0];
      setPolicy(found);

      const agents = await getAllFromStore('agents');
      setAgent(agents[0] || null);

      if (found) {
        // Record Initial View
        const deviceType = getDeviceType();
        const newEvent = {
          id: eventIdRef.current,
          policy_id: found.id,
          viewed_at: new Date().toISOString(),
          time_spent_sec: 1,
          device_type: deviceType,
          user_agent: navigator.userAgent
        };
        await putInStore('quote_view_events', newEvent, true);

        // Update policy view count
        const updatedPolicy = {
          ...found,
          link_views: (found.link_views || 0) + 1,
          quote_last_viewed_at: new Date().toISOString(),
          quote_device_type: deviceType
        };
        await putInStore('policies', updatedPolicy, true);
        setPolicy(updatedPolicy);
      }
      setLoading(false);
    }
    initViewer();

    // Timer to track seconds spent
    const timer = setInterval(() => {
      secondsRef.current += 1;
      setSecondsSpent(secondsRef.current);
    }, 1000);

    // Save view duration on unload or visibility change
    const saveDuration = async () => {
      if (!policy && !trackId) return;
      const finalSec = secondsRef.current;
      const existingEvt = await getAllFromStore('quote_view_events');
      const evt = existingEvt.find(e => e.id === eventIdRef.current);
      if (evt) {
        evt.time_spent_sec = finalSec;
        await putInStore('quote_view_events', evt, true);
      }
    };

    window.addEventListener('beforeunload', saveDuration);
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'hidden') saveDuration();
    });

    return () => {
      clearInterval(timer);
      window.removeEventListener('beforeunload', saveDuration);
      saveDuration();
    };
  }, [trackId]);

  const handleAskPolicyAI = async (e) => {
    e.preventDefault();
    if (!aiQuestion.trim() || !policy) return;

    setIsAskingAi(true);
    try {
      const sampleText = `${policy.policy_name}. Sum Assured: Rs. ${policy.sum_assured}. Annual Premium: Rs. ${policy.premium_amount}. Grace period: 30 days for yearly payment. Revival allowed within 5 years with 8% late fee. Maturity benefit: Sum Assured plus accrued Simple Reversionary Bonuses and Final Additional Bonus. Exclusions: Suicide in 1st year.`;
      const res = await analyzePolicyText(sampleText, aiQuestion);
      setAiAnswer(res);
    } catch (err) {
      setAiAnswer('Unable to generate answer at the moment.');
    } finally {
      setIsAskingAi(false);
    }
  };

  if (loading) {
    return (
      <div className="container py-5 text-center">
        <div className="spinner-border text-primary" role="status"></div>
        <p className="mt-2 text-muted small">Loading policy quotation...</p>
      </div>
    );
  }

  if (!policy) {
    return (
      <div className="container py-5 text-center">
        <h4>Quotation not found</h4>
        <p className="text-muted small">Please verify the link provided by your LIC advisor.</p>
      </div>
    );
  }

  return (
    <div className="container py-3 px-3" style={{ maxWidth: '540px' }}>
      {/* LIC Official Branding Header */}
      <div className="card shadow-sm border-0 mb-3 bg-primary text-white text-center p-3 rounded-4">
        <div className="fs-3 mb-1">🛡️</div>
        <h5 className="fw-bold mb-0">Life Insurance Corporation of India</h5>
        <div className="small opacity-75">Personalized Policy Proposal</div>
      </div>

      {/* Policy Details Card */}
      <div className="card shadow-sm border-0 mb-3 bg-white">
        <div className="card-body p-3">
          <div className="badge bg-success-subtle text-success border border-success mb-2">
            ✓ Official LIC Quotation
          </div>
          <h4 className="fw-bold text-dark mb-1">{policy.policy_name}</h4>
          <p className="text-muted small mb-3">
            Specially tailored for long-term family financial security & tax savings.
          </p>

          <div className="card bg-light border-0 p-3 mb-3">
            <div className="row g-3">
              <div className="col-6">
                <div className="small text-muted">Sum Assured Cover</div>
                <div className="fw-bold fs-5 text-primary">₹{(policy.sum_assured || 1500000).toLocaleString('en-IN')}</div>
              </div>
              <div className="col-6">
                <div className="small text-muted">Annual Premium</div>
                <div className="fw-bold fs-5 text-success">₹{(policy.premium_amount || 45000).toLocaleString('en-IN')}</div>
              </div>
              <div className="col-6">
                <div className="small text-muted">Policy Term</div>
                <div className="fw-semibold text-dark">21 Years</div>
              </div>
              <div className="col-6">
                <div className="small text-muted">Premium Frequency</div>
                <div className="fw-semibold text-dark text-capitalize">{policy.premium_frequency || 'Yearly'}</div>
              </div>
            </div>
          </div>

          {/* Key Benefits Highlights */}
          <h6 className="fw-bold small text-muted text-uppercase mb-2">Key Plan Highlights</h6>
          <ul className="list-unstyled small mb-3">
            <li className="mb-2 d-flex align-items-start">
              <span className="text-success me-2 fw-bold">✓</span>
              <span><strong>Guaranteed Life Cover:</strong> ₹{(policy.sum_assured || 1500000).toLocaleString('en-IN')} protection throughout policy term.</span>
            </li>
            <li className="mb-2 d-flex align-items-start">
              <span className="text-success me-2 fw-bold">✓</span>
              <span><strong>Tax Exemption:</strong> Premiums eligible under Section 80C, maturity tax-free under Section 10(10D).</span>
            </li>
            <li className="mb-2 d-flex align-items-start">
              <span className="text-success me-2 fw-bold">✓</span>
              <span><strong>Maturity Returns:</strong> Sum Assured + Simple Reversionary Bonus + Final Additional Bonus.</span>
            </li>
          </ul>

          {/* Advisor Card */}
          {agent && (
            <div className="border-top pt-3 mt-3">
              <div className="small text-muted mb-2 fw-bold text-uppercase">Your LIC Advisor</div>
              <div className="d-flex justify-content-between align-items-center bg-light p-2 rounded">
                <div>
                  <div className="fw-bold small text-dark">{agent.full_name}</div>
                  <div className="text-muted" style={{ fontSize: '0.72rem' }}>
                    Agency Code: {agent.license_number}
                  </div>
                </div>
                <div className="d-flex gap-2">
                  <a href={`tel:${agent.phone}`} className="btn btn-sm btn-primary rounded-circle p-2">
                    <i className="bi bi-telephone-fill"></i>
                  </a>
                  <a
                    href={`https://wa.me/${agent.phone?.replace(/\D/g, '')}?text=Hi%20${encodeURIComponent(agent.full_name)},%20I%20reviewed%20the%20${encodeURIComponent(policy.policy_name)}%20quote!`}
                    target="_blank"
                    rel="noreferrer"
                    className="btn btn-sm btn-success rounded-circle p-2"
                  >
                    <i className="bi bi-whatsapp"></i>
                  </a>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Feature G: Intelligent Policy AI Assistant (Document Q&A) */}
      <div className="card shadow-sm border-0 mb-3 bg-white">
        <div className="card-body p-3">
          <div className="d-flex justify-content-between align-items-center mb-2">
            <h6 className="fw-bold text-dark mb-0 d-flex align-items-center">
              <span className="me-2">✨</span> Ask AI About This Policy
            </h6>
            <span className="badge bg-primary-subtle text-primary" style={{ fontSize: '0.65rem' }}>AI Q&A</span>
          </div>
          <p className="text-muted small mb-2" style={{ fontSize: '0.75rem' }}>
            Ask questions like "What is the grace period?" or "How does loan facility work?"
          </p>

          <div className="d-flex flex-wrap gap-1 mb-2">
            {[
              'What is the grace period for renewal?',
              'Is suicide covered in 1st year?',
              'What are the 80C tax benefits?'
            ].map(q => (
              <button
                key={q}
                type="button"
                className="btn btn-sm btn-outline-secondary py-0 px-2 rounded-pill"
                style={{ fontSize: '0.72rem' }}
                onClick={() => setAiQuestion(q)}
              >
                {q}
              </button>
            ))}
          </div>

          <form onSubmit={handleAskPolicyAI}>
            <div className="input-group input-group-sm mb-2">
              <input
                type="text"
                className="form-control"
                placeholder="Ask any policy clause question..."
                value={aiQuestion}
                onChange={(e) => setAiQuestion(e.target.value)}
              />
              <button type="submit" className="btn btn-primary" disabled={isAskingAi || !aiQuestion.trim()}>
                {isAskingAi ? 'Thinking...' : 'Ask AI'}
              </button>
            </div>
          </form>

          {aiAnswer && (
            <div className="alert alert-info py-2 px-3 small mb-0 animate__animated animate__fadeIn">
              <div className="fw-bold text-primary mb-1">🤖 AI Advisor Response:</div>
              <div>{aiAnswer}</div>
            </div>
          )}
        </div>
      </div>

      <div className="text-center text-muted small py-2">
        <div style={{ fontSize: '0.7rem' }}>
          Viewing Session Active: {secondsSpent}s • Protected by Tele-Assist Pro
        </div>
      </div>
    </div>
  );
}
