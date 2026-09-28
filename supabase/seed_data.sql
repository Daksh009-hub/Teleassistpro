-- Seed Data for Tele-Assist Pro Demo / Initial Setup

INSERT INTO agents (id, email, full_name, phone, license_number, card_slug, xp_points, level, streak_days, last_active_date, badges)
VALUES (
  '00000000-0000-0000-0000-000000000001',
  'rajesh.lic@gmail.com',
  'Rajesh Verma',
  '+91 98765 43210',
  'LIC/2019/DEL/849201',
  'rajesh-verma',
  640,
  3,
  5,
  CURRENT_DATE,
  ARRAY['first_call', 'note_taker', 'kyc_master', 'on_fire']
) ON CONFLICT (email) DO NOTHING;

-- Clients
INSERT INTO clients (id, agent_id, full_name, phone, email, dob, address, aadhaar_last4, pan_number, kyc_status, status, tags)
VALUES
(
  '11111111-1111-1111-1111-111111111111',
  '00000000-0000-0000-0000-000000000001',
  'Ramesh Kumar Sharma',
  '9811223344',
  'ramesh.sharma@example.com',
  '1985-04-12',
  'B-42, Sector 15, Noida, UP',
  '4582',
  'ABCPS1234F',
  'verified',
  'active',
  ARRAY['High Net Worth', 'Family Head', 'Term Plan']
),
(
  '22222222-2222-2222-2222-222222222222',
  '00000000-0000-0000-0000-000000000001',
  'Sunita Sharma',
  '9811223345',
  'sunita.s@example.com',
  '1988-08-20',
  'B-42, Sector 15, Noida, UP',
  '9120',
  'ABCPS5678G',
  'verified',
  'active',
  ARRAY['Spouse', 'Child Plan']
),
(
  '33333333-3333-3333-3333-333333333333',
  '00000000-0000-0000-0000-000000000001',
  'Priya Patel',
  '9822334455',
  'priya.patel@example.com',
  '1992-11-05',
  'Flat 301, Palm Heights, Ahmedabad, Gujarat',
  '1134',
  'DEFPP9012K',
  'pending',
  'active',
  ARRAY['New Lead', 'Doctor', 'Jeevan Umang']
),
(
  '44444444-4444-4444-4444-444444444444',
  '00000000-0000-0000-0000-000000000001',
  'Vikram Malhotra',
  '9833445566',
  'vikram.m@example.com',
  '1979-02-18',
  '12-A, Marine Drive, Mumbai, Maharashtra',
  '7890',
  'GHIPM3456L',
  'flagged',
  'active',
  ARRAY['Lapsed Policy', 'Businessman']
),
(
  '55555555-5555-5555-5555-555555555555',
  '00000000-0000-0000-0000-000000000001',
  'Ananya Roy',
  '9844556677',
  'ananya.roy@example.com',
  '1995-07-29',
  'Salt Lake City, Sector 2, Kolkata, WB',
  '6677',
  'JKLPA7890M',
  'verified',
  'cold',
  ARRAY['Reactivation Candidate', 'Child Future']
) ON CONFLICT (id) DO NOTHING;

-- Set Family relations & Referrals
UPDATE clients SET family_head_id = '11111111-1111-1111-1111-111111111111' WHERE id = '22222222-2222-2222-2222-222222222222';
UPDATE clients SET referral_from = '11111111-1111-1111-1111-111111111111' WHERE id = '33333333-3333-3333-3333-333333333333';

-- Policies
INSERT INTO policies (id, client_id, agent_id, policy_number, policy_name, plan_type, sum_assured, premium_amount, premium_frequency, start_date, maturity_date, next_due_date, status, trackable_link, link_views, quote_last_viewed_at, quote_total_time_sec, quote_device_type)
VALUES
(
  'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
  '11111111-1111-1111-1111-111111111111',
  '00000000-0000-0000-0000-000000000001',
  '123456789',
  'LIC Jeevan Labh (Plan 936)',
  'Endowment',
  1500000,
  45000,
  'yearly',
  '2020-05-10',
  '2041-05-10',
  CURRENT_DATE + INTERVAL '12 days',
  'active',
  'quote-sharma-936',
  4,
  CURRENT_TIMESTAMP - INTERVAL '2 hours',
  272,
  'mobile'
),
(
  'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',
  '22222222-2222-2222-2222-222222222222',
  '00000000-0000-0000-0000-000000000001',
  '987654321',
  'LIC Jeevan Tarun (Plan 934)',
  'Child Education',
  1000000,
  32000,
  'yearly',
  '2021-09-15',
  '2046-09-15',
  CURRENT_DATE + INTERVAL '30 days',
  'active',
  NULL,
  0,
  NULL,
  0,
  NULL
),
(
  'cccccccc-cccc-cccc-cccc-cccccccccccc',
  '44444444-4444-4444-4444-444444444444',
  '00000000-0000-0000-0000-000000000001',
  '554433221',
  'LIC Jeevan Umang (Plan 945)',
  'Whole Life',
  2500000,
  72000,
  'yearly',
  '2018-01-20',
  '2058-01-20',
  CURRENT_DATE - INTERVAL '8 months',
  'lapsed',
  NULL,
  0,
  NULL,
  0,
  NULL
) ON CONFLICT (id) DO NOTHING;

-- Follow Ups
INSERT INTO follow_ups (id, agent_id, client_id, due_date, action_type, notes, status, auto_created)
VALUES
(
  'f1111111-1111-1111-1111-111111111111',
  '00000000-0000-0000-0000-000000000001',
  '11111111-1111-1111-1111-111111111111',
  CURRENT_DATE,
  'renewal',
  'Call Ramesh for Jeevan Labh renewal due in 12 days. Mention loyalty bonus.',
  'pending',
  false
),
(
  'f2222222-2222-2222-2222-222222222222',
  '00000000-0000-0000-0000-000000000001',
  '33333333-3333-3333-3333-333333333333',
  CURRENT_DATE,
  'document_collection',
  'Collect signed proposal form and address proof for Jeevan Umang.',
  'pending',
  true
),
(
  'f3333333-3333-3333-3333-333333333333',
  '00000000-0000-0000-0000-000000000001',
  '44444444-4444-4444-4444-444444444444',
  CURRENT_DATE - INTERVAL '2 days',
  'claim',
  'Follow up on revival quotation with late fee waiver calculation.',
  'missed',
  false
) ON CONFLICT (id) DO NOTHING;

-- Payments for 80C
INSERT INTO payments (policy_id, client_id, amount_paid, payment_date, receipt_number, financial_year)
VALUES
(
  'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
  '11111111-1111-1111-1111-111111111111',
  45000,
  CURRENT_DATE - INTERVAL '4 months',
  'LIC/DEL/2024/008472',
  '2024-25'
),
(
  'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',
  '22222222-2222-2222-2222-222222222222',
  32000,
  CURRENT_DATE - INTERVAL '6 months',
  'LIC/DEL/2024/009123',
  '2024-25'
);
