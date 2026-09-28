import { useState, useEffect, useCallback } from 'react';
import { getAllFromStore, putInStore, deleteFromStore } from '../utils/offlineDB';
import { useGamification } from '../context/GamificationContext';

export function useClients() {
  const [clients, setClients] = useState([]);
  const [loading, setLoading] = useState(true);
  const { awardXP } = useGamification();

  const fetchClients = useCallback(async (isSilent = false) => {
    if (!isSilent) {
      setLoading(true);
    }
    try {
      const data = await getAllFromStore('clients');
      setClients(data || []);
    } catch (err) {
      console.error('Failed to load clients:', err);
    } finally {
      if (!isSilent) {
        setLoading(false);
      }
    }
  }, []);

  useEffect(() => {
    fetchClients(false);

    const handleSync = (e) => {
      if (!e.detail || e.detail.store === 'clients' || e.type === 'app-sync-full') {
        fetchClients(true);
      }
    };

    window.addEventListener('app-sync-update', handleSync);
    window.addEventListener('app-sync-full', handleSync);

    return () => {
      window.removeEventListener('app-sync-update', handleSync);
      window.removeEventListener('app-sync-full', handleSync);
    };
  }, [fetchClients]);

  const addClient = async (clientData) => {
    const newClient = {
      id: clientData.id || `c-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
      status: 'active',
      kyc_status: 'pending',
      created_at: new Date().toISOString(),
      tags: [],
      ...clientData
    };
    await putInStore('clients', newClient);
    await awardXP('client_added', `Added new client: ${newClient.full_name}`);
    await fetchClients();
    return newClient;
  };

  const updateClient = async (id, updates) => {
    const existing = clients.find(c => c.id === id);
    if (!existing) return null;
    const updated = { ...existing, ...updates };
    await putInStore('clients', updated);
    await fetchClients();
    return updated;
  };

  const deleteClient = async (id) => {
    const existing = clients.find(c => c.id === id);
    await deleteFromStore('clients', id);
    if (existing) {
      try {
        const allLeads = await getAllFromStore('leads');
        const cleanClientPhone = String(existing?.phone || '').replace(/\D/g, '');
        for (const lead of allLeads) {
          const cleanLeadPhone = String(lead?.phone || '').replace(/\D/g, '');
          if (lead.converted_client_id === id || (cleanClientPhone && cleanLeadPhone && cleanClientPhone === cleanLeadPhone)) {
            await putInStore('leads', { ...lead, status: 'contacted', converted_client_id: null });
          }
        }
      } catch (e) {}
    }
    await fetchClients();
  };

  return {
    clients,
    loading,
    refreshClients: fetchClients,
    addClient,
    updateClient,
    deleteClient
  };
}
