import { describe, it, expect } from 'vitest';
import { calculateLevel, getNextLevel, calculateProgress, XP_TABLE, BADGE_DEFINITIONS } from '../src/utils/xp';
import { calculateDailyStreak } from '../src/utils/streak';

describe('Gamification & Streak Unit Tests', () => {
  it('correctly maps XP to Levels', () => {
    expect(calculateLevel(0).level).toBe(1);
    expect(calculateLevel(0).name).toBe('Rookie Agent');

    expect(calculateLevel(150).level).toBe(2);
    expect(calculateLevel(150).name).toBe('Active Advisor');

    expect(calculateLevel(640).level).toBe(3);
    expect(calculateLevel(640).name).toBe('Rising Star');

    expect(calculateLevel(800).level).toBe(4);
    expect(calculateLevel(800).name).toBe('Policy Expert');

    expect(calculateLevel(6000).level).toBe(8);
    expect(calculateLevel(6000).name).toBe('Elite Agent');
  });

  it('calculates progress percentage and needed XP accurately', () => {
    // Level 3 is 400 to 800 XP. 640 is (640-400)/(800-400) = 240/400 = 60%
    const p = calculateProgress(640);
    expect(p.percentage).toBe(60);
    expect(p.neededXP).toBe(160);
    expect(p.currentLevelName).toBe('Rising Star');
    expect(p.nextLevelName).toBe('Policy Expert');
  });

  it('verifies XP table values match PRD Section 15', () => {
    expect(XP_TABLE.call_logged).toBe(15);
    expect(XP_TABLE.call_with_ai_summary).toBe(20);
    expect(XP_TABLE.followup_done).toBe(20);
    expect(XP_TABLE.followup_done_ai).toBe(25);
    expect(XP_TABLE.kyc_uploaded).toBe(10);
    expect(XP_TABLE.kyc_verified).toBe(15);
    expect(XP_TABLE.client_added).toBe(10);
    expect(XP_TABLE.bulk_import).toBe(30);
    expect(XP_TABLE.lead_captured).toBe(20);
    expect(XP_TABLE.daily_goal).toBe(50);
  });

  it('verifies all 10 badges are defined', () => {
    expect(BADGE_DEFINITIONS.length).toBe(10);
    const badgeIds = BADGE_DEFINITIONS.map(b => b.id);
    expect(badgeIds).toContain('first_call');
    expect(badgeIds).toContain('note_taker');
    expect(badgeIds).toContain('followup_ninja');
    expect(badgeIds).toContain('kyc_master');
    expect(badgeIds).toContain('lead_magnet');
    expect(badgeIds).toContain('on_fire');
    expect(badgeIds).toContain('policy_pro');
    expect(badgeIds).toContain('family_first');
    expect(badgeIds).toContain('ai_ally');
    expect(badgeIds).toContain('level_up_x3');
  });

  it('calculates daily streaks correctly', () => {
    const today = new Date().toISOString().split('T')[0];
    const yesterday = new Date(Date.now() - 86400000).toISOString().split('T')[0];
    const twoDaysAgo = new Date(Date.now() - 2 * 86400000).toISOString().split('T')[0];

    // Continuing streak
    const res1 = calculateDailyStreak(yesterday, 5);
    expect(res1.streak).toBe(6);
    expect(res1.streakEarnedXP).toBe(true);

    // Already logged in today
    const res2 = calculateDailyStreak(today, 6);
    expect(res2.streak).toBe(6);
    expect(res2.streakEarnedXP).toBe(false);

    // Streak broken (missed day)
    const res3 = calculateDailyStreak(twoDaysAgo, 10);
    expect(res3.streak).toBe(1);
    expect(res3.streakEarnedXP).toBe(true);
  });
});
