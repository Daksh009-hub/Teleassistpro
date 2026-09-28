import React, { createContext, useContext, useState } from 'react';
import { useAuth } from './AuthContext';
import { XP_TABLE, calculateLevel, BADGE_DEFINITIONS } from '../utils/xp';
import { putInStore } from '../utils/offlineDB';
import { safeGetItem, safeSetItem } from '../utils/storage';
import { playSuccessChime } from '../utils/sound';
import confetti from 'canvas-confetti';

export const GamificationContext = createContext();

export function GamificationProvider({ children }) {
  const { agent, updateAgentProfile } = useAuth();
  const [xpToasts, setXpToasts] = useState([]);
  const [unlockedBadgeToast, setUnlockedBadgeToast] = useState(null);

  const triggerConfetti = () => {
    try {
      if (typeof confetti === 'function') {
        confetti({
          particleCount: 120,
          spread: 80,
          origin: { y: 0.6 },
          colors: ['#0d6efd', '#198754', '#ffc107', '#dc3545']
        });
      }
    } catch (e) {
      console.warn('Confetti error:', e);
    }
  };

  const addXPToast = (amount, description, leveledUp = false, newLevelName = '') => {
    const toastId = Date.now() + Math.random();
    const newToast = { id: toastId, amount, description, leveledUp, newLevelName };
    setXpToasts(prev => [...prev, newToast]);

    setTimeout(() => {
      setXpToasts(prev => prev.filter(t => t.id !== toastId));
    }, 4500);
  };

  const awardXP = async (action, description = '') => {
    if (!agent) return 0;

    const earned = XP_TABLE[action] || 15;
    const currentXP = agent.xp_points || 0;
    const newTotalXP = currentXP + earned;
    const oldLevelObj = calculateLevel(currentXP);
    const newLevelObj = calculateLevel(newTotalXP);
    const leveledUp = newLevelObj.level > oldLevelObj.level;

    // Check potential badge unlocks
    const currentBadges = new Set(agent.badges || []);
    let newlyUnlocked = null;

    if (action === 'call_logged' && !currentBadges.has('first_call')) {
      newlyUnlocked = 'first_call';
    } else if (action === 'call_with_ai_summary' && !currentBadges.has('note_taker')) {
      newlyUnlocked = 'note_taker';
    } else if (action === 'kyc_verified' && !currentBadges.has('kyc_master')) {
      newlyUnlocked = 'kyc_master';
    } else if (action === 'lead_captured' && !currentBadges.has('lead_magnet')) {
      newlyUnlocked = 'lead_magnet';
    } else if (newLevelObj.level >= 4 && !currentBadges.has('level_up_x3')) {
      newlyUnlocked = 'level_up_x3';
    }

    if (newlyUnlocked) {
      currentBadges.add(newlyUnlocked);
      const badgeInfo = BADGE_DEFINITIONS.find(b => b.id === newlyUnlocked);
      setUnlockedBadgeToast(badgeInfo);
      setTimeout(() => setUnlockedBadgeToast(null), 6000);
    }

    const updatedAgent = {
      ...agent,
      xp_points: newTotalXP,
      level: newLevelObj.level,
      badges: Array.from(currentBadges)
    };

    await updateAgentProfile(updatedAgent);

    // Save XP log
    await putInStore('agent_xp_log', {
      id: `xp-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
      agent_id: agent.id,
      action,
      xp_earned: earned,
      description: description || `Action: ${action}`,
      earned_at: new Date().toISOString()
    }, false);

    addXPToast(earned, description || action, leveledUp, newLevelObj.name);

    if (leveledUp) {
      playSuccessChime();
      triggerConfetti();
    }

    return earned;
  };

  const completeDailyGoal = async () => {
    const todayStr = new Date().toISOString().split('T')[0];
    const goalKey = `daily_goal_completed_${todayStr}`;
    if (safeGetItem(goalKey)) return;

    safeSetItem(goalKey, 'true');
    await awardXP('daily_goal', 'Completed all of today\'s follow-ups!');
    triggerConfetti();
    playSuccessChime();
  };

  return (
    <GamificationContext.Provider
      value={{
        awardXP,
        completeDailyGoal,
        triggerConfetti,
        xpToasts,
        unlockedBadgeToast
      }}
    >
      {children}
    </GamificationContext.Provider>
  );
}

export function useGamification() {
  return useContext(GamificationContext);
}
