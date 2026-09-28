# Product Requirements Document (PRD)
## Tele-Assist Pro — LIC Agent Action & Relationship Assistant
### SIH Hackathon Prototype | Version 1.1 — Updated

---

## Table of Contents
1. [Project Overview](#1-project-overview)
2. [Tech Stack](#2-tech-stack)
3. [Architecture Overview](#3-architecture-overview)
4. [Database Schema](#4-database-schema)
5. [Core Screens & Features (MVP)](#5-core-screens--features-mvp)
6. [AI-Powered Features (from PDF)](#6-ai-powered-features-from-pdf)
7. [PWA & Offline-First Mode](#7-pwa--offline-first-mode)
8. [Non-Functional Requirements](#8-non-functional-requirements)
9. [File & Folder Structure](#9-file--folder-structure)
10. [Deployment Guide](#10-deployment-guide)
11. [Future Scope](#11-future-scope)
12. [Positioning Statement](#12-positioning-statement)
13. [NEW: Real-Time Lead Notifications](#13-new-real-time-lead-notifications)
14. [NEW: Smart Quote Tracker — Enhanced](#14-new-smart-quote-tracker--enhanced)
15. [NEW: Gamified Agent Progress System](#15-new-gamified-agent-progress-system)
16. [NEW: WhatsApp Message Templates](#16-new-whatsapp-message-templates)

---

## 1. Project Overview

**App Name:** Tele-Assist Pro
**Type:** Mobile-First Progressive Web App (PWA)
**Target User:** LIC Insurance Field Agents
**Context:** SIH (Smart India Hackathon) Prototype

### Problem Statement
A LIC agent's daily work is scattered across phone calls, WhatsApp messages, PDF documents, handwritten notes, and follow-up reminders — all managed manually across disconnected tools. Tele-Assist Pro is NOT another CRM; it is an **Agent Action & Relationship Assistant** that connects conversations, tasks, documents, and follow-ups into one actionable workflow.

**Core Positioning:**
> "We are not trying to replace the insurer's existing system; we solve the agent's day-to-day work around it."

---

## 2. Tech Stack

| Layer | Technology | Reason |
|---|---|---|
| Frontend Framework | React 18 + Vite | Fast dev, modular components |
| UI Library | Bootstrap 5 | Mobile-friendly, fast prototyping |
| Language | JavaScript (ES2022) | No build complexity for hackathon |
| Backend / DB | Supabase (PostgreSQL) | Auth + DB + Storage + Realtime, free tier |
| Authentication | Supabase Auth (Email/Password) | Built-in, secure |
| File Storage | Supabase Storage | KYC docs, PDFs |
| OCR | Tesseract.js (client-side) | Free, no API key needed |
| AI / LLM | Google Gemini API (free tier) | Voice summaries, smart search, document intelligence |
| Speech-to-Text | Web Speech API (browser-native) | Free, no key needed; fallback: Whisper.cpp WASM |
| PDF Generation | jsPDF + jspdf-autotable | 80C tax PDF, visiting card PDF |
| PWA / Offline | Vite PWA Plugin + Workbox + IndexedDB | Service Worker + sync queue |
| Deployment | Render (backend optional) + Vercel (frontend) | Free tier, fast CI/CD |
| Routing | React Router v6 | SPA routing |

### AI Provider Decision
Use **Google Gemini 1.5 Flash** (free tier, 15 RPM, 1M context window). It handles:
- Text summarisation (call notes)
- NLP for follow-up date extraction
- Document intelligence (PDF parsing + Q&A)
- Natural language search query conversion
- Re-activation suggestions

Fallback: **Groq API** (Llama 3.1 — free, very fast) for latency-sensitive tasks.

---

## 3. Architecture Overview

```
┌─────────────────────────────────────────────┐
│              React + Vite (PWA)             │
│  ┌──────────┐ ┌──────────┐ ┌─────────────┐ │
│  │Bootstrap │ │React     │ │Service      │ │
│  │5 UI      │ │Router v6 │ │Worker       │ │
│  └──────────┘ └──────────┘ └─────────────┘ │
│                                             │
│  Client-Side:                               │
│  • Tesseract.js (OCR)                       │
│  • Web Speech API (STT)                     │
│  • jsPDF (PDF generation)                   │
│  • IndexedDB (offline storage)              │
└────────────────┬────────────────────────────┘
                 │ HTTPS
┌────────────────▼────────────────────────────┐
│              Supabase                        │
│  • Auth (JWT sessions)                      │
│  • PostgreSQL (all relational data)         │
│  • Storage Buckets (KYC docs, policy PDFs) │
│  • Row Level Security (RLS) policies        │
│  • Edge Functions (optional: webhooks)      │
└────────────────┬────────────────────────────┘
                 │
┌────────────────▼────────────────────────────┐
│           External APIs                      │
│  • Google Gemini 1.5 Flash (AI features)   │
│  • Web Speech API (browser-native STT)      │
└─────────────────────────────────────────────┘
```

---

## 4. Database Schema

### Table: `agents`
```sql
id               uuid PRIMARY KEY DEFAULT gen_random_uuid()
email            text UNIQUE NOT NULL
full_name        text
phone            text
license_number   text
profile_photo    text  -- Supabase Storage URL
card_slug        text UNIQUE  -- for digital visiting card public URL
-- Gamification columns
xp_points        integer DEFAULT 0
level            integer DEFAULT 1
streak_days      integer DEFAULT 0
last_active_date date
badges           text[]  -- e.g. ['first_call', 'kyc_master', 'followup_streak_7']
created_at       timestamptz DEFAULT now()
```

### Table: `clients`
```sql
id               uuid PRIMARY KEY DEFAULT gen_random_uuid()
agent_id         uuid REFERENCES agents(id)
full_name        text NOT NULL
phone            text
email            text
dob              date
address          text
aadhaar_last4    text
pan_number       text
kyc_status       text DEFAULT 'pending'  -- pending | verified | flagged
family_head_id   uuid REFERENCES clients(id)  -- for family grouping
referral_from    uuid REFERENCES clients(id)  -- referral relationship
lead_source      text DEFAULT 'manual'  -- manual | excel_import | visiting_card
status           text DEFAULT 'active'  -- active | cold | lost
tags             text[]
created_at       timestamptz DEFAULT now()
```

### Table: `policies`
```sql
id               uuid PRIMARY KEY DEFAULT gen_random_uuid()
client_id        uuid REFERENCES clients(id)
agent_id         uuid REFERENCES agents(id)
policy_number    text
policy_name      text
plan_type        text
sum_assured      numeric
premium_amount   numeric
premium_frequency text  -- monthly | quarterly | half-yearly | yearly
start_date       date
maturity_date    date
next_due_date    date
status           text DEFAULT 'active'  -- active | lapsed | matured | surrendered
pdf_url          text  -- Supabase Storage URL
trackable_link   text UNIQUE  -- for Smart Quote Tracker
link_views       integer DEFAULT 0
-- Enhanced Quote Tracker columns
quote_last_viewed_at  timestamptz
quote_total_time_sec  integer DEFAULT 0   -- cumulative seconds client spent on page
quote_device_type     text                -- mobile | desktop | tablet
quote_nudge_sent_at   timestamptz         -- when agent last sent a "haven't opened yet" nudge
created_at       timestamptz DEFAULT now()
```

### Table: `quote_view_events`
```sql
id               uuid PRIMARY KEY DEFAULT gen_random_uuid()
policy_id        uuid REFERENCES policies(id)
viewed_at        timestamptz DEFAULT now()
time_spent_sec   integer DEFAULT 0
device_type      text   -- mobile | desktop | tablet
user_agent       text
```

### Table: `agent_xp_log`
```sql
id               uuid PRIMARY KEY DEFAULT gen_random_uuid()
agent_id         uuid REFERENCES agents(id)
action           text    -- e.g. 'call_logged', 'followup_done', 'kyc_uploaded', 'lead_captured'
xp_earned        integer
description      text    -- e.g. "Completed follow-up with Ramesh Kumar"
earned_at        timestamptz DEFAULT now()
```

### Table: `payments`
```sql
id               uuid PRIMARY KEY DEFAULT gen_random_uuid()
policy_id        uuid REFERENCES policies(id)
client_id        uuid REFERENCES clients(id)
amount_paid      numeric
payment_date     date
receipt_number   text
financial_year   text  -- e.g. "2024-25"
created_at       timestamptz DEFAULT now()
```

### Table: `activities`
```sql
id               uuid PRIMARY KEY DEFAULT gen_random_uuid()
agent_id         uuid REFERENCES agents(id)
client_id        uuid REFERENCES clients(id)
activity_type    text  -- call | note | document | follow_up | kyc | claim | service_request
title            text
description      text
ai_summary       text  -- AI-generated summary (for calls)
raw_transcript   text  -- raw speech text before AI summarisation
scheduled_at     timestamptz
completed_at     timestamptz
status           text DEFAULT 'pending'  -- pending | done | missed
created_at       timestamptz DEFAULT now()
```

### Table: `follow_ups`
```sql
id               uuid PRIMARY KEY DEFAULT gen_random_uuid()
agent_id         uuid REFERENCES agents(id)
client_id        uuid REFERENCES clients(id)
activity_id      uuid REFERENCES activities(id)
due_date         date NOT NULL
action_type      text  -- callback | document_collection | renewal | claim | service
notes            text
status           text DEFAULT 'pending'  -- pending | done | missed | snoozed
auto_created     boolean DEFAULT false  -- true if created by NLP engine
created_at       timestamptz DEFAULT now()
```

### Table: `kyc_documents`
```sql
id               uuid PRIMARY KEY DEFAULT gen_random_uuid()
client_id        uuid REFERENCES clients(id)
doc_type         text  -- aadhaar | pan | photo | other
file_url         text  -- Supabase Storage URL (watermarked version)
extracted_name   text  -- from OCR
extracted_dob    text  -- from OCR
mismatch_flags   jsonb  -- e.g. {"dob": true, "name": false}
uploaded_at      timestamptz DEFAULT now()
```

### Table: `service_requests`
```sql
id               uuid PRIMARY KEY DEFAULT gen_random_uuid()
client_id        uuid REFERENCES clients(id)
policy_id        uuid REFERENCES policies(id)
request_type     text  -- claim | address_change | nominee_change | revival | other
status           text DEFAULT 'received'  -- received | doc_pending | processing | completed
notes            text
documents        text[]  -- array of Supabase Storage URLs
created_at       timestamptz DEFAULT now()
updated_at       timestamptz DEFAULT now()
```

### Table: `leads`
```sql
id               uuid PRIMARY KEY DEFAULT gen_random_uuid()
agent_id         uuid REFERENCES agents(id)
full_name        text NOT NULL
phone            text
email            text
interest_area    text
message          text
source           text DEFAULT 'visiting_card'
status           text DEFAULT 'new'  -- new | contacted | converted | dropped
created_at       timestamptz DEFAULT now()
```

---

## 5. Core Screens & Features (MVP)

---

### Screen 1: Agent Login Page

**Route:** `/login`
**Purpose:** Secure entry point.

**UI Elements:**
- Tele-Assist Pro logo + tagline
- Email + Password fields (Bootstrap form)
- "Login" button → Supabase Auth `signInWithPassword()`
- Error handling: wrong credentials, unverified email
- "Forgot Password" link → Supabase `resetPasswordForEmail()`

**Logic:**
- On successful login → redirect to `/dashboard`
- Supabase JWT session persisted in `localStorage`
- Auth guard: all protected routes check `supabase.auth.getSession()`

---

### Screen 2: Mobile CRM Dashboard

**Route:** `/dashboard`
**Purpose:** Main home screen — shows today's priorities + client list.

**Sections:**

#### 2A. Today's Action Engine (top card)
- Badges: `3 Follow-ups` | `2 Callbacks` | `2 Docs Pending` | `1 Missed`
- Tapping any badge filters the client list below
- Data source: `follow_ups` table filtered by `due_date = today` and `status = pending`

#### 2B. Client List
- Search bar (natural language — see Feature 7)
- Each client card shows: Name, Phone, Policy count, Next follow-up date, Status badge
- "Add Client / Policy" floating action button (FAB) → modal form
- Color-coded status: green (active), orange (follow-up due), red (missed/lapsed)

#### 2C. Upload Excel Button
- Accepts `.xlsx` / `.csv` file
- Parse with `SheetJS` (xlsx library)
- Map columns: Name, Phone, Email, Policy No., Premium, Due Date
- Bulk insert into `clients` + `policies` tables via Supabase
- Show success/error count summary

#### 2D. Missed Follow-up Alert Banner
- Checks `follow_ups` where `due_date < today` AND `status = pending`
- Shows count: "⚠️ 3 follow-ups may be overdue"

---

### Screen 3: Client 360° Profile & In-App Dialer

**Route:** `/client/:id`
**Purpose:** Full relationship timeline + call initiation.

#### 3A. Client Header
- Name, photo placeholder, phone, email, KYC status badge
- Tags (editable)

#### 3B. Relationship Timeline
- Chronological list of all `activities` for this client
- Icons per type: 📞 call, 📄 document, ✅ follow-up, 🏥 claim, 📝 note
- Each entry shows date, title, AI summary (if available)

#### 3C. In-App Dialer & Call Wrap-Up
**Call Flow:**
1. Agent taps "Call [Client Name]" button
2. App opens `tel:<phone_number>` link → native phone dialer opens
3. App sets `localStorage.setItem('pending_call_client', clientId)` and records `call_start_time`
4. `document.addEventListener('visibilitychange', ...)` listens for agent returning to app
5. On return (tab/app becomes visible again):
   - Pop-up modal appears: "Call with [Name] done?"
   - Shows call duration estimate
   - Fields: Call notes (textarea), Follow-up date picker, Outcome selector (Interested / Not Interested / Callback / Document Requested)
6. On submit → creates `activity` record (type: `call`) + `follow_up` record if date selected
7. "Send WhatsApp Follow-Up" button → opens `https://wa.me/<phone>?text=<pre-filled message>` with client name, policy info, and next step

#### 3D. Quick Note
- Text area + "Save Note" → creates `activity` record (type: `note`)
- NLP auto-follow-up: if note contains date-like text ("Friday", "25th", "next week"), Gemini API extracts date → creates follow-up automatically with `auto_created: true`

---

### Screen 4: Family Passbook

**Route:** `/client/:id/family`
**Purpose:** Consolidated view of all policies for a client's family.

**Logic:**
- Query: all clients where `family_head_id = :id` OR `id = :id`
- For each family member → list all their policies
- Display: Member name → Policy name, Sum Assured, Premium, Next Due Date, Status

**UI:**
- Bootstrap accordion: one card per family member
- Color coding: green (paid/active), red (due soon), grey (lapsed)
- "Add Family Member" button → modal with "Link Existing Client" or "Create New Client"
- Due date sorting: soonest first

---

### Screen 5: Secure KYC Drop-Box

**Route:** `/kyc/:clientId`
**Purpose:** Secure document upload with OCR + watermarking.

**Upload Flow:**
1. Agent shares this link with client (or fills it themselves)
2. Client/Agent uploads Aadhaar front or PAN card image
3. **Client-side Tesseract.js** runs OCR on the image:
   - Extracts text → regex patterns to find Name and DOB
   - Aadhaar pattern: 12-digit number, Name line, DOB line (dd/mm/yyyy)
   - PAN pattern: Name on line 3, DOB on line 4
4. **Watermark** applied client-side using `<canvas>`:
   - Draw original image on canvas
   - Overlay text: "Only for LIC | Confidential" in diagonal, semi-transparent
5. Watermarked image uploaded to Supabase Storage bucket `kyc-documents/`
6. Extracted name + DOB saved to `kyc_documents` table
7. **Mismatch Detector**: compare extracted DOB vs. `clients.dob` → flag if different → update `mismatch_flags` in DB
8. KYC status updated: `pending → verified` (or `flagged` if mismatch)

**Security:**
- Supabase Storage bucket: private, RLS-protected
- Only the agent (owner) can view uploaded files
- Files named: `{clientId}/{docType}_{timestamp}.jpg`

---

### Screen 6: Smart Quote Tracker (Enhanced)

**Route:** `/quote/:policyId` (agent view) | `/view/:trackId` (public client view)

**Agent Side:**
1. Agent uploads a policy PDF → stored in Supabase Storage
2. System generates a unique `trackable_link` (UUID-based slug)
3. Agent copies and shares link with client via WhatsApp (uses WhatsApp Template — see Section 16)
4. Agent sees a rich tracking panel per quote:
   - "📄 Viewed 3 times | Total time: 4m 32s | Last: Today 4:32 PM"
   - Device breakdown badge: "📱 Mobile" or "💻 Desktop"
   - Timeline of individual view events (from `quote_view_events` table)

**Client Side (public route `/view/:trackId`):**
1. Client opens link → PDF rendered in browser via `pdfjs-dist`
2. On page load → insert row into `quote_view_events` with `viewed_at`, `device_type` (parsed from user-agent), `user_agent`
3. JS timer starts: `setInterval` increments a local counter every second
4. On `visibilitychange` or `beforeunload` → POST final `time_spent_sec` to Supabase (upsert on event id)
5. `policies.link_views` incremented, `quote_last_viewed_at` updated, `quote_total_time_sec` accumulated

**"Hasn't Opened Yet" Nudge (3-Day Rule):**
- Dashboard checks: `trackable_link` shared but `quote_last_viewed_at` is null AND `quote_nudge_sent_at` is null AND policy was shared > 3 days ago
- Shows alert card: "⏰ [Client Name] hasn't opened your quote yet. Send a reminder?"
- Tapping → pre-fills WhatsApp nudge template (see Section 16)
- On send → updates `quote_nudge_sent_at` so alert doesn't repeat

**XP Reward:** +10 XP when client first opens quote (see Section 15)

---

### Screen 7: Auto-Revival Calculator

**Route:** `/tools/revival`
**Purpose:** Calculate late fees and net payable for lapsed policies.

**Input Form:**
- Policy Number (text)
- Policy Start Date (date picker)
- Last Premium Paid Date (date picker)
- Sum Assured (number)
- Premium Amount (number)
- Premium Frequency (dropdown: monthly/quarterly/half-yearly/yearly)

**Calculation Logic (client-side JS):**
```
lapse_months = months between last_paid_date and today
late_fee_rate = 8% per annum (configurable constant)
late_fee = (premium_amount × late_fee_rate × lapse_months) / 12
net_payable = premium_amount + late_fee
```

**Output:**
- Lapse period: X months Y days
- Original Premium: ₹XX,XXX
- Late Fee: ₹X,XXX
- **Net Payable: ₹XX,XXX**
- "Save to Client Record" button → saves as `activity` note
- Disclaimer: "This is an estimate. Final amount subject to LIC office verification."

---

### Screen 8: 1-Click 80C Tax PDF

**Route:** `/client/:id/tax-proof`
**Purpose:** Generate downloadable tax proof PDF for all paid premiums.

**Logic:**
1. Query `payments` table: all records for `client_id` filtered by `financial_year`
2. Financial year selector dropdown (e.g., "2024-25")
3. On "Generate PDF":
   - Use `jsPDF` + `jspdf-autotable`
   - Header: Agent name, license no., client name, PAN, financial year
   - Table: Policy No. | Policy Name | Premium Paid | Payment Date | Receipt No.
   - Total row: Sum of all premiums
   - Footer: "Eligible for 80C deduction under Section 80C of Income Tax Act 1961"
   - Disclaimer: "This is a summary document. Please retain original receipts."
4. `pdf.save('80C_TaxProof_<ClientName>_<FY>.pdf')` → browser download

---

### Screen 9: Digital Visiting Card

**Route:** `/card/:agentSlug` (public-facing, no auth required)
**Purpose:** Agent's public page + lead capture form.

**Public Card UI:**
- Agent photo, full name, license number, phone, email
- "Call Now" button (`tel:` link)
- "WhatsApp Me" button (`https://wa.me/` link)
- QR code of this page URL (generated client-side with `qrcode.react`)

**Lead Capture Form (below card):**
- Fields: Name, Phone, Email (optional), Area of Interest (dropdown: Term Plan / Endowment / ULIP / Child Plan / Health / Other), Message
- Submit → inserts row into `leads` table with `agent_id` + `source: 'visiting_card'`
- Success message: "Thank you! [Agent Name] will contact you shortly."
- Agent sees new leads in Dashboard with "🔴 New Lead" badge

**Agent Setup:**
- Agent sets their `card_slug` in profile settings
- Route auto-generates from name if not set

---

## 6. AI-Powered Features (from PDF)

All AI calls go to **Google Gemini 1.5 Flash** via REST API from the frontend (API key stored in `.env` as `VITE_GEMINI_API_KEY`). For production, route through a Supabase Edge Function to hide the key.

---

### Feature A: AI Call / Voice Summary

**Trigger:** After call wrap-up modal is submitted with notes.

**Flow:**
1. Agent optionally records a voice note (Web Speech API → transcript)
2. OR types call notes manually
3. On save → POST to Gemini API:
   ```
   Prompt: "Summarize this insurance agent's call notes into:
   1. Key client interest
   2. Action required
   3. Follow-up date (if mentioned)
   4. Sentiment (positive/neutral/negative)
   Notes: <agent_notes>"
   ```
4. Response stored in `activities.ai_summary`
5. Displayed in timeline with "✨ AI Summary" badge

---

### Feature B: Automatic Follow-Up Creation (NLP Date Extraction)

**Trigger:** When agent saves a note or call log.

**Flow:**
1. Note text sent to Gemini:
   ```
   Prompt: "Extract follow-up intent from this text.
   Return JSON: { needs_followup: boolean, date: 'YYYY-MM-DD or null', action: string }
   Text: <note_text>"
   ```
2. If `needs_followup: true` → auto-create `follow_ups` record with `auto_created: true`
3. Toast notification: "📅 Follow-up auto-scheduled for [date]"

---

### Feature C: Missed Follow-Up Detector

**Trigger:** On dashboard load (daily check).

**Flow:**
1. Query: `follow_ups` where `due_date < today` AND `status = pending`
2. Surface as banner: "⚠️ X follow-ups may be overdue"
3. Tapping expands list with "Mark Done" and "Reschedule" options
4. Reschedule → date picker → updates `due_date`, keeps `auto_created` flag

---

### Feature D: Smart Natural-Language Search

**Route:** Dashboard search bar.

**Flow:**
1. Agent types: "KYC pending clients" or "callbacks this week" or "September renewals"
2. Input sent to Gemini:
   ```
   Prompt: "Convert this search query to database filters for an insurance CRM.
   Available filters: kyc_status, follow_up_type, due_date_range, policy_status, client_status.
   Return JSON: { filters: {...}, sort: '...' }
   Query: <search_text>"
   ```
3. Returned filters applied to Supabase query
4. Results shown in client list
5. Fallback: plain text search on `clients.full_name` + `clients.phone`

---

### Feature E: Document Completeness Checker

**Trigger:** After KYC document upload.

**Flow:**
1. Required document checklist per policy type (configurable array in code)
2. After OCR extraction → check which expected fields are present
3. Missing fields surfaced: "⚠️ Items to verify: DOB not clearly readable"
4. Agent manually confirms before marking KYC verified

---

### Feature F: Document Mismatch Detector

**Trigger:** After OCR extraction of KYC document.

**Flow:**
1. Compare `extracted_dob` vs. `clients.dob`
2. Compare `extracted_name` vs. `clients.full_name` (fuzzy match, Levenshtein distance)
3. If mismatch → update `kyc_documents.mismatch_flags = { dob: true, name: false }`
4. Show banner: "🔴 Possible mismatch detected — DOB differs. Please verify."
5. App does NOT make final decision — agent reviews

---

### Feature G: Intelligent Policy / PDF Reader

**Route:** `/client/:id/policy/:policyId/read`

**Flow:**
1. Agent opens stored policy PDF
2. PDF text extracted client-side (pdf.js / `pdfjs-dist`)
3. Text sent to Gemini with prompt:
   ```
   "From this insurance policy document, extract:
   - Policy Number, Plan Name, Sum Assured, Premium, Maturity Date,
     Nominee, Exclusions, Surrender Value clause.
   Return as structured JSON."
   ```
4. Extracted data displayed in structured card alongside PDF
5. Agent can ask follow-up questions: "What is the grace period?"
6. Gemini responds grounded in the document text
7. Disclaimer: "AI-extracted summary. Verify with official policy document."

---

### Feature H: Lost / Cold Lead Re-Activation

**Route:** Dashboard → "Cold Leads" tab.

**Logic:**
1. Query: clients where `last activity > 60 days ago` AND `status != converted`
2. Gemini generates a re-engagement note suggestion per client:
   ```
   Prompt: "Suggest a short, friendly re-engagement message for a LIC agent
   to send to a client who was interested in [policy_type] but went cold 3 months ago.
   Keep it under 50 words."
   ```
3. Agent reviews suggestion → taps "Send via WhatsApp" → opens `wa.me` link with pre-filled text
4. On send → creates new `activity` record, updates client `status` to `active`

---

### Feature I: Service Request Tracker

**Route:** `/client/:id/service`

**Ticket Stages:** `Received → Document Pending → Processing → Completed`

**UI:**
- Bootstrap progress stepper
- Each stage shows date + notes
- "Add Update" button → updates status + creates timeline entry
- Claim cases get separate timeline: Request Date → Documents → Last Communication → Pending Action
- App does NOT approve/reject claims

---

### Feature J: Referral Relationship Map

**Route:** `/client/:id/referrals`

**Logic:**
- `clients.referral_from` stores referring client ID
- Visual tree: render with simple recursive React component (or D3.js for demo)
- Each node: client name, policy count
- "Add Referral" → search existing clients → link

---

## 7. PWA & Offline-First Mode

**Goal:** Essential features must work in poor/no connectivity (field work scenario).

### Implementation

**Vite PWA Plugin setup (`vite.config.js`):**
```js
import { VitePWA } from 'vite-plugin-pwa'
export default {
  plugins: [
    VitePWA({
      registerType: 'autoUpdate',
      workbox: {
        globPatterns: ['**/*.{js,css,html,ico,png,svg}'],
        runtimeCaching: [/* Supabase API cache rules */]
      },
      manifest: {
        name: 'Tele-Assist Pro',
        short_name: 'TeleAssist',
        theme_color: '#0d6efd',
        icons: [{ src: '/icon-192.png', sizes: '192x192', type: 'image/png' }]
      }
    })
  ]
}
```

### What Works Offline (IndexedDB via `idb` library):

| Feature | Offline Behaviour |
|---|---|
| Client list | Cached on last sync, readable offline |
| Today's Action Engine | Loaded from IndexedDB |
| Add Note / Call Log | Saved to IndexedDB with `sync_status: 'pending'` |
| Follow-up creation | Saved locally, synced on reconnect |
| Revival Calculator | Fully offline (pure JS calculation) |
| 80C PDF generation | Works offline if payment data is cached |
| KYC Upload | Queued, uploaded on reconnect |

### Sync Queue Logic:
1. Every write operation → first saved to IndexedDB with `{ data, operation, table, timestamp, synced: false }`
2. `navigator.onLine` listener + `sync` event (Background Sync API)
3. On reconnect → iterate pending queue → POST to Supabase → mark `synced: true`
4. Conflict resolution: last-write-wins by timestamp

### Offline Indicator:
- Top banner: "📴 Offline — changes will sync when connected"
- Green banner on reconnect: "✅ Synced X pending changes"

---

## 8. Non-Functional Requirements

| Requirement | Specification |
|---|---|
| Mobile-first | All layouts optimised for 375px–430px screens |
| Performance | Lighthouse score > 85 on mobile |
| Auth Security | Supabase RLS on all tables — agents can only access their own data |
| File Security | Supabase Storage bucket is private; signed URLs with 1-hour expiry for KYC docs |
| OCR Privacy | Tesseract.js runs fully client-side — document images never sent to third-party OCR APIs |
| API Key Safety | Gemini API key in `.env` (VITE_ prefix); for demo: acceptable; for production: Supabase Edge Function proxy |
| Data Isolation | Every table has `agent_id` column; RLS policy: `agent_id = auth.uid()` |
| Error Handling | All Supabase calls wrapped in try/catch; toast notifications for errors |
| Loading States | Skeleton loaders on all data-fetching screens |
| Accessibility | Bootstrap's built-in ARIA attributes; contrast ratio > 4.5:1 |

---

## 9. File & Folder Structure

```
tele-assist-pro/
├── public/
│   ├── icon-192.png
│   ├── icon-512.png
│   └── manifest.json
├── src/
│   ├── main.jsx                    # App entry point
│   ├── App.jsx                     # Router setup
│   ├── supabaseClient.js           # Supabase init
│   ├── geminiClient.js             # Gemini API wrapper
│   │
│   ├── components/                 # Reusable UI components
│   │   ├── Navbar.jsx
│   │   ├── ClientCard.jsx
│   │   ├── FollowUpBanner.jsx
│   │   ├── TimelineItem.jsx
│   │   ├── CallWrapUpModal.jsx
│   │   ├── OfflineBanner.jsx
│   │   ├── AISummaryBadge.jsx
│   │   └── LoadingSkeleton.jsx
│   │
│   ├── pages/                      # One file per route/screen
│   │   ├── Login.jsx               # Screen 1
│   │   ├── Dashboard.jsx           # Screen 2
│   │   ├── ClientProfile.jsx       # Screen 3 (dialer + timeline)
│   │   ├── FamilyPassbook.jsx      # Screen 4
│   │   ├── KYCDropbox.jsx          # Screen 5
│   │   ├── QuoteTracker.jsx        # Screen 6
│   │   ├── QuoteViewer.jsx         # Screen 6 (public)
│   │   ├── RevivalCalculator.jsx   # Screen 7
│   │   ├── TaxProofPDF.jsx         # Screen 8
│   │   ├── VisitingCard.jsx        # Screen 9 (public)
│   │   ├── ServiceTracker.jsx      # AI Feature I
│   │   ├── ReferralMap.jsx         # AI Feature J
│   │   └── ColdLeads.jsx           # AI Feature H
│   │
│   ├── hooks/                      # Custom React hooks
│   │   ├── useAuth.js
│   │   ├── useClients.js
│   │   ├── useFollowUps.js
│   │   ├── useOfflineSync.js       # IndexedDB + sync queue
│   │   └── useOCR.js               # Tesseract.js wrapper
│   │
│   ├── utils/
│   │   ├── gemini.js               # Gemini API prompts
│   │   ├── pdfGenerator.js         # jsPDF helpers
│   │   ├── watermark.js            # Canvas watermark logic
│   │   ├── excelParser.js          # SheetJS bulk import
│   │   ├── revivalCalc.js          # Revival fee calculation
│   │   └── offlineDB.js            # IndexedDB (idb library)
│   │
│   └── styles/
│       └── custom.css              # Bootstrap overrides
│
├── supabase/
│   ├── migrations/
│   │   └── 001_init_schema.sql     # All CREATE TABLE statements
│   └── functions/
│       └── track-quote-view/       # Edge Function for view tracking
│
├── .env                            # VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY, VITE_GEMINI_API_KEY
├── vite.config.js                  # Vite + PWA plugin config
├── package.json
└── README.md
```

---

## 10. Deployment Guide

### Supabase Setup
1. Create project at `supabase.com`
2. Run `supabase/migrations/001_init_schema.sql` in SQL Editor
3. Enable RLS on all tables
4. Add RLS policies: `agent_id = auth.uid()` for all tables
5. Create Storage bucket `kyc-documents` (private) and `policy-pdfs` (private)
6. Copy `Project URL` and `anon key` to `.env`

### Frontend Deployment (Render or Vercel)
```bash
# Build
npm run build

# Render: New Static Site
# Build Command: npm run build
# Publish Directory: dist
# Environment Variables: add all VITE_ keys
```

### Environment Variables Required
```
VITE_SUPABASE_URL=https://xxxx.supabase.co
VITE_SUPABASE_ANON_KEY=eyJ...
VITE_GEMINI_API_KEY=AIza...
```

---

## 11. Future Scope

| Feature | Description |
|---|---|
| Communication History Hub | Official WhatsApp Business API integration for message logging |
| Native Mobile App | React Native / Expo version for deeper phone integration |
| Company System Integration | API bridge to LIC's internal portals (post-hackathon, with LIC permission) |
| Multi-Agent Teams | Team leads can view their agents' dashboards |
| Push Notifications | Web Push for follow-up reminders (Supabase + FCM) |
| Voice-first UI | Full voice command navigation for field agents driving |
| Analytics Dashboard | Conversion rates, policy mix, referral performance |
| Groq/OpenAI upgrade | Swap Gemini for faster/more capable model as usage grows |

---

## 12. Positioning Statement

**What Tele-Assist Pro is:**
An Agent Action & Relationship Assistant that connects scattered conversations, follow-ups, documents, and tasks into one actionable mobile workflow — built around the way LIC agents actually work in the field.

**What it is NOT:**
- A replacement for LIC's internal policy management system
- A claims processing tool
- A financial advice platform

**Target Demo Flow for SIH Judges:**
1. Agent logs in → sees Today's Action Engine with 3 follow-ups + gamified progress bar at top
2. Calls a client → call wrap-up modal appears automatically
3. Types note "Call back Friday" → follow-up auto-created by AI → +15 XP earned → progress bar fills
4. Opens Client 360° timeline → full history visible
5. Client uploads Aadhaar → OCR extracts name/DOB, watermark applied, mismatch detected
6. Generates 80C tax PDF in one click
7. Visits their own digital visiting card → lead capture form → 🔴 real-time toast appears on agent's screen "New lead from Rahul Sharma!"
8. Agent sends quote via WhatsApp template → client opens it → view logged → agent sees "📄 Viewed: 2m 14s on mobile"
9. Goes offline → makes a note → comes back online → sync banner appears
10. Agent hits daily goal → confetti + "Level Up! You're now Level 3 🎖️" toast fires

---

## 13. NEW: Real-Time Lead Notifications

**Trigger:** A visitor submits the Lead Capture Form on the agent's Digital Visiting Card (`/card/:slug`).

### Implementation

**Supabase Realtime subscription** (set up in `Dashboard.jsx` on mount):

```js
// Inside Dashboard.jsx useEffect
const channel = supabase
  .channel('new-leads')
  .on(
    'postgres_changes',
    {
      event: 'INSERT',
      schema: 'public',
      table: 'leads',
      filter: `agent_id=eq.${agentId}`
    },
    (payload) => {
      showToast(`🔴 New Lead: ${payload.new.full_name} is interested in ${payload.new.interest_area}!`);
      playNotificationSound(); // short chime via Web Audio API
      refetchLeads();          // refresh leads list
    }
  )
  .subscribe();

return () => supabase.removeChannel(channel);
```

**Toast Component (Bootstrap):**
- Position: top-right, auto-dismisses after 6 seconds
- Color: red border (`border-danger`)
- Body: Name, interest area, phone number
- Action button: "View Lead →" → navigates to leads list

**Notification Sound:**
- Use Web Audio API to generate a short 2-tone chime (no external audio file needed):
```js
function playNotificationSound() {
  const ctx = new AudioContext();
  [523, 659].forEach((freq, i) => {
    const osc = ctx.createOscillator();
    osc.connect(ctx.destination);
    osc.frequency.value = freq;
    osc.start(ctx.currentTime + i * 0.15);
    osc.stop(ctx.currentTime + i * 0.15 + 0.12);
  });
}
```

**Badge on Nav:**
- Navbar shows "Leads 🔴 2" badge (unread count) until agent opens the leads tab
- Badge count stored in React state, reset on tab visit

**XP Reward:** +20 XP per new lead captured via visiting card (see Section 15)

---

## 14. NEW: Smart Quote Tracker — Enhanced

*(Full spec moved to Screen 6 above — this section contains only the additional data model and nudge logic details)*

### View Event Data Model
Each time a client opens a quote link, a `quote_view_events` row is inserted with:
- `viewed_at` — exact timestamp
- `time_spent_sec` — how long they stayed (posted on exit)
- `device_type` — parsed from `navigator.userAgent`:
  - `/Mobi|Android/i` → `mobile`
  - `/iPad|Tablet/i` → `tablet`
  - else → `desktop`

### Agent Quote Analytics Card (inside Client Profile)
```
┌──────────────────────────────────────┐
│ 📄 Policy Quote — Term Plan 2025     │
│ Shared: 3 days ago via WhatsApp      │
│                                      │
│ 👁  Views: 3    ⏱ Total: 6m 48s     │
│ 📱 Device: Mobile                    │
│                                      │
│ Timeline:                            │
│  • Today 4:32 PM — 2m 14s (mobile)  │
│  • Yesterday 9:11 AM — 3m 20s       │
│  • 2 days ago 6:45 PM — 1m 14s      │
│                                      │
│ [Send Reminder] [Share New Quote]    │
└──────────────────────────────────────┘
```

---

## 15. NEW: Gamified Agent Progress System

**Goal:** Make daily agent actions feel rewarding and build a habit loop. Shows progress visually on the dashboard — not buried in settings.

### Where It Lives
- **Dashboard top section** — persistent progress bar + level badge, always visible
- **Post-action toasts** — XP earned shown immediately after every action
- **Profile page** — full XP history, badge collection, streak calendar

---

### XP Action Table

| Action | XP Earned | Notes |
|---|---|---|
| Log a call (with notes) | +15 XP | Bonus +5 if AI summary generated |
| Complete a follow-up | +20 XP | — |
| Auto follow-up completed (AI-created) | +25 XP | Bonus for acting on AI suggestion |
| Upload KYC document | +10 XP | — |
| KYC verified (no mismatch) | +15 XP | — |
| Add a new client | +10 XP | — |
| Bulk import (Excel) | +30 XP | One-time per import |
| Generate 80C Tax PDF | +10 XP | — |
| Client opens shared quote | +10 XP | Triggered by view event |
| New lead via visiting card | +20 XP | Triggered by Realtime insert |
| Complete all today's follow-ups | +50 XP | Daily goal bonus |
| Login streak (daily) | +5 XP/day | Compounds: +10 after 7 days, +20 after 30 days |
| First action of each type | +25 XP | One-time "First Call", "First KYC" etc. |

---

### Level System

| Level | Name | XP Required |
|---|---|---|
| 1 | Rookie Agent | 0 |
| 2 | Active Advisor | 150 |
| 3 | Rising Star | 400 |
| 4 | Policy Expert | 800 |
| 5 | Field Champion | 1,500 |
| 6 | Senior Leader | 2,500 |
| 7 | LIC Pro | 4,000 |
| 8 | Elite Agent | 6,000 |

---

### Dashboard Progress Bar UI

```
┌─────────────────────────────────────────────┐
│  🎖️  Level 3 — Rising Star                  │
│                                             │
│  [████████████░░░░░░░░]  640 / 800 XP       │
│  160 XP to Level 4 — Policy Expert          │
│                                             │
│  🔥 Streak: 5 days   🏅 Badges: 4          │
└─────────────────────────────────────────────┘
```

**Implementation:**
- Bootstrap `progress` component: `style={{ width: `${(xp % levelThreshold / levelThreshold) * 100}%` }}`
- Color: blue → green as level increases
- Animates on XP gain: CSS transition `width 0.6s ease`
- Level badge: Bootstrap `badge bg-primary` next to agent name in navbar

---

### "Daily Goal" Mechanic

**Daily Goal** = Complete all of today's pending follow-ups.

- Progress shown as: "✅ 2 / 5 follow-ups done today"
- When all done → confetti burst (use `canvas-confetti` npm package, ~3KB)
- Toast: "🎉 Daily Goal Complete! +50 XP — You're on a 5-day streak!"
- Confetti fires once per day (stored in `localStorage` with date key)

```js
import confetti from 'canvas-confetti';

function fireGoalConfetti() {
  confetti({
    particleCount: 120,
    spread: 80,
    origin: { y: 0.6 },
    colors: ['#0d6efd', '#198754', '#ffc107']
  });
}
```

---

### Badge System

| Badge | Trigger |
|---|---|
| 🏆 First Call | First call logged |
| 📋 Note Taker | 10 calls with AI summaries |
| ⚡ Follow-up Ninja | 7 consecutive days of zero missed follow-ups |
| 🔍 KYC Master | 20 KYC documents processed |
| 🌟 Lead Magnet | 10 leads captured via visiting card |
| 🔥 On Fire | 7-day login streak |
| 💼 Policy Pro | 50 policies added |
| 👨‍👩‍👧 Family First | 10 family passbooks created |
| 🧠 AI Ally | 25 AI summaries generated |
| 🚀 Level Up x3 | Reached Level 4 |

**Badge Display:**
- Profile page: grid of all badges, greyed out until earned
- Earned badges show tooltip with "Earned on [date]"
- New badge → special toast: "🏅 New Badge Unlocked: Follow-up Ninja!"
- Badges stored in `agents.badges` text[] column

---

### XP Award Function (utility)

```js
// utils/xp.js
import { supabase } from '../supabaseClient';

export async function awardXP(agentId, action, description) {
  const XP_TABLE = {
    call_logged: 15,
    call_with_ai_summary: 20,
    followup_done: 20,
    followup_done_ai: 25,
    kyc_uploaded: 10,
    kyc_verified: 15,
    client_added: 10,
    bulk_import: 30,
    tax_pdf_generated: 10,
    quote_viewed_by_client: 10,
    lead_captured: 20,
    daily_goal: 50,
    login_streak: 5,
  };

  const xp = XP_TABLE[action] || 0;

  // Insert XP log entry
  await supabase.from('agent_xp_log').insert({
    agent_id: agentId,
    action,
    xp_earned: xp,
    description
  });

  // Increment agent total XP
  const { data: agent } = await supabase
    .from('agents')
    .select('xp_points, level')
    .eq('id', agentId)
    .single();

  const newXP = agent.xp_points + xp;
  const newLevel = calculateLevel(newXP); // compare against level thresholds

  await supabase
    .from('agents')
    .update({ xp_points: newXP, level: newLevel })
    .eq('id', agentId);

  return { xp, newXP, newLevel, leveledUp: newLevel > agent.level };
}
```

**Call `awardXP()` after every relevant action** — it runs in the background and doesn't block the UI.

---

### Streak Logic

```js
// On every login, in useAuth.js:
const today = new Date().toISOString().split('T')[0];
const lastActive = agent.last_active_date;

if (lastActive === yesterday) {
  // Continuing streak
  newStreak = agent.streak_days + 1;
} else if (lastActive === today) {
  // Already logged in today, no change
  newStreak = agent.streak_days;
} else {
  // Streak broken
  newStreak = 1;
}

await supabase.from('agents')
  .update({ streak_days: newStreak, last_active_date: today })
  .eq('id', agentId);
```

---

## 16. NEW: WhatsApp Message Templates

**Purpose:** Agent picks a template → it auto-fills with client/policy data → opens `wa.me` link. No WhatsApp Business API needed — uses the free `wa.me` URL scheme with `text=` param.

### Template Engine (utility)

```js
// utils/whatsappTemplates.js

export const TEMPLATES = {
  renewal_reminder: {
    label: '🔔 Renewal Reminder',
    icon: '🔔',
    useCases: 'Use 7–14 days before premium due date',
    template: (data) =>
      `Hello ${data.clientName}! 🙏\n\nThis is a friendly reminder that your *${data.policyName}* premium of *₹${data.premiumAmount}* is due on *${data.dueDate}*.\n\nTimely payment ensures your policy stays active and your family stays protected. 💙\n\nFor any help, feel free to call me.\n\n— ${data.agentName}\nLIC Agent | ${data.agentPhone}`
  },

  document_request: {
    label: '📄 Document Request',
    icon: '📄',
    useCases: 'Use after KYC is flagged incomplete',
    template: (data) =>
      `Dear ${data.clientName},\n\nTo proceed with your *${data.policyName}* application, I need the following documents:\n\n📌 ${data.docList}\n\nPlease upload them here (secure, confidential):\n${data.kycLink}\n\nDocuments are watermarked for LIC use only. 🔒\n\n— ${data.agentName} | ${data.agentPhone}`
  },

  quote_followup: {
    label: '📊 Quote Follow-Up',
    icon: '📊',
    useCases: 'Use after sharing policy PDF',
    template: (data) =>
      `Hi ${data.clientName}! 👋\n\nI shared a policy quote with you recently. Here's the link in case you missed it:\n${data.quoteLink}\n\nHappy to walk you through it on a quick call! Let me know a good time. ⏰\n\n— ${data.agentName}\nLIC Agent | ${data.agentPhone}`
  },

  quote_nudge: {
    label: '⏰ Quote Not Opened Nudge',
    icon: '⏰',
    useCases: 'Auto-suggested when quote not opened in 3 days',
    template: (data) =>
      `Hello ${data.clientName}! 😊\n\nJust checking in — I had shared a *${data.policyName}* quote for you a few days ago. Here it is again:\n${data.quoteLink}\n\nIt only takes 2 minutes to review. Do let me know if you have any questions! 🙏\n\n— ${data.agentName} | ${data.agentPhone}`
  },

  cold_reactivation: {
    label: '🤝 Re-connect',
    icon: '🤝',
    useCases: 'Use for cold/lost leads older than 60 days',
    template: (data) =>
      `Hi ${data.clientName}! Hope you're doing well. 🙏\n\nWe had spoken about *${data.interestArea}* some time ago. There are some new plans available now that might be a great fit for you.\n\nWould love to catch up for 5 minutes whenever convenient! 😊\n\n— ${data.agentName}\nLIC Agent | ${data.agentPhone}`
  },

  birthday_greeting: {
    label: '🎂 Birthday Greeting',
    icon: '🎂',
    useCases: 'Auto-suggested on client\'s birthday',
    template: (data) =>
      `Dear ${data.clientName},\n\n🎂 Wishing you a very Happy Birthday! 🎉\n\nMay this year bring you good health, happiness, and prosperity for you and your family. 🌟\n\nAs your LIC advisor, I'm always here for you.\n\n— ${data.agentName}\nLIC Agent | ${data.agentPhone}`
  },

  revival_reminder: {
    label: '⚠️ Policy Revival Alert',
    icon: '⚠️',
    useCases: 'Use for lapsed policies with revival calculator result',
    template: (data) =>
      `Dear ${data.clientName},\n\n⚠️ Your policy *${data.policyName}* has lapsed. But the good news — it can still be *revived*!\n\nEstimated revival amount: *₹${data.netPayable}*\n(includes late fee of ₹${data.lateFee})\n\nDo reach out soon — revival window may close. I'm here to help! 🤝\n\n— ${data.agentName}\nLIC Agent | ${data.agentPhone}`
  }
};

export function buildWhatsAppURL(phone, templateKey, data) {
  const template = TEMPLATES[templateKey];
  if (!template) return null;
  const message = template.template(data);
  const encoded = encodeURIComponent(message);
  const cleanPhone = phone.replace(/\D/g, '');
  return `https://wa.me/91${cleanPhone}?text=${encoded}`;
}
```

### Template Picker UI (inside Call Wrap-Up Modal + Client Profile)

```
┌─────────────────────────────────────────┐
│  📲 Send WhatsApp Message               │
│                                         │
│  Choose template:                       │
│  ┌────────────────────────────────┐     │
│  │ 🔔 Renewal Reminder        [→] │     │
│  │ 📄 Document Request        [→] │     │
│  │ 📊 Quote Follow-Up         [→] │     │
│  │ 🤝 Re-connect              [→] │     │
│  │ 🎂 Birthday Greeting       [→] │     │
│  │ ⚠️  Policy Revival Alert   [→] │     │
│  └────────────────────────────────────┘ │
│                                         │
│  Preview:                               │
│  ┌────────────────────────────────┐     │
│  │ Hello Ramesh! 🙏               │     │
│  │ Your Term Plan 936 premium...  │     │
│  └────────────────────────────────┘     │
│                                         │
│         [Open in WhatsApp ↗]           │
└─────────────────────────────────────────┘
```

**Auto-suggestions:**
- If `client.dob` = today → birthday template pre-selected
- If quote not opened in 3 days → nudge template pre-selected
- If policy status = lapsed → revival alert template pre-selected
- If KYC status = pending → document request template pre-selected

**XP Reward:** No direct XP for sending (can't verify delivery), but follow-up completion awards XP when the resulting follow-up is marked done.

---

### Updated File Structure (additions only)

```
src/
├── components/
│   ├── RealTimeLeadToast.jsx       # NEW: Supabase Realtime listener + toast
│   ├── XPProgressBar.jsx           # NEW: Level + progress bar + streak
│   ├── BadgeGrid.jsx               # NEW: Badge collection display
│   ├── WhatsAppTemplatePicker.jsx  # NEW: Template selector + preview
│   └── ConfettiTrigger.jsx         # NEW: canvas-confetti wrapper
├── utils/
│   ├── xp.js                       # NEW: awardXP() + calculateLevel()
│   ├── whatsappTemplates.js        # NEW: All 7 templates + buildWhatsAppURL()
│   └── streak.js                   # NEW: Streak calculation logic
```

---

*PRD Version 1.1 | Tele-Assist Pro | SIH Prototype*
*Stack: React + Vite + Bootstrap 5 + Supabase + Gemini 1.5 Flash + Tesseract.js + jsPDF + canvas-confetti*
*New in v1.1: Real-Time Lead Notifications, Enhanced Quote Tracker, Gamified Progress System, WhatsApp Templates*
