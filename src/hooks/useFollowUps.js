import { useState, useEffect, useCallback } from 'react';
import { getAllFromStore, putInStore, deleteFromStore } from '../utils/offlineDB';
import { useGamification } from '../context/GamificationContext';

export function useFollowUps() {
  const [followUps, setFollowUps] = useState([]);
  const [loading, setLoading] = useState(true);
  const { awardXP, completeDailyGoal } = useGamification();

  const fetchFollowUps = useCallback(async () => {
    setLoading(true);
    try {
      const data = await getAllFromStore('follow_ups');
      setFollowUps(data || []);
    } catch (err) {
      console.error('Failed to load follow-ups:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchFollowUps();
  }, [fetchFollowUps]);

  const todayStr = new Date().toISOString().split('T')[0];

  const todayPending = followUps.filter(f => f.due_date === todayStr && f.status === 'pending');
  const overduePending = followUps.filter(f => f.due_date < todayStr && f.status === 'pending');
  const completedToday = followUps.filter(f => f.status === 'done' && f.completed_at?.startsWith(todayStr));

  const addFollowUp = async (data) => {
    const newFollowUp = {
      id: data.id || `fu-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
      status: 'pending',
      created_at: new Date().toISOString(),
      ...data
    };
    await putInStore('follow_ups', newFollowUp);
    await fetchFollowUps();
    return newFollowUp;
  };

  const markDone = async (id) => {
    const item = followUps.find(f => f.id === id);
    if (!item) return;

    const updated = {
      ...item,
      status: 'done',
      completed_at: new Date().toISOString()
    };
    await putInStore('follow_ups', updated);

    // Award XP
    if (item.auto_created) {
      await awardXP('followup_done_ai', `Completed AI-scheduled follow-up: ${item.notes?.slice(0, 30)}...`);
    } else {
      await awardXP('followup_done', `Completed follow-up: ${item.notes?.slice(0, 30)}...`);
    }

    await fetchFollowUps();

    // Check if all today's followups are done
    const remainingToday = followUps.filter(f => f.id !== id && f.due_date === todayStr && f.status === 'pending');
    if (remainingToday.length === 0) {
      await completeDailyGoal();
    }
  };

  const reschedule = async (id, newDueDate) => {
    const item = followUps.find(f => f.id === id);
    if (!item) return;

    const updated = {
      ...item,
      due_date: newDueDate,
      status: 'pending'
    };
    await putInStore('follow_ups', updated);
    await fetchFollowUps();
  };

  return {
    followUps,
    todayPending,
    overduePending,
    completedToday,
    loading,
    refreshFollowUps: fetchFollowUps,
    addFollowUp,
    markDone,
    reschedule
  };
}
