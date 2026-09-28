import React, { useState, useEffect } from 'react';
import { useSpeechToText } from '../hooks/useSpeechToText';
import { summarizeCallNotes, extractFollowUpIntent } from '../utils/gemini';
import { useGamification } from '../context/GamificationContext';
import { putInStore } from '../utils/offlineDB';
import { WhatsAppTemplatePicker } from './WhatsAppTemplatePicker';

export function CallWrapUpModal({ client, callStartTime, onClose, onSaveSuccess }) {
  const { isListening, transcript, isSupported, startListening, stopListening } = useSpeechToText();
  const { awardXP } = useGamification();

  const [notes, setNotes] = useState('');
  const [outcome, setOutcome] = useState('Interested');
  const [followUpDate, setFollowUpDate] = useState('');
  const [followUpAction, setFollowUpAction] = useState('Follow-up callback');
  const [aiSummary, setAiSummary] = useState('');
  const [isSummarizing, setIsSummarizing] = useState(false);
  const [showWhatsApp, setShowWhatsApp] = useState(false);
  const [callDurationSec, setCallDurationSec] = useState(0);

  useEffect(() => {
    if (callStartTime) {
      const duration = Math.max(15, Math.round((Date.now() - callStartTime) / 1000));
      setCallDurationSec(duration);
    } else {
      setCallDurationSec(45);
    }
  }, [callStartTime]);

  // Sync speech-to-text transcript into notes
  useEffect(() => {
    if (transcript) {
      setNotes(transcript);
      // Auto-extract follow-up date intent in background
      extractFollowUpIntent(transcript).then(intent => {
        if (intent.needs_followup && intent.date) {
          setFollowUpDate(intent.date);
          if (intent.action) setFollowUpAction(intent.action);
        }
      });
    }
  }, [transcript]);

  const handleGenerateSummary = async () => {
    if (!notes.trim()) return;
    setIsSummarizing(true);
    try {
      const summary = await summarizeCallNotes(notes, client.full_name);
      setAiSummary(summary);
      // Also check NLP follow-up date
      const intent = await extractFollowUpIntent(notes);
      if (intent.needs_followup && intent.date) {
        setFollowUpDate(intent.date);
        if (intent.action) setFollowUpAction(intent.action);
      }
    } catch (e) {
      console.warn('Summary error:', e);
    } finally {
      setIsSummarizing(false);
    }
  };

  const handleSave = async () => {
    const activityId = `act-${Date.now()}`;
    const activityRecord = {
      id: activityId,
      agent_id: client.agent_id || '00000000-0000-0000-0000-000000000001',
      client_id: client.id,
      activity_type: 'call',
      title: `Call: ${outcome} (${Math.round(callDurationSec / 60)}m ${callDurationSec % 60}s)`,
      description: notes || `Call completed with outcome: ${outcome}`,
      ai_summary: aiSummary || null,
      raw_transcript: transcript || null,
      completed_at: new Date().toISOString(),
      status: 'done'
    };

    await putInStore('activities', activityRecord);

    let createdFollowUp = null;
    if (followUpDate) {
      createdFollowUp = {
        id: `fu-${Date.now()}`,
        agent_id: client.agent_id || '00000000-0000-0000-0000-000000000001',
        client_id: client.id,
        activity_id: activityId,
        due_date: followUpDate,
        action_type: outcome === 'Document Requested' ? 'document_collection' : 'callback',
        notes: `${followUpAction}: ${notes.slice(0, 80)}`,
        status: 'pending',
        auto_created: Boolean(aiSummary)
      };
      await putInStore('follow_ups', createdFollowUp);
    }

    // Award XP
    if (aiSummary) {
      await awardXP('call_with_ai_summary', `Logged call with AI Summary for ${client.full_name}`);
    } else {
      await awardXP('call_logged', `Logged call for ${client.full_name}`);
    }

    if (onSaveSuccess) onSaveSuccess({ activity: activityRecord, followUp: createdFollowUp });
    onClose();
  };

  const handleSimulateVoice = () => {
    const sample = `Spoke with ${client.full_name}. Client is very interested in Jeevan Labh plan with 15 Lakh cover. Requested proposal document and asked to call back on Friday morning.`;
    setNotes(sample);
    extractFollowUpIntent(sample).then(intent => {
      if (intent.needs_followup && intent.date) {
        setFollowUpDate(intent.date);
        if (intent.action) setFollowUpAction(intent.action);
      }
    });
  };

  return (
    <div
      className="modal show d-block"
      tabIndex="-1"
      style={{ backgroundColor: 'rgba(0,0,0,0.6)', zIndex: 1060 }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="modal-dialog modal-dialog-centered modal-dialog-scrollable">
        <div className="modal-content border-0 shadow-lg">
          <div className="modal-header bg-primary text-white">
            <h5 className="modal-title fs-6 fw-bold d-flex align-items-center">
              <i className="bi bi-telephone-outbound-fill me-2"></i>
              Call Wrap-Up — {client.full_name}
            </h5>
            <button type="button" className="btn-close btn-close-white" onClick={onClose}></button>
          </div>

          <div className="modal-body">
            {/* Duration Indicator */}
            <div className="d-flex justify-content-between align-items-center mb-3 bg-light p-2 rounded">
              <span className="small text-muted">Estimated Call Duration:</span>
              <span className="badge bg-secondary fw-semibold">
                {Math.floor(callDurationSec / 60)}m {callDurationSec % 60}s
              </span>
            </div>

            {/* Outcome Selection */}
            <div className="mb-3">
              <label className="form-label small fw-bold text-muted">CALL OUTCOME</label>
              <div className="btn-group w-100" role="group">
                {['Interested', 'Callback', 'Doc Request', 'Not Interested'].map(opt => (
                  <button
                    key={opt}
                    type="button"
                    className={`btn btn-sm ${outcome === opt ? 'btn-primary' : 'btn-outline-secondary'}`}
                    onClick={() => setOutcome(opt)}
                  >
                    {opt}
                  </button>
                ))}
              </div>
            </div>

            {/* Notes & Speech to text */}
            <div className="mb-3">
              <div className="d-flex justify-content-between align-items-center mb-1">
                <label className="form-label small fw-bold text-muted mb-0">CALL NOTES</label>
                <div className="d-flex gap-1">
                  {isSupported ? (
                    <button
                      type="button"
                      className={`btn btn-sm ${isListening ? 'btn-danger animate__animated animate__pulse animate__infinite' : 'btn-outline-primary'} py-0 px-2`}
                      style={{ fontSize: '0.75rem' }}
                      onClick={isListening ? stopListening : startListening}
                    >
                      <i className={`bi ${isListening ? 'bi-mic-fill' : 'bi-mic'} me-1`}></i>
                      {isListening ? 'Listening...' : 'Voice Note'}
                    </button>
                  ) : null}
                  <button
                    type="button"
                    className="btn btn-sm btn-outline-secondary py-0 px-2"
                    style={{ fontSize: '0.72rem' }}
                    onClick={handleSimulateVoice}
                    title="Insert sample voice transcript"
                  >
                    ⚡ Sample Note
                  </button>
                </div>
              </div>
              <textarea
                className="form-control form-control-sm"
                rows="3"
                placeholder="e.g. Discussed Jeevan Labh. Wants to start with 15L sum assured. Call back on Friday."
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
              ></textarea>
            </div>

            {/* AI Summary Button */}
            <div className="mb-3">
              <button
                type="button"
                className="btn btn-sm btn-outline-info w-100 d-flex align-items-center justify-content-center"
                onClick={handleGenerateSummary}
                disabled={isSummarizing || !notes.trim()}
              >
                {isSummarizing ? (
                  <>
                    <span className="spinner-border spinner-border-sm me-2" role="status"></span>
                    Generating AI Summary...
                  </>
                ) : (
                  <>
                    <span className="me-2">✨</span> Generate AI Call Summary (+5 XP Bonus)
                  </>
                )}
              </button>

              {aiSummary && (
                <div className="alert alert-primary p-2 mt-2 small mb-0 border-info">
                  <div className="fw-bold d-flex align-items-center text-primary mb-1">
                    <span className="me-1">✨</span> AI Summary
                  </div>
                  {aiSummary}
                </div>
              )}
            </div>

            {/* Follow-up Scheduler */}
            <div className="card bg-light border-0 p-2 mb-3">
              <label className="form-label small fw-bold text-muted mb-1">SCHEDULE NEXT FOLLOW-UP</label>
              <div className="row g-2">
                <div className="col-6">
                  <input
                    type="date"
                    className="form-control form-control-sm"
                    value={followUpDate}
                    onChange={(e) => setFollowUpDate(e.target.value)}
                  />
                </div>
                <div className="col-6">
                  <input
                    type="text"
                    className="form-control form-control-sm"
                    placeholder="Action description"
                    value={followUpAction}
                    onChange={(e) => setFollowUpAction(e.target.value)}
                  />
                </div>
              </div>
            </div>

            {/* WhatsApp Follow-up Section */}
            {showWhatsApp ? (
              <WhatsAppTemplatePicker
                client={client}
                defaultTemplate={outcome === 'Doc Request' ? 'document_request' : 'quote_followup'}
                onClose={() => setShowWhatsApp(false)}
              />
            ) : (
              <button
                type="button"
                className="btn btn-sm btn-outline-success w-100 d-flex align-items-center justify-content-center mb-2"
                onClick={() => setShowWhatsApp(true)}
              >
                <i className="bi bi-whatsapp me-2"></i>
                Send WhatsApp Follow-up Message
              </button>
            )}
          </div>

          <div className="modal-footer bg-light p-2 d-flex justify-content-between">
            <button type="button" className="btn btn-sm btn-secondary" onClick={onClose}>
              Cancel
            </button>
            <button type="button" className="btn btn-sm btn-primary px-4 fw-bold" onClick={handleSave}>
              Save Call & Earn +15 XP
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
