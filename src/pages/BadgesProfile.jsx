import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { BadgeGrid } from '../components/BadgeGrid';
import { XPProgressBar } from '../components/XPProgressBar';
import { getAllFromStore } from '../utils/offlineDB';
import { calculateProgress, calculateLevel } from '../utils/xp';
import { Link } from 'react-router-dom';

export function BadgesProfile() {
  const { agent } = useAuth();
  const [xpLogs, setXpLogs] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadLogs() {
      setLoading(true);
      const logs = await getAllFromStore('agent_xp_log');
      // Sort newest first
      logs.sort((a, b) => new Date(b.earned_at) - new Date(a.earned_at));
      setXpLogs(logs);
      setLoading(false);
    }
    loadLogs();
  }, []);

  if (!agent) return null;

  const xp = agent.xp_points || 0;
  const progress = calculateProgress(xp);
  const currentLvl = calculateLevel(xp);

  return (
    <div className="container py-3 px-3">
      {/* Header */}
      <div className="d-flex justify-content-between align-items-center mb-3">
        <Link to="/dashboard" className="btn btn-sm btn-light border py-1 px-2 d-flex align-items-center">
          <i className="bi bi-arrow-left me-1"></i> Dashboard
        </Link>
        <span className="badge bg-warning text-dark">🏅 Agent Gamification Hub</span>
      </div>

      {/* Gamified Level & XP Progress Card */}
      <XPProgressBar />

      {/* Quick Stats Summary */}
      <div className="card shadow-sm border-0 mb-3 bg-white">
        <div className="card-body p-3">
          <div className="d-flex justify-content-around text-center">
            <div>
              <div className="fs-5 fw-bold text-warning">🔥 {agent.streak_days || 1}</div>
              <div className="small text-muted" style={{ fontSize: '0.72rem' }}>Day Streak</div>
            </div>
            <div className="border-start"></div>
            <div>
              <div className="fs-5 fw-bold text-primary">🏅 {agent.badges?.length || 0} / 10</div>
              <div className="small text-muted" style={{ fontSize: '0.72rem' }}>Badges Unlocked</div>
            </div>
            <div className="border-start"></div>
            <div>
              <div className="fs-5 fw-bold text-success">⚡ {xp}</div>
              <div className="small text-muted" style={{ fontSize: '0.72rem' }}>Total XP Earned</div>
            </div>
          </div>
        </div>
      </div>

      {/* Badges Collection Grid */}
      <div className="card shadow-sm border-0 mb-3 bg-white">
        <div className="card-header bg-white border-0 pt-3 pb-1 px-3">
          <h6 className="fw-bold mb-0 text-dark d-flex align-items-center">
            <i className="bi bi-award-fill text-warning me-2"></i>
            Agent Badges & Achievements
          </h6>
        </div>
        <div className="card-body p-3">
          <BadgeGrid earnedBadges={agent.badges || []} />
        </div>
      </div>

      {/* XP Log History */}
      <div className="card shadow-sm border-0 mb-3 bg-white">
        <div className="card-header bg-white border-0 pt-3 pb-1 px-3">
          <h6 className="fw-bold mb-0 text-dark d-flex align-items-center">
            <i className="bi bi-lightning-charge-fill text-primary me-2"></i>
            Recent XP Activity Log
          </h6>
        </div>
        <div className="card-body p-3">
          {xpLogs.length === 0 ? (
            <div className="text-center py-3 text-muted small">No XP logged yet. Complete tasks to earn points!</div>
          ) : (
            <ul className="list-group list-group-flush">
              {xpLogs.slice(0, 10).map(log => (
                <li key={log.id} className="list-group-item px-0 py-2 d-flex justify-content-between align-items-center">
                  <div>
                    <div className="small fw-semibold text-dark">{log.description || log.action}</div>
                    <div className="text-muted" style={{ fontSize: '0.68rem' }}>
                      {new Date(log.earned_at).toLocaleString('en-IN')}
                    </div>
                  </div>
                  <span className="badge bg-success-subtle text-success border border-success fw-bold">
                    +{log.xp_earned} XP
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}
