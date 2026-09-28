import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { getAllFromStore } from '../utils/offlineDB';
import { generateColdLeadMessage } from '../utils/gemini';
import { useGamification } from '../context/GamificationContext';
import { WhatsAppTemplatePicker } from '../components/WhatsAppTemplatePicker';

export function ColdLeads() {
  const { awardXP } = useGamification();
  const [coldClients, setColdClients] = useState([]);
  const [loading, setLoading] = useState(true);
  const [generatedNotes, setGeneratedNotes] = useState({});
  const [loadingNotes, setLoadingNotes] = useState({});
  const [activeWhatsAppTarget, setActiveWhatsAppTarget] = useState(null);

  const loadColdLeads = async () => {
    setLoading(true);
    const clients = await getAllFromStore('clients');
    const sixtyDaysAgo = new Date(Date.now() - 60 * 86400000).toISOString();
    
    // Clients with status 'cold' or created > 60 days ago
    const filtered = clients.filter(c => c.status === 'cold' || c.created_at < sixtyDaysAgo);
    setColdClients(filtered);
    setLoading(false);
  };

  useEffect(() => {
    loadColdLeads();
  }, []);

  const handleGenerateAiMessage = async (client) => {
    setLoadingNotes(prev => ({ ...prev, [client.id]: true }));
    try {
      const msg = await generateColdLeadMessage(client.full_name, client.tags?.[0] || 'Endowment Plan');
      setGeneratedNotes(prev => ({ ...prev, [client.id]: msg }));
    } catch (e) {
      console.warn('AI message error:', e);
    } finally {
      setLoadingNotes(prev => ({ ...prev, [client.id]: false }));
    }
  };

  const handleOpenWhatsAppPicker = (client) => {
    const customText = generatedNotes[client.id];
    setActiveWhatsAppTarget({
      client,
      initialMessage: customText || '',
      template: 'cold_reactivation'
    });
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
      {/* Title */}
      <div className="d-flex justify-content-between align-items-center mb-3">
        <Link to="/dashboard" className="btn btn-sm btn-light border py-1 px-2 d-flex align-items-center">
          <i className="bi bi-arrow-left me-1"></i> Dashboard
        </Link>
        <span className="badge bg-danger text-white">🤝 Cold Lead Re-Activation</span>
      </div>

      <div className="card shadow-sm border-0 mb-3 bg-white">
        <div className="card-body p-3">
          <h5 className="fw-bold text-dark mb-1 d-flex align-items-center">
            <span className="me-2">❄️</span> Inactive & Cold Clients ({coldClients.length})
          </h5>
          <p className="text-muted small mb-3">
            Clients with zero touchpoints for over 60 days. Re-ignite conversations with AI-crafted, polite re-engagement messages.
          </p>

          {coldClients.length === 0 ? (
            <div className="text-center py-4 text-muted small">
              <i className="bi bi-emoji-smile fs-2 text-success mb-2"></i>
              <h6>No cold leads found!</h6>
              <div>All your clients have been contacted recently. Great job maintaining relationship cadence!</div>
            </div>
          ) : (
            coldClients.map(c => {
              const aiText = generatedNotes[c.id];
              const isGenLoading = loadingNotes[c.id];

              return (
                <div key={c.id} className="card bg-light border p-3 mb-3">
                  <div className="d-flex justify-content-between align-items-start mb-2">
                    <div>
                      <h6 className="fw-bold mb-0 text-dark">{c.full_name}</h6>
                      <div className="text-muted" style={{ fontSize: '0.72rem' }}>
                        Phone: {c.phone} • Last Contact: {new Date(c.created_at).toLocaleDateString('en-IN')}
                      </div>
                    </div>
                    <span className="badge bg-secondary" style={{ fontSize: '0.65rem' }}>
                      {c.tags?.[0] || 'Cold Lead'}
                    </span>
                  </div>

                  {/* AI Suggestion Box */}
                  <div className="mb-2">
                    {aiText ? (
                      <div className="bg-white p-2 rounded border small text-dark mb-2 font-monospace" style={{ fontSize: '0.75rem' }}>
                        <div className="fw-bold text-primary mb-1 d-flex align-items-center">
                          <span className="me-1">✨</span> Suggested WhatsApp Note:
                        </div>
                        {aiText}
                      </div>
                    ) : (
                      <button
                        type="button"
                        className="btn btn-sm btn-outline-info w-100 py-1 mb-2 d-flex align-items-center justify-content-center"
                        style={{ fontSize: '0.75rem' }}
                        disabled={isGenLoading}
                        onClick={() => handleGenerateAiMessage(c)}
                      >
                        {isGenLoading ? (
                          <>
                            <span className="spinner-border spinner-border-sm me-1" role="status"></span>
                            Generating Suggestion...
                          </>
                        ) : (
                          <>
                            <span className="me-1">✨</span> Generate AI Re-Engagement Message
                          </>
                        )}
                      </button>
                    )}
                  </div>

                  {/* Send Button */}
                  <div className="d-flex gap-2">
                    <button
                      type="button"
                      className="btn btn-sm btn-success flex-fill fw-bold py-1 d-flex align-items-center justify-content-center"
                      style={{ fontSize: '0.78rem' }}
                      onClick={() => handleOpenWhatsAppPicker(c)}
                    >
                      <i className="bi bi-whatsapp me-1"></i> Send via WhatsApp (+20 XP)
                    </button>
                    <Link
                      to={`/client/${c.id}`}
                      className="btn btn-sm btn-outline-secondary py-1"
                      style={{ fontSize: '0.75rem' }}
                    >
                      View Profile
                    </Link>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* WhatsApp Modal */}
      {activeWhatsAppTarget && (
        <div
          className="modal show d-block"
          tabIndex="-1"
          style={{ backgroundColor: 'rgba(0,0,0,0.6)', zIndex: 1060 }}
          onClick={(e) => { if (e.target === e.currentTarget) setActiveWhatsAppTarget(null); }}
        >
          <div className="modal-dialog modal-dialog-centered">
            <WhatsAppTemplatePicker
              client={activeWhatsAppTarget.client}
              defaultTemplate={activeWhatsAppTarget.template || 'cold_reactivation'}
              initialMessage={activeWhatsAppTarget.initialMessage}
              onClose={() => {
                setActiveWhatsAppTarget(null);
                loadColdLeads();
              }}
            />
          </div>
        </div>
      )}
    </div>
  );
}
