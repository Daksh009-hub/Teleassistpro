import React from 'react';
import { useAuth } from '../context/AuthContext';
import { calculateProgress, calculateLevel } from '../utils/xp';
import { useGamification } from '../context/GamificationContext';

export function XPToastContainer() {
  const { xpToasts, unlockedBadgeToast } = useGamification();

  return (
    <div className="toast-float-container">
      {xpToasts.map(toast => (
        <div
          key={toast.id}
          className="card shadow-sm border-0 bg-success text-white py-2 px-3 animate__animated animate__fadeInDown d-flex flex-row align-items-center justify-content-between"
          style={{ borderRadius: '10px' }}
        >
          <div className="d-flex align-items-center">
            <span className="fs-5 me-2">⚡</span>
            <div>
              <div className="fw-bold small">+{toast.amount} XP Earned!</div>
              <div style={{ fontSize: '0.7rem', opacity: 0.9 }}>{toast.description}</div>
            </div>
          </div>
          {toast.leveledUp && (
            <span className="badge bg-warning text-dark ms-2 animate__animated animate__tada">
              Level Up: {toast.newLevelName}!
            </span>
          )}
        </div>
      ))}

      {unlockedBadgeToast && (
        <div
          className="card shadow border-warning bg-warning-subtle text-dark py-2 px-3 animate__animated animate__bounceIn"
          style={{ borderRadius: '10px' }}
        >
          <div className="d-flex align-items-center">
            <span className="fs-3 me-2">{unlockedBadgeToast.icon}</span>
            <div>
              <div className="fw-bold small text-primary">🏅 New Badge Unlocked!</div>
              <div className="fw-semibold small">{unlockedBadgeToast.name}</div>
              <div style={{ fontSize: '0.7rem' }} className="text-muted">{unlockedBadgeToast.description}</div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export function XPProgressBar() {
  const { agent } = useAuth();

  if (!agent) return null;

  const xp = agent.xp_points || 0;
  const progress = calculateProgress(xp);
  const currentLvl = calculateLevel(xp);

  return (
    <div className="mb-3 position-relative">
      {/* Gamified Card */}
      <div className="xp-progress-card">
        <div className="d-flex justify-content-between align-items-center mb-1">
          <div className="d-flex align-items-center gap-2">
            <span className="fs-5">🎖️</span>
            <div>
              <div className="fw-bold fs-6">Level {currentLvl.level} — {currentLvl.name}</div>
              <div className="small opacity-75" style={{ fontSize: '0.75rem' }}>
                {progress.neededXP > 0
                  ? `${progress.neededXP} XP to Level ${currentLvl.level + 1} (${progress.nextLevelName})`
                  : 'Maximum Level Reached!'}
              </div>
            </div>
          </div>
          <div className="text-end">
            <span className="badge bg-warning text-dark fw-bold px-2 py-1">
              🔥 {agent.streak_days || 1} Day Streak
            </span>
          </div>
        </div>

        {/* Bar */}
        <div className="xp-progress-bar mt-2">
          <div
            className="xp-progress-fill"
            style={{ width: `${progress.percentage}%` }}
          ></div>
        </div>

        <div className="d-flex justify-content-between small opacity-75 mt-1" style={{ fontSize: '0.7rem' }}>
          <span>{xp} XP</span>
          <span>{progress.percentage}%</span>
          <span>{progress.targetXP} XP</span>
        </div>
      </div>
    </div>
  );
}
