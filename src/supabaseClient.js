import { createClient } from '@supabase/supabase-js';
import * as offlineDB from './utils/offlineDB.js';
import { safeGetItem, safeSetItem, safeRemoveItem } from './utils/storage.js';

const supabaseUrl = typeof import.meta !== 'undefined' && import.meta.env?.VITE_SUPABASE_URL ? import.meta.env.VITE_SUPABASE_URL : '';
const supabaseAnonKey = typeof import.meta !== 'undefined' && import.meta.env?.VITE_SUPABASE_ANON_KEY ? import.meta.env.VITE_SUPABASE_ANON_KEY : '';

const isRealSupabase = 
  Boolean(supabaseUrl) && 
  Boolean(supabaseAnonKey) && 
  !supabaseUrl.includes('demo.supabase.co') &&
  !supabaseAnonKey.includes('demo');

export const supabase = isRealSupabase
  ? createClient(supabaseUrl, supabaseAnonKey)
  : createMockSupabase();

export const isUsingMock = !isRealSupabase;

// Mock Supabase wrapper for instant evaluation & offline mode
function createMockSupabase() {
  const channelListeners = new Map();

  return {
    auth: {
      async getSession() {
        const stored = safeGetItem('mock_auth_session');
        if (stored) {
          try {
            const parsed = JSON.parse(stored);
            return { data: { session: parsed }, error: null };
          } catch (e) {}
        }
        return { data: { session: null }, error: null };
      },
      async signInWithPassword({ email, password }) {
        const agents = await offlineDB.getAllFromStore('agents');
        const agent = agents[0];
        const session = {
          user: {
            id: agent?.id || '00000000-0000-0000-0000-000000000001',
            email: email || 'rajesh.lic@gmail.com',
            user_metadata: { full_name: agent?.full_name || 'Rajesh Verma' }
          },
          access_token: 'mock-jwt-token-' + Date.now()
        };
        safeSetItem('mock_auth_session', JSON.stringify(session));
        return { data: { session, user: session.user }, error: null };
      },
      async signOut() {
        safeRemoveItem('mock_auth_session');
        return { error: null };
      },
      async resetPasswordForEmail() {
        return { data: {}, error: null };
      }
    },
    from(table) {
      return {
        select(fields = '*') {
          let filterFn = () => true;
          let orderCol = null;
          let isAscending = true;

          const queryObj = {
            eq(column, value) {
              const prev = filterFn;
              filterFn = (item) => prev(item) && item[column] === value;
              return queryObj;
            },
            neq(column, value) {
              const prev = filterFn;
              filterFn = (item) => prev(item) && item[column] !== value;
              return queryObj;
            },
            order(col, { ascending = true } = {}) {
              orderCol = col;
              isAscending = ascending;
              return queryObj;
            },
            async single() {
              const all = await offlineDB.getAllFromStore(table);
              const filtered = all.filter(filterFn);
              return { data: filtered[0] || null, error: null };
            },
            then(resolve, reject) {
              return offlineDB.getAllFromStore(table)
                .then(all => {
                  let res = all.filter(filterFn);
                  if (orderCol) {
                    res.sort((a, b) => {
                      if (a[orderCol] < b[orderCol]) return isAscending ? -1 : 1;
                      if (a[orderCol] > b[orderCol]) return isAscending ? 1 : -1;
                      return 0;
                    });
                  }
                  resolve({ data: res, error: null });
                })
                .catch(err => resolve({ data: [], error: err }));
            }
          };
          return queryObj;
        },
        async insert(data) {
          const items = Array.isArray(data) ? data : [data];
          const inserted = [];
          for (const item of items) {
            const record = {
              id: item.id || `rec-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
              created_at: item.created_at || new Date().toISOString(),
              ...item
            };
            await offlineDB.putInStore(table, record);
            inserted.push(record);

            if (table === 'leads') {
              const listeners = channelListeners.get('new-leads') || [];
              listeners.forEach(cb => cb({ eventType: 'INSERT', new: record }));
            }
          }
          return { data: inserted, error: null };
        },
        update(updates) {
          return {
            eq: async (col, val) => {
              const all = await offlineDB.getAllFromStore(table);
              const matched = all.find(item => item[col] === val);
              if (matched) {
                const updated = { ...matched, ...updates };
                await offlineDB.putInStore(table, updated);

                if (table === 'leads') {
                  const listeners = channelListeners.get('new-leads') || [];
                  listeners.forEach(cb => cb({ eventType: 'UPDATE', new: updated }));
                }
                return { data: [updated], error: null };
              }
              return { data: [], error: null };
            }
          };
        },
        delete() {
          return {
            eq: async (col, val) => {
              await offlineDB.deleteFromStore(table, val);
              if (table === 'leads') {
                const listeners = channelListeners.get('new-leads') || [];
                listeners.forEach(cb => cb({ eventType: 'DELETE', old: { [col]: val } }));
              }
              return { data: null, error: null };
            }
          };
        }
      };
    },
    channel(name) {
      return {
        on(type, filter, callback) {
          if (!channelListeners.has(name)) {
            channelListeners.set(name, []);
          }
          channelListeners.get(name).push(callback);
          return this;
        },
        subscribe() {
          return {
            unsubscribe: () => {
              channelListeners.delete(name);
            }
          };
        }
      };
    },
    removeChannel(chan) {
      if (chan && typeof chan.unsubscribe === 'function') {
        chan.unsubscribe();
      }
    }
  };
}
