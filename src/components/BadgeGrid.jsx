import React from 'react';
import { BADGE_DEFINITIONS } from '../utils/xp';

export function BadgeGrid({ earnedBadges = [] }) {
  const earnedSet = new Set(earnedBadges || []);

  return (
    <div className="row g-2">
      {BADGE_DEFINITIONS.map(badge => {
        const isUnlocked = earnedSet.has(badge.id);
        return (
          <div key={badge.id} className="col-6 col-sm-4">
            <div className={`badge-card h-100 ${isUnlocked ? 'unlocked' : 'locked'}`}>
              <div className="fs-1 mb-1">{badge.icon}</div>
              <div className="fw-bold small text-truncate" title={badge.name}>
                {badge.name}
              </div>
              <div className="text-muted" style={{ fontSize: '0.68rem', minHeight: '2.4em' }}>
                {badge.description}
              </div>
              <div className="mt-2">
                {isUnlocked ? (
                  <span className="badge bg-success-subtle text-success border border-success" style={{ fontSize: '0.65rem' }}>
                    <i className="bi bi-check-circle-fill me-1"></i> Unlocked
                  </span>
                ) : (
                  <span className="badge bg-secondary-subtle text-secondary" style={{ fontSize: '0.65rem' }}>
                    <i className="bi bi-lock-fill me-1"></i> Locked
                  </span>
                )}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
