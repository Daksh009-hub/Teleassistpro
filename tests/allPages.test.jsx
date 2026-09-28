import React from 'react';
import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import 'fake-indexeddb/auto';

import { AuthProvider } from '../src/context/AuthContext';
import { GamificationProvider } from '../src/context/GamificationContext';
import { OfflineProvider } from '../src/context/OfflineContext';
import { initializeIndexedDB, getAllFromStore, deleteFromStore } from '../src/utils/offlineDB';

import { Login } from '../src/pages/Login';
import { Dashboard } from '../src/pages/Dashboard';
import { ClientProfile } from '../src/pages/ClientProfile';
import { FamilyPassbook } from '../src/pages/FamilyPassbook';
import { KYCDropbox } from '../src/pages/KYCDropbox';
import { QuoteTracker } from '../src/pages/QuoteTracker';
import { QuoteViewer } from '../src/pages/QuoteViewer';
import { RevivalCalculator } from '../src/pages/RevivalCalculator';
import { TaxProofPDF } from '../src/pages/TaxProofPDF';
import { VisitingCard } from '../src/pages/VisitingCard';
import { ServiceTracker } from '../src/pages/ServiceTracker';
import { ReferralMap } from '../src/pages/ReferralMap';
import { ColdLeads } from '../src/pages/ColdLeads';
import { Leads } from '../src/pages/Leads';
import { BadgesProfile } from '../src/pages/BadgesProfile';
import { SettingsConfig } from '../src/pages/SettingsConfig';

function renderWithProviders(ui, { route = '/' } = {}) {
  return render(
    <MemoryRouter initialEntries={[route]}>
      <AuthProvider>
        <GamificationProvider>
          <OfflineProvider>
            {ui}
          </OfflineProvider>
        </GamificationProvider>
      </AuthProvider>
    </MemoryRouter>
  );
}

describe('Full End-to-End Screen Testing Suite', () => {
  beforeEach(async () => {
    await initializeIndexedDB();
  });

  it('Screen 1: Login Page renders and login form functions', async () => {
    renderWithProviders(<Login />, { route: '/login' });
    expect(screen.getByText(/Agent Login/i)).toBeTruthy();
    expect(screen.getByRole('button', { name: /Sign In to Assistant/i })).toBeTruthy();

    const emailInput = screen.getByPlaceholderText(/agent@licindia.com/i);
    const passInput = screen.getByPlaceholderText(/••••••••/i);
    fireEvent.change(emailInput, { target: { value: 'rajesh.lic@gmail.com' } });
    fireEvent.change(passInput, { target: { value: 'lic123456' } });

    const submitBtn = screen.getByRole('button', { name: /Sign In to Assistant/i });
    fireEvent.click(submitBtn);
  });

  it('Screen 2: Dashboard Page renders action engine, clients, and search bar', async () => {
    renderWithProviders(<Dashboard />, { route: '/dashboard' });
    await waitFor(() => {
      expect(screen.getByText("Today's Action Engine")).toBeTruthy();
      expect(screen.getByPlaceholderText(/Try "KYC pending clients"/i)).toBeTruthy();
      expect(screen.getByText(/Import Excel \/ CSV/i)).toBeTruthy();
    });
  });

  it('Screen 2: Dashboard Page adds client with policy through FAB modal', async () => {
    renderWithProviders(<Dashboard />, { route: '/dashboard' });
    await waitFor(() => {
      expect(screen.getByTitle('Add Client')).toBeTruthy();
    });

    // Click FAB button
    fireEvent.click(screen.getByTitle('Add Client'));

    // Modal should be visible
    await waitFor(() => {
      expect(screen.getByText(/Add Client & Policy/i)).toBeTruthy();
      expect(screen.getByText(/Policy Details \*/i)).toBeTruthy();
    });

    // Fill client inputs
    fireEvent.change(screen.getByPlaceholderText(/e\.g\. Sunil Mehta/i), { target: { value: 'Deepak Joshi' } });
    fireEvent.change(screen.getByPlaceholderText(/98XXXXXXXX/i), { target: { value: '9812345678' } });

    // Submit form
    const saveBtn = screen.getByRole('button', { name: /Save Client & Policy/i });
    fireEvent.click(saveBtn);

    // Verify client and policy were added in database
    await waitFor(async () => {
      const allClients = await getAllFromStore('clients');
      const deepak = allClients.find(c => c.phone.includes('9812345678'));
      expect(deepak).toBeTruthy();

      const allPolicies = await getAllFromStore('policies');
      const deepakPol = allPolicies.find(p => p.client_id === deepak.id);
      expect(deepakPol).toBeTruthy();
    });
  });

  it('Screen 3: Client Profile renders 360 overview and action tabs', async () => {
    renderWithProviders(
      <Routes>
        <Route path="/client/:id" element={<ClientProfile />} />
      </Routes>,
      { route: '/client/11111111-1111-1111-1111-111111111111' }
    );

    await waitFor(() => {
      expect(screen.getAllByText(/Ramesh Kumar Sharma/i).length).toBeGreaterThan(0);
      expect(screen.getByText(/Family Passbook/i)).toBeTruthy();
      expect(screen.getByText(/KYC Drop-Box/i)).toBeTruthy();
      expect(screen.getByText(/80C Tax Proof/i)).toBeTruthy();
      expect(screen.getByText(/Quick Note/i)).toBeTruthy();
      expect(screen.getByText(/Relationship Timeline/i)).toBeTruthy();
      expect(screen.getAllByText(/Delete Client/i).length).toBeGreaterThan(0);
    });
  });

  it('Screen 4: Family Passbook renders consolidated portfolio', async () => {
    renderWithProviders(
      <Routes>
        <Route path="/client/:id/family" element={<FamilyPassbook />} />
      </Routes>,
      { route: '/client/11111111-1111-1111-1111-111111111111/family' }
    );

    await waitFor(() => {
      expect(screen.getAllByText(/Family Passbook/i).length).toBeGreaterThan(0);
      expect(screen.getByText(/Combined Sum Assured/i)).toBeTruthy();
      expect(screen.getByText(/Annual Family Premium/i)).toBeTruthy();
    });
  });

  it('Screen 5: Secure KYC Drop-Box renders upload and OCR interface', async () => {
    renderWithProviders(
      <Routes>
        <Route path="/kyc/:clientId" element={<KYCDropbox />} />
      </Routes>,
      { route: '/kyc/11111111-1111-1111-1111-111111111111' }
    );

    await waitFor(() => {
      expect(screen.getByText(/Secure KYC Drop-Box/i)).toBeTruthy();
      expect(screen.getByText(/Aadhaar Card/i)).toBeTruthy();
      expect(screen.getByText(/PAN Card/i)).toBeTruthy();
    });
  });

  it('Screen 6: Smart Quote Tracker and Quote Viewer render engagement metrics', async () => {
    renderWithProviders(
      <Routes>
        <Route path="/quote/:policyId" element={<QuoteTracker />} />
      </Routes>,
      { route: '/quote/aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa' }
    );

    await waitFor(() => {
      expect(screen.getByText(/Smart Quote Tracker/i)).toBeTruthy();
      expect(screen.getByText(/Total Opens/i)).toBeTruthy();
      expect(screen.getByText(/Time Spent/i)).toBeTruthy();
      expect(screen.getByText(/Share Quote via WhatsApp/i)).toBeTruthy();
    });
  });

  it('Screen 6 Public: Quote Viewer renders proposal highlights and AI Q&A', async () => {
    renderWithProviders(
      <Routes>
        <Route path="/view/:trackId" element={<QuoteViewer />} />
      </Routes>,
      { route: '/view/quote-sharma-936' }
    );

    await waitFor(() => {
      expect(screen.getByText(/Life Insurance Corporation of India/i)).toBeTruthy();
      expect(screen.getByText(/Ask AI About This Policy/i)).toBeTruthy();
      expect(screen.getByText(/Guaranteed Life Cover/i)).toBeTruthy();
    });
  });

  it('Screen 7: Auto-Revival Calculator renders formula breakdown and WhatsApp reminder', async () => {
    renderWithProviders(<RevivalCalculator />, { route: '/tools/revival' });
    expect(screen.getByText(/Auto-Revival Calculator/i)).toBeTruthy();
    expect(screen.getByText(/Estimated Net Payable/i)).toBeTruthy();
    expect(screen.getByText(/Send WhatsApp Alert/i)).toBeTruthy();
  });

  it('Screen 8: 1-Click 80C Tax Proof PDF renders certificate table', async () => {
    renderWithProviders(
      <Routes>
        <Route path="/client/:id/tax-proof" element={<TaxProofPDF />} />
      </Routes>,
      { route: '/client/11111111-1111-1111-1111-111111111111/tax-proof' }
    );

    await waitFor(() => {
      expect(screen.getByText(/Income Tax Exemption Certificate/i)).toBeTruthy();
      expect(screen.getByText(/Generate & Download 80C Tax PDF/i)).toBeTruthy();
    });
  });

  it('Screen 9: Digital Visiting Card renders public profile and lead capture form', async () => {
    renderWithProviders(
      <Routes>
        <Route path="/card/:agentSlug" element={<VisitingCard />} />
      </Routes>,
      { route: '/card/rajesh-verma' }
    );

    await waitFor(() => {
      expect(screen.getAllByText(/Rajesh Verma/i).length).toBeGreaterThan(0);
      expect(screen.getByText(/Request Free Policy Consultation/i)).toBeTruthy();
      expect(screen.getByText(/Submit Consultation Request/i)).toBeTruthy();
    });
  });

  it('Feature I: Service Request Tracker renders stepper stages', async () => {
    renderWithProviders(
      <Routes>
        <Route path="/client/:id/service" element={<ServiceTracker />} />
      </Routes>,
      { route: '/client/11111111-1111-1111-1111-111111111111/service' }
    );

    await waitFor(() => {
      expect(screen.getByText(/Service & Claim Tracker/i)).toBeTruthy();
      expect(screen.getByText(/\+ New Ticket/i)).toBeTruthy();
    });
  });

  it('Feature J: Referral Map renders visual tree', async () => {
    renderWithProviders(
      <Routes>
        <Route path="/client/:id/referrals" element={<ReferralMap />} />
      </Routes>,
      { route: '/client/11111111-1111-1111-1111-111111111111/referrals' }
    );

    await waitFor(() => {
      expect(screen.getAllByText(/Referral Network/i).length).toBeGreaterThan(0);
      expect(screen.getByText(/\+ Link Referred Client/i)).toBeTruthy();
    });
  });

  it('Feature H: Cold Leads renders re-engagement AI suggestions', async () => {
    renderWithProviders(<ColdLeads />, { route: '/cold-leads' });
    await waitFor(() => {
      expect(screen.getByText(/Cold Lead Re-Activation/i)).toBeTruthy();
    });
  });

  it('Section 15: Badges Profile renders Level summary and badges grid', async () => {
    renderWithProviders(<BadgesProfile />, { route: '/profile/badges' });
    await waitFor(() => {
      expect(screen.getByText(/Agent Gamification Hub/i)).toBeTruthy();
      expect(screen.getByText(/Agent Badges & Achievements/i)).toBeTruthy();
      expect(screen.getByText(/Recent XP Activity Log/i)).toBeTruthy();
    });
  });

  it('Settings: SettingsConfig renders profile and settings fields', async () => {
    renderWithProviders(<SettingsConfig />, { route: '/settings' });
    await waitFor(() => {
      expect(screen.getByText(/Agent Settings/i)).toBeTruthy();
      expect(screen.getByText(/Logout/i)).toBeTruthy();
    });
  });

  it('Leads: Leads page renders inquiries and buttons work properly', async () => {
    renderWithProviders(<Leads />, { route: '/leads' });
    await waitFor(() => {
      expect(screen.getByText(/Digital Card Leads/i)).toBeTruthy();
      expect(screen.getByText(/My Card/i)).toBeTruthy();
      expect(screen.getByText(/Rahul Sharma/i)).toBeTruthy();
    });

    // Test Call and WhatsApp buttons exist
    const callBtns = screen.getAllByRole('button', { name: /Call/i });
    expect(callBtns.length).toBeGreaterThan(0);
    fireEvent.click(callBtns[0]);

    const waBtns = screen.getAllByRole('button', { name: /WhatsApp/i });
    expect(waBtns.length).toBeGreaterThan(0);
    fireEvent.click(waBtns[0]);

    // Test Convert to Client button opens policy modal
    const convertBtn = screen.getByRole('button', { name: /Convert to Client/i });
    expect(convertBtn).toBeTruthy();
    fireEvent.click(convertBtn);

    // Modal should be visible
    await waitFor(() => {
      expect(screen.getByText(/Add Policy & Convert Lead/i)).toBeTruthy();
    });

    // Submit policy form to add policy and convert client
    const savePolicyBtn = screen.getByRole('button', { name: /Save Policy & Add Client/i });
    expect(savePolicyBtn).toBeTruthy();
    fireEvent.click(savePolicyBtn);

    await waitFor(() => {
      expect(screen.getByText(/Converted Rahul Sharma to Client/i)).toBeTruthy();
    });

    // Verify client was created in database
    const clients = await getAllFromStore('clients');
    const rahulClient = clients.find(c => c.phone.includes('9988776655'));
    expect(rahulClient).toBeTruthy();

    // Verify policy was created in database linked to client
    const policies = await getAllFromStore('policies');
    const rahulPolicy = policies.find(p => p.client_id === rahulClient.id);
    expect(rahulPolicy).toBeTruthy();

    // Delete client from database (simulating deleting from Client Profile)
    await deleteFromStore('clients', rahulClient.id);

    // Re-render Leads page: "Convert to Client" button should automatically reappear!
    renderWithProviders(<Leads />, { route: '/leads' });
    await waitFor(() => {
      expect(screen.getAllByRole('button', { name: /Convert to Client/i }).length).toBeGreaterThan(0);
    });
  });
});
