import React, { useState, useEffect, useRef } from 'react';
import { supabase } from '../supabaseClient';
import { playNotificationSound } from '../utils/sound';
import { useGamification } from '../context/GamificationContext';
import { useAuth } from '../context/AuthContext';
import { Link } from 'react-router-dom';

export function RealTimeLeadToast() {
  const { agent } = useAuth();
  const { awardXP } = useGamification();
  const [activeLead, setActiveLead] = useState(null);
  const seenLeadIdsRef = useRef(new Set());
  const isInitialFetchRef = useRef(true);

  useEffect(() => {
    if (!agent?.id) return;

    // Check centralized server API for leads submitted from visiting cards across devices
    const checkServerLeads = async () => {
      try {
        const res = await fetch('/api/leads');
        if (!res.ok) return;
        const list = await res.json();
        if (!Array.isArray(list)) return;

        if (isInitialFetchRef.current) {
          list.forEach(l => {
            if (l?.id) seenLeadIdsRef.current.add(l.id);
          });
          isInitialFetchRef.current = false;
          return;
        }

        const freshLead = list.find(l => l && l.id && !seenLeadIdsRef.current.has(l.id) && l.status === 'new');
        if (freshLead) {
          seenLeadIdsRef.current.add(freshLead.id);
          setActiveLead(freshLead);
          playNotificationSound();
          if (typeof awardXP === 'function') {
            await awardXP('lead_captured', `Captured lead from ${freshLead.full_name || 'Visitor'}!`).catch(() => {});
          }
          setTimeout(() => {
            setActiveLead(null);
          }, 8000);
        }

        list.forEach(l => {
          if (l?.id) seenLeadIdsRef.current.add(l.id);
        });
      } catch (err) {
        // Fallback silently if offline
      }
    };

    checkServerLeads();
    const pollInterval = setInterval(checkServerLeads, 4000);

    // Supabase Realtime channel subscription
    const channel = supabase
      .channel('new-leads')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'leads',
          filter: `agent_id=eq.${agent.id}`
        },
        async (payload) => {
          const lead = payload.new;
          if (lead?.id && !seenLeadIdsRef.current.has(lead.id)) {
            seenLeadIdsRef.current.add(lead.id);
            setActiveLead(lead);
            playNotificationSound();
            await awardXP('lead_captured', `Captured lead from ${lead.full_name || 'Visitor'}!`).catch(() => {});

            // Auto-dismiss after 8 seconds
            setTimeout(() => {
              setActiveLead(null);
            }, 8000);
          }
        }
      )
      .subscribe();

    return () => {
      clearInterval(pollInterval);
      supabase.removeChannel(channel);
    };
  }, [agent?.id, awardXP]);

  if (!activeLead) return null;

  return (
    <div className="toast show position-fixed top-0 end-0 m-3 shadow-lg border-danger" style={{ zIndex: 1100, maxWidth: '340px' }} role="alert">
      <div className="toast-header bg-danger text-white d-flex justify-content-between">
        <strong className="me-auto d-flex align-items-center">
          <span className="spinner-grow spinner-grow-sm text-warning me-2" role="status"></span>
          🔴 New Lead Captured!
        </strong>
        <button
          type="button"
          className="btn-close btn-close-white"
          onClick={() => setActiveLead(null)}
        ></button>
      </div>
      <div className="toast-body bg-white text-dark">
        <div className="fw-bold fs-6">{activeLead.full_name}</div>
        <div className="small text-muted mb-1">
          <i className="bi bi-telephone-fill text-success me-1"></i>
          {activeLead.phone}
        </div>
        <div className="badge bg-primary-subtle text-primary border border-primary mb-2">
          Interested in: {activeLead.interest_area || 'LIC Policy'}
        </div>
        {activeLead.message && (
          <p className="small fst-italic mb-2 text-secondary bg-light p-2 rounded">
            "{activeLead.message}"
          </p>
        )}
        <div className="d-flex gap-2">
          <a
            href={`tel:${activeLead.phone}`}
            className="btn btn-sm btn-success flex-fill d-flex align-items-center justify-content-center"
          >
            <i className="bi bi-telephone-fill me-1"></i> Call Now
          </a>
          <button
            className="btn btn-sm btn-outline-secondary"
            onClick={() => setActiveLead(null)}
          >
            Dismiss
          </button>
        </div>
      </div>
    </div>
  );
}
