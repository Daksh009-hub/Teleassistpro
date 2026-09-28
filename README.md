# Tele-Assist Pro — LIC Agent Action & Relationship Assistant
### SIH Prototype | Mobile-First Progressive Web App (PWA)

Tele-Assist Pro is a mobile-first action and relationship assistant built specifically for **Life Insurance Corporation of India (LIC)** field agents. It consolidates daily phone calls, client follow-ups, KYC document OCR scanning, quote view tracking, family passbooks, revival calculations, 80C tax proof certificates, and gamification into a single, intuitive field assistant.

---

## 🚀 Key Features Built to PRD Specification

1. **Today's Action Engine & Mobile CRM Dashboard (`/dashboard`)**:
   - Priority badges: `Follow-ups`, `Callbacks`, `Docs Pending`, and `Overdue`.
   - **Natural Language AI Search** (e.g. *"KYC pending clients"*, *"overdue renewals"*).
   - Missed Follow-up Detector banner with one-click rescheduling.
   - Excel / CSV bulk client & policy import using **SheetJS**.
   - 3-day unopened quote nudge alerts.

2. **In-App Dialer & Call Wrap-Up Flow (`/client/:id`)**:
   - Native dialer trigger (`tel:`) with background call duration tracking via `visibilitychange`.
   - Automatic Call Wrap-Up modal on return with **Web Speech API Voice Notes**, **Gemini AI Call Summaries**, and **NLP Date Extraction**.
   - Quick Field Note with automatic follow-up creation.

3. **Secure KYC Drop-Box & Canvas Watermarking (`/kyc/:clientId`)**:
   - Client-side **Tesseract.js OCR** extracting Name, DOB, and identity numbers.
   - Client-side `<canvas>` watermarking overlay (*"Only for LIC | Confidential"*).
   - **Mismatch Detector (Feature F)** comparing OCR extracted DOB vs. client record.
   - **Completeness Checker (Feature E)** validating all mandatory fields.

4. **Enhanced Smart Quote Tracker (`/quote/:policyId` & `/view/:trackId`)**:
   - Unique shareable quote links for clients.
   - Client viewing session duration tracking (seconds spent) & device detection (Mobile/Desktop).
   - In-app **AI Policy Reader & Clause Q&A (Feature G)**.
   - Automated 3-day unopened nudge alerts via WhatsApp.

5. **Gamified Agent Progress System (PRD Section 15)**:
   - Persistent top progress bar with Levels 1–8 (*Rookie Agent* to *Elite Agent*).
   - XP Action Engine (+15 XP calls, +20 XP follow-ups, +10 XP KYC, +20 XP leads, +50 XP daily goal).
   - 10 Unlocked Badges collection grid (`/profile/badges`).
   - Daily active login streaks and **`canvas-confetti`** celebrations.

6. **Real-Time Lead Notifications & Digital Visiting Card (`/card/:agentSlug`)**:
   - Public responsive card with QR code (`qrcode.react`), direct call, and WhatsApp links.
   - Lead capture form connected to **Supabase Realtime** with **Web Audio API 2-tone chime** and instant agent screen toasts.

7. **Auto-Revival Calculator (`/tools/revival`)**:
   - 8% p.a. late fee calculation for lapsed policies with one-click save to client timeline.

8. **1-Click 80C Tax Proof PDF (`/client/:id/tax-proof`)**:
   - Instant downloadable annual premium certificate using **jsPDF** & **jspdf-autotable**.

9. **WhatsApp Message Template Engine (PRD Section 16)**:
   - 7 pre-configured templates with variable interpolation and 1-click `wa.me` links.

10. **Family Passbook (`/client/:id/family`) & Relationship Map (`/client/:id/referrals`)**:
    - Group family policies under family heads.
    - Interactive visual tree of client referral networks.

11. **PWA & Offline-First Mode**:
    - IndexedDB local storage (`idb`) with background synchronization queue and offline banners.

---

## 🛠️ Tech Stack

- **Frontend**: React 18, Vite 5, React Router v6, Bootstrap 5, Bootstrap Icons.
- **Backend & Database**: Supabase (PostgreSQL, Supabase Auth, Storage, Realtime).
- **AI / LLM**: Google Gemini 1.5 Flash (with built-in heuristic fallbacks).
- **Client-Side OCR**: Tesseract.js.
- **Client-Side PDF**: jsPDF + jspdf-autotable.
- **PWA & Offline**: vite-plugin-pwa, IndexedDB (`idb`).
- **Gamification**: canvas-confetti, Web Audio API sound synthesis.

---

## ⚡ Quick Start Guide

### 1. Install Dependencies
```bash
npm install
```

### 2. Configure Environment (Optional)
Copy `.env.example` to `.env`:
```env
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-supabase-anon-key
VITE_GEMINI_API_KEY=your-gemini-api-key
```
*(Note: Tele-Assist Pro comes with full offline & instant demo mode pre-configured in IndexedDB, so the app works seamlessly even without API keys!)*

### 3. Run Development Server
```bash
npm run dev
```

### 4. Build Production Bundle
```bash
npm run build
```

---

## 🗄️ Database Setup (Supabase)

To link with a live Supabase project:
1. Open SQL Editor in your Supabase Dashboard.
2. Run `supabase/migrations/001_init_schema.sql` to generate all tables and RLS security policies.
3. Run `supabase/seed_data.sql` to populate sample clients, policies, and follow-ups.

---

## 🏆 Demo Walkthrough for SIH Evaluators

1. **Login**: Click *"Quick Demo Login (Rajesh Verma)"* on the `/login` screen.
2. **Action Engine**: Check the top badges and the gamified level progress bar.
3. **In-App Call**: Tap *"Call Client"* on Ramesh Kumar -> return to tab -> Call Wrap-Up modal appears -> Click *"Generate AI Call Summary"* -> Click *"Save Call & Earn +15 XP"*.
4. **KYC OCR**: Navigate to KYC Drop-Box -> Upload a sample Aadhaar/PAN photo -> Observe automatic canvas watermarking and DOB mismatch detector.
5. **Smart Quote Tracker**: Go to `/quote/aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa` -> Copy link or open `/view/quote-sharma-936` -> Review interactive quote with Ask AI Q&A.
6. **Realtime Lead Capture**: Open `/card/rajesh-verma` in a separate window -> Submit consultation form -> Listen for the audio chime and observe the real-time *"🔴 New Lead Captured"* toast on the agent screen.
7. **80C Tax PDF**: Go to Ramesh Kumar's profile -> Click *"80C Tax Proof"* -> Click *"Generate & Download 80C Tax PDF"*.
8. **Revival Calculator**: Go to `/tools/revival` -> Review 8% late fee breakdown -> Send WhatsApp revival reminder.
