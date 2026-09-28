-- Tele-Assist Pro — Database Schema Migration
-- Version 1.1

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Table: agents
CREATE TABLE IF NOT EXISTS agents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT UNIQUE NOT NULL,
  full_name TEXT,
  phone TEXT,
  license_number TEXT,
  profile_photo TEXT,
  card_slug TEXT UNIQUE,
  xp_points INTEGER DEFAULT 0,
  level INTEGER DEFAULT 1,
  streak_days INTEGER DEFAULT 0,
  last_active_date DATE,
  badges TEXT[] DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Table: clients
CREATE TABLE IF NOT EXISTS clients (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id UUID REFERENCES agents(id) ON DELETE CASCADE,
  full_name TEXT NOT NULL,
  phone TEXT,
  email TEXT,
  dob DATE,
  address TEXT,
  aadhaar_last4 TEXT,
  pan_number TEXT,
  kyc_status TEXT DEFAULT 'pending', -- pending | verified | flagged
  family_head_id UUID REFERENCES clients(id) ON DELETE SET NULL,
  referral_from UUID REFERENCES clients(id) ON DELETE SET NULL,
  lead_source TEXT DEFAULT 'manual', -- manual | excel_import | visiting_card
  status TEXT DEFAULT 'active', -- active | cold | lost
  tags TEXT[] DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Table: policies
CREATE TABLE IF NOT EXISTS policies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID REFERENCES clients(id) ON DELETE CASCADE,
  agent_id UUID REFERENCES agents(id) ON DELETE CASCADE,
  policy_number TEXT,
  policy_name TEXT,
  plan_type TEXT,
  sum_assured NUMERIC,
  premium_amount NUMERIC,
  premium_frequency TEXT, -- monthly | quarterly | half-yearly | yearly
  start_date DATE,
  maturity_date DATE,
  next_due_date DATE,
  status TEXT DEFAULT 'active', -- active | lapsed | matured | surrendered
  pdf_url TEXT,
  trackable_link TEXT UNIQUE,
  link_views INTEGER DEFAULT 0,
  quote_last_viewed_at TIMESTAMPTZ,
  quote_total_time_sec INTEGER DEFAULT 0,
  quote_device_type TEXT,
  quote_nudge_sent_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Table: quote_view_events
CREATE TABLE IF NOT EXISTS quote_view_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  policy_id UUID REFERENCES policies(id) ON DELETE CASCADE,
  viewed_at TIMESTAMPTZ DEFAULT now(),
  time_spent_sec INTEGER DEFAULT 0,
  device_type TEXT, -- mobile | desktop | tablet
  user_agent TEXT
);

-- Table: agent_xp_log
CREATE TABLE IF NOT EXISTS agent_xp_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id UUID REFERENCES agents(id) ON DELETE CASCADE,
  action TEXT, -- e.g. 'call_logged', 'followup_done', 'kyc_uploaded', 'lead_captured'
  xp_earned INTEGER,
  description TEXT,
  earned_at TIMESTAMPTZ DEFAULT now()
);

-- Table: payments
CREATE TABLE IF NOT EXISTS payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  policy_id UUID REFERENCES policies(id) ON DELETE CASCADE,
  client_id UUID REFERENCES clients(id) ON DELETE CASCADE,
  amount_paid NUMERIC,
  payment_date DATE,
  receipt_number TEXT,
  financial_year TEXT, -- e.g. "2024-25"
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Table: activities
CREATE TABLE IF NOT EXISTS activities (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id UUID REFERENCES agents(id) ON DELETE CASCADE,
  client_id UUID REFERENCES clients(id) ON DELETE CASCADE,
  activity_type TEXT, -- call | note | document | follow_up | kyc | claim | service_request
  title TEXT,
  description TEXT,
  ai_summary TEXT,
  raw_transcript TEXT,
  scheduled_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  status TEXT DEFAULT 'pending', -- pending | done | missed
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Table: follow_ups
CREATE TABLE IF NOT EXISTS follow_ups (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id UUID REFERENCES agents(id) ON DELETE CASCADE,
  client_id UUID REFERENCES clients(id) ON DELETE CASCADE,
  activity_id UUID REFERENCES activities(id) ON DELETE SET NULL,
  due_date DATE NOT NULL,
  action_type TEXT, -- callback | document_collection | renewal | claim | service
  notes TEXT,
  status TEXT DEFAULT 'pending', -- pending | done | missed | snoozed
  auto_created BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Table: kyc_documents
CREATE TABLE IF NOT EXISTS kyc_documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID REFERENCES clients(id) ON DELETE CASCADE,
  doc_type TEXT, -- aadhaar | pan | photo | other
  file_url TEXT,
  extracted_name TEXT,
  extracted_dob TEXT,
  mismatch_flags JSONB DEFAULT '{}',
  uploaded_at TIMESTAMPTZ DEFAULT now()
);

-- Table: service_requests
CREATE TABLE IF NOT EXISTS service_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID REFERENCES clients(id) ON DELETE CASCADE,
  policy_id UUID REFERENCES policies(id) ON DELETE SET NULL,
  request_type TEXT, -- claim | address_change | nominee_change | revival | other
  status TEXT DEFAULT 'received', -- received | doc_pending | processing | completed
  notes TEXT,
  documents TEXT[] DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Table: leads
CREATE TABLE IF NOT EXISTS leads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id UUID REFERENCES agents(id) ON DELETE CASCADE,
  full_name TEXT NOT NULL,
  phone TEXT,
  email TEXT,
  interest_area TEXT,
  message TEXT,
  source TEXT DEFAULT 'visiting_card',
  status TEXT DEFAULT 'new', -- new | contacted | converted | dropped
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Enable Row Level Security on all tables
ALTER TABLE agents ENABLE ROW LEVEL SECURITY;
ALTER TABLE clients ENABLE ROW LEVEL SECURITY;
ALTER TABLE policies ENABLE ROW LEVEL SECURITY;
ALTER TABLE quote_view_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE agent_xp_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE activities ENABLE ROW LEVEL SECURITY;
ALTER TABLE follow_ups ENABLE ROW LEVEL SECURITY;
ALTER TABLE kyc_documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE service_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE leads ENABLE ROW LEVEL SECURITY;

-- RLS Policies (Allow agent access to their own records)
CREATE POLICY "Agents can view own profile" ON agents FOR ALL USING (auth.uid() = id);
CREATE POLICY "Agents can view and edit own clients" ON clients FOR ALL USING (auth.uid() = agent_id);
CREATE POLICY "Agents can view and edit own policies" ON policies FOR ALL USING (auth.uid() = agent_id);
CREATE POLICY "Agents can view own XP log" ON agent_xp_log FOR ALL USING (auth.uid() = agent_id);
CREATE POLICY "Agents can view own activities" ON activities FOR ALL USING (auth.uid() = agent_id);
CREATE POLICY "Agents can view own follow_ups" ON follow_ups FOR ALL USING (auth.uid() = agent_id);
CREATE POLICY "Agents can view own service_requests" ON service_requests FOR ALL USING (auth.uid() = (SELECT agent_id FROM clients WHERE clients.id = service_requests.client_id));
CREATE POLICY "Agents can view own leads" ON leads FOR ALL USING (auth.uid() = agent_id);

-- Public access policies for public cards and quotes
CREATE POLICY "Public can view agents by card_slug" ON agents FOR SELECT USING (true);
CREATE POLICY "Public can insert leads" ON leads FOR INSERT WITH CHECK (true);
CREATE POLICY "Public can view trackable policies" ON policies FOR SELECT USING (trackable_link IS NOT NULL);
CREATE POLICY "Public can insert quote view events" ON quote_view_events FOR INSERT WITH CHECK (true);
