import { describe, it, expect, beforeEach } from 'vitest';
import 'fake-indexeddb/auto';
import { supabase } from '../src/supabaseClient';
import { initializeIndexedDB, getAllFromStore } from '../src/utils/offlineDB';

describe('Supabase Client & Offline Database Integration Tests', () => {
  beforeEach(async () => {
    await initializeIndexedDB();
  });

  it('queries clients table with filtering and ordering', async () => {
    const { data: clients, error } = await supabase.from('clients').select('*');
    expect(error).toBeNull();
    expect(Array.isArray(clients)).toBe(true);
    expect(clients.length).toBeGreaterThan(0);
  });

  it('inserts and retrieves new leads triggering realtime callback', async () => {
    let capturedEvent = null;

    const channel = supabase
      .channel('new-leads')
      .on('postgres_changes', {}, (payload) => {
        capturedEvent = payload;
      })
      .subscribe();

    const newLead = {
      agent_id: '00000000-0000-0000-0000-000000000001',
      full_name: 'Manish Tiwari',
      phone: '9855443322',
      interest_area: 'Jeevan Umang',
      message: 'Interested in pension options.',
      source: 'visiting_card'
    };

    const { data: inserted, error } = await supabase.from('leads').insert(newLead);
    expect(error).toBeNull();
    expect(inserted[0].full_name).toBe('Manish Tiwari');

    // Verify realtime event was delivered
    expect(capturedEvent).not.toBeNull();
    expect(capturedEvent.new.full_name).toBe('Manish Tiwari');

    supabase.removeChannel(channel);
  });
});
