import express from 'express';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 10000;

app.use(express.json());

// Persistent storage directory for leads submitted via Digital Visiting Cards
const DATA_DIR = path.join(__dirname, 'data');
const LEADS_FILE = path.join(DATA_DIR, 'leads.json');

if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

function getStoredLeads() {
  try {
    if (fs.existsSync(LEADS_FILE)) {
      const content = fs.readFileSync(LEADS_FILE, 'utf-8');
      const parsed = JSON.parse(content);
      if (Array.isArray(parsed)) return parsed;
    }
  } catch (err) {
    console.error('Error reading leads file:', err);
  }
  return [
    {
      id: 'l1111111-1111-1111-1111-111111111111',
      agent_id: '00000000-0000-0000-0000-000000000001',
      full_name: 'Rahul Sharma',
      phone: '9988776655',
      email: 'rahul.s@outlook.com',
      interest_area: 'Term Plan',
      message: 'Looking for 1 Cr term plan for age 30, non-smoker.',
      source: 'visiting_card',
      status: 'new',
      created_at: new Date(Date.now() - 3600000).toISOString()
    }
  ];
}

function saveStoredLeads(leads) {
  try {
    fs.writeFileSync(LEADS_FILE, JSON.stringify(leads, null, 2), 'utf-8');
  } catch (err) {
    console.error('Error saving leads file:', err);
  }
}

let inMemoryLeads = getStoredLeads();

// GET all leads (used by agent's Leads tab and real-time toast)
app.get('/api/leads', (req, res) => {
  res.json(inMemoryLeads);
});

// POST new lead (called when client submits the Digital Visiting Card form on any device)
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

  inMemoryLeads = [record, ...inMemoryLeads.filter(l => l.id !== record.id)];
  saveStoredLeads(inMemoryLeads);

  console.log(`[LEAD RECEIVED] ${record.full_name} (${record.phone}) interested in ${record.interest_area}`);
  res.status(201).json(record);
});

// PATCH update lead status (e.g. marked as 'contacted' or 'converted')
app.patch('/api/leads/:id', (req, res) => {
  const { id } = req.params;
  const updates = req.body || {};
  let updatedRecord = null;

  inMemoryLeads = inMemoryLeads.map(l => {
    if (l.id === id) {
      updatedRecord = { ...l, ...updates };
      return updatedRecord;
    }
    return l;
  });

  if (updatedRecord) {
    saveStoredLeads(inMemoryLeads);
    return res.json(updatedRecord);
  }
  res.status(404).json({ error: 'Lead not found' });
});

// DELETE lead
app.delete('/api/leads/:id', (req, res) => {
  const { id } = req.params;
  inMemoryLeads = inMemoryLeads.filter(l => l.id !== id);
  saveStoredLeads(inMemoryLeads);
  res.json({ success: true });
});

// Serve static assets from Vite build output directory
app.use(express.static(path.join(__dirname, 'dist')));

// SPA fallback for client-side routing (compatible with Express 4 & 5)
app.use((req, res) => {
  res.sendFile(path.join(__dirname, 'dist', 'index.html'));
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`Teleasistre Web Service running on port ${PORT}`);
});
