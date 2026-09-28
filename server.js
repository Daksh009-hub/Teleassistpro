import express from 'express';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import {
  INITIAL_AGENT,
  INITIAL_CLIENTS,
  INITIAL_POLICIES,
  INITIAL_FOLLOW_UPS,
  INITIAL_ACTIVITIES,
  INITIAL_PAYMENTS,
  INITIAL_LEADS,
  INITIAL_SERVICE_REQUESTS,
  INITIAL_QUOTE_EVENTS
} from './src/utils/mockData.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 10000;

app.use(express.json());

// Persistent database path on server
const DATA_DIR = path.join(__dirname, 'data');
const DB_FILE = path.join(DATA_DIR, 'db.json');

if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

function getInitialDatabase() {
  return {
    agents: [INITIAL_AGENT],
    clients: INITIAL_CLIENTS,
    policies: INITIAL_POLICIES,
    follow_ups: INITIAL_FOLLOW_UPS,
    activities: INITIAL_ACTIVITIES,
    payments: INITIAL_PAYMENTS,
    leads: INITIAL_LEADS,
    service_requests: INITIAL_SERVICE_REQUESTS,
    quote_view_events: INITIAL_QUOTE_EVENTS,
    agent_xp_log: [],
    lastUpdated: Date.now()
  };
}

function loadDatabase() {
  try {
    if (fs.existsSync(DB_FILE)) {
      const content = fs.readFileSync(DB_FILE, 'utf-8');
      const parsed = JSON.parse(content);
      if (parsed && typeof parsed === 'object') {
        return parsed;
      }
    }
  } catch (err) {
    console.error('Error reading db.json:', err);
  }
  const initial = getInitialDatabase();
  saveDatabase(initial);
  return initial;
}

function saveDatabase(db) {
  try {
    fs.writeFileSync(DB_FILE, JSON.stringify(db, null, 2), 'utf-8');
  } catch (err) {
    console.error('Error writing db.json:', err);
  }
}

let database = loadDatabase();

// SSE (Server-Sent Events) clients set for real-time global broadcasts
const sseClients = new Set();

function broadcastEvent(event) {
  const payload = `data: ${JSON.stringify(event)}\n\n`;
  for (const client of sseClients) {
    try {
      client.write(payload);
    } catch (err) {
      sseClients.delete(client);
    }
  }
}

// 1. Real-time SSE endpoint (instant push to all open phones and laptops)
app.get('/api/events', (req, res) => {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders?.();

  // Send connected greeting
  res.write(`data: ${JSON.stringify({ type: 'connected', lastUpdated: database.lastUpdated || Date.now() })}\n\n`);

  sseClients.add(res);

  // Heartbeat every 20s
  const heartbeat = setInterval(() => {
    try {
      res.write(': heartbeat\n\n');
    } catch (e) {
      clearInterval(heartbeat);
      sseClients.delete(res);
    }
  }, 20000);

  req.on('close', () => {
    clearInterval(heartbeat);
    sseClients.delete(res);
  });
});

// 2. Full DB snapshot endpoint
app.get('/api/db', (req, res) => {
  const { since } = req.query;
  if (since && Number(since) >= (database.lastUpdated || 0)) {
    return res.status(304).end();
  }
  res.json(database);
});

// 3. Store-specific GET
app.get('/api/db/:store', (req, res) => {
  const { store } = req.params;
  res.json(database[store] || []);
});

// 4. Store PUT/POST (Insert or Update record)
app.post('/api/db/:store', (req, res) => {
  const { store } = req.params;
  const item = req.body;
  if (!item || !item.id) {
    return res.status(400).json({ error: 'Item with id required' });
  }

  if (!database[store]) {
    database[store] = [];
  }

  const existingIdx = database[store].findIndex(x => x.id === item.id);
  if (existingIdx >= 0) {
    database[store][existingIdx] = { ...database[store][existingIdx], ...item };
  } else {
    database[store].unshift(item);
  }

  database.lastUpdated = Date.now();
  saveDatabase(database);

  broadcastEvent({
    type: 'db_update',
    action: 'put',
    store,
    item,
    lastUpdated: database.lastUpdated
  });

  res.json({ success: true, item });
});

// 5. Store DELETE (Delete record)
app.delete('/api/db/:store/:id', (req, res) => {
  const { store, id } = req.params;
  if (database[store]) {
    database[store] = database[store].filter(x => x.id !== id);
    database.lastUpdated = Date.now();
    saveDatabase(database);

    broadcastEvent({
      type: 'db_update',
      action: 'delete',
      store,
      id,
      lastUpdated: database.lastUpdated
    });
  }
  res.json({ success: true, id });
});

// Backward-compatible /api/leads endpoints
app.get('/api/leads', (req, res) => {
  res.json(database.leads || []);
});

app.post('/api/leads', (req, res) => {
  const newLead = req.body;
  if (!newLead || !newLead.full_name || !newLead.phone) {
    return res.status(400).json({ error: 'full_name and phone are required' });
  }

  const record = {
    id: newLead.id || `lead-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
    agent_id: newLead.agent_id || '00000000-0000-0000-0000-000000000001',
    full_name: newLead.full_name,
    phone: newLead.phone,
    email: newLead.email || '',
    interest_area: newLead.interest_area || 'Term Plan',
    message: newLead.message || '',
    source: newLead.source || 'visiting_card',
    status: newLead.status || 'new',
    created_at: newLead.created_at || new Date().toISOString()
  };

  if (!database.leads) database.leads = [];
  database.leads = [record, ...database.leads.filter(l => l.id !== record.id)];
  database.lastUpdated = Date.now();
  saveDatabase(database);

  broadcastEvent({
    type: 'db_update',
    action: 'put',
    store: 'leads',
    item: record,
    lastUpdated: database.lastUpdated
  });

  res.status(201).json(record);
});

app.patch('/api/leads/:id', (req, res) => {
  const { id } = req.params;
  const updates = req.body || {};
  let updatedRecord = null;

  if (database.leads) {
    database.leads = database.leads.map(l => {
      if (l.id === id) {
        updatedRecord = { ...l, ...updates };
        return updatedRecord;
      }
      return l;
    });
  }

  if (updatedRecord) {
    database.lastUpdated = Date.now();
    saveDatabase(database);
    broadcastEvent({
      type: 'db_update',
      action: 'put',
      store: 'leads',
      item: updatedRecord,
      lastUpdated: database.lastUpdated
    });
    return res.json(updatedRecord);
  }
  res.status(404).json({ error: 'Lead not found' });
});

app.delete('/api/leads/:id', (req, res) => {
  const { id } = req.params;
  if (database.leads) {
    database.leads = database.leads.filter(l => l.id !== id);
    database.lastUpdated = Date.now();
    saveDatabase(database);
    broadcastEvent({
      type: 'db_update',
      action: 'delete',
      store: 'leads',
      id,
      lastUpdated: database.lastUpdated
    });
  }
  res.json({ success: true });
});

// Serve static assets from Vite build output directory
app.use(express.static(path.join(__dirname, 'dist')));

// SPA fallback for client-side routing
app.use((req, res) => {
  res.sendFile(path.join(__dirname, 'dist', 'index.html'));
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`Teleasistre Web Service running on port ${PORT}`);
});
