import React, { createContext, useContext, useState, useEffect } from 'react';
import { supabase } from '../supabaseClient';
import { calculateDailyStreak } from '../utils/streak';
import { initializeIndexedDB, getAllFromStore, putInStore } from '../utils/offlineDB';
import { safeRemoveItem } from '../utils/storage';
import { INITIAL_AGENT } from '../utils/mockData';

export const AuthContext = createContext();

export function AuthProvider({ children }) {
  const [agent, setAgent] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function initAuth() {
      await initializeIndexedDB();
      
      const { data } = await supabase.auth.getSession();
      if (data?.session && data.session.user?.email === 'rajesh.lic@gmail.com') {
        // Load agent profile
        const agents = await getAllFromStore('agents');
        let currentAgent = agents[0] || INITIAL_AGENT;

        // Process daily streak
        const streakResult = calculateDailyStreak(currentAgent.last_active_date, currentAgent.streak_days);
        if (streakResult.streakEarnedXP || currentAgent.last_active_date !== streakResult.lastActiveDate) {
          currentAgent = {
            ...currentAgent,
            streak_days: streakResult.streak,
            last_active_date: streakResult.lastActiveDate,
            xp_points: currentAgent.xp_points + (streakResult.streakEarnedXP ? 5 : 0)
          };
          await putInStore('agents', currentAgent, false);
        }

        setAgent(currentAgent);
      } else {
        // Strictly require login: do not auto-authenticate if no valid session
        setAgent(null);
      }
      setLoading(false);
    }

    initAuth();
  }, []);

  const login = async (email, password) => {
    const cleanEmail = String(email || '').trim().toLowerCase();
    if (cleanEmail !== 'rajesh.lic@gmail.com' || password !== 'lic123456') {
      return { success: false, error: 'Invalid email or password. Only authorized agent can access this dashboard.' };
    }

    setLoading(true);
    try {
      const { data, error } = await supabase.auth.signInWithPassword({ email: cleanEmail, password });
      if (error) throw error;
      const agents = await getAllFromStore('agents');
      const cur = agents[0] || INITIAL_AGENT;
      setAgent(cur);
      return { success: true };
    } catch (err) {
      return { success: false, error: err.message };
    } finally {
      setLoading(false);
    }
  };

  const logout = async () => {
    await supabase.auth.signOut();
    safeRemoveItem('mock_auth_session');
    setAgent(null);
  };

  const updateAgentProfile = async (updates) => {
    if (!agent) return;
    const updated = { ...agent, ...updates };
    await putInStore('agents', updated);
    setAgent(updated);
  };

  return (
    <AuthContext.Provider value={{ agent, loading, login, logout, updateAgentProfile }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
