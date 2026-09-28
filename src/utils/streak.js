// Streak calculation helper

export function calculateDailyStreak(lastActiveDate, currentStreak = 0) {
  const today = new Date().toISOString().split('T')[0];
  if (!lastActiveDate) {
    return { streak: 1, lastActiveDate: today, streakEarnedXP: true };
  }

  const lastDate = new Date(lastActiveDate);
  const now = new Date(today);
  const diffDays = Math.round((now - lastDate) / (1000 * 60 * 60 * 24));

  if (diffDays === 0) {
    // Already logged in today
    return { streak: currentStreak, lastActiveDate: today, streakEarnedXP: false };
  } else if (diffDays === 1) {
    // Yesterday -> continuous streak
    return { streak: currentStreak + 1, lastActiveDate: today, streakEarnedXP: true };
  } else {
    // Missed a day -> reset to 1
    return { streak: 1, lastActiveDate: today, streakEarnedXP: true };
  }
}
