// Gamified Agent XP Engine

export const LEVEL_THRESHOLDS = [
  { level: 1, name: 'Rookie Agent', minXP: 0 },
  { level: 2, name: 'Active Advisor', minXP: 150 },
  { level: 3, name: 'Rising Star', minXP: 400 },
  { level: 4, name: 'Policy Expert', minXP: 800 },
  { level: 5, name: 'Field Champion', minXP: 1500 },
  { level: 6, name: 'Senior Leader', minXP: 2500 },
  { level: 7, name: 'LIC Pro', minXP: 4000 },
  { level: 8, name: 'Elite Agent', minXP: 6000 }
];

export const XP_TABLE = {
  call_logged: 15,
  call_with_ai_summary: 20,
  followup_done: 20,
  followup_done_ai: 25,
  kyc_uploaded: 10,
  kyc_verified: 15,
  client_added: 10,
  bulk_import: 30,
  tax_pdf_generated: 10,
  quote_viewed_by_client: 10,
  lead_captured: 20,
  daily_goal: 50,
  login_streak: 5,
  first_action: 25
};

export const BADGE_DEFINITIONS = [
  { id: 'first_call', name: 'First Call', icon: '🏆', description: 'First call logged with client notes' },
  { id: 'note_taker', name: 'Note Taker', icon: '📋', description: '10 calls with AI summaries generated' },
  { id: 'followup_ninja', name: 'Follow-up Ninja', icon: '⚡', description: '7 consecutive days of zero missed follow-ups' },
  { id: 'kyc_master', name: 'KYC Master', icon: '🔍', description: '20 KYC documents processed and verified' },
  { id: 'lead_magnet', name: 'Lead Magnet', icon: '🌟', description: '10 leads captured via digital visiting card' },
  { id: 'on_fire', name: 'On Fire', icon: '🔥', description: '7-day active login streak' },
  { id: 'policy_pro', name: 'Policy Pro', icon: '💼', description: '50 active policies tracked' },
  { id: 'family_first', name: 'Family First', icon: '👨‍👩‍👧', description: '10 family passbooks linked' },
  { id: 'ai_ally', name: 'AI Ally', icon: '🧠', description: '25 AI summaries or NLP follow-ups generated' },
  { id: 'level_up_x3', name: 'Level Up x3', icon: '🚀', description: 'Reached Level 4 Policy Expert' }
];

export function calculateLevel(xp) {
  let current = LEVEL_THRESHOLDS[0];
  for (let i = LEVEL_THRESHOLDS.length - 1; i >= 0; i--) {
    if (xp >= LEVEL_THRESHOLDS[i].minXP) {
      current = LEVEL_THRESHOLDS[i];
      break;
    }
  }
  return current;
}

export function getNextLevel(xp) {
  for (let i = 0; i < LEVEL_THRESHOLDS.length; i++) {
    if (xp < LEVEL_THRESHOLDS[i].minXP) {
      return LEVEL_THRESHOLDS[i];
    }
  }
  return null; // Max level
}

export function calculateProgress(xp) {
  const currentLevel = calculateLevel(xp);
  const nextLevel = getNextLevel(xp);
  if (!nextLevel) return { percentage: 100, currentXP: xp, neededXP: 0, nextLevelName: 'Max Level' };

  const currentLevelMin = currentLevel.minXP;
  const nextLevelMin = nextLevel.minXP;
  const range = nextLevelMin - currentLevelMin;
  const currentWithinRange = xp - currentLevelMin;
  const percentage = Math.min(100, Math.max(0, Math.round((currentWithinRange / range) * 100)));
  const neededXP = nextLevelMin - xp;

  return {
    percentage,
    currentXP: xp,
    neededXP,
    currentLevelName: currentLevel.name,
    nextLevelName: nextLevel.name,
    targetXP: nextLevelMin
  };
}
