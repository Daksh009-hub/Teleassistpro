import React from 'react';
import { describe, it, expect } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { ActionEngineCard } from '../src/components/ActionEngineCard';
import { XPProgressBar } from '../src/components/XPProgressBar';
import { WhatsAppTemplatePicker } from '../src/components/WhatsAppTemplatePicker';
import { BottomNav } from '../src/components/BottomNav';
import { AuthProvider } from '../src/context/AuthContext';
import { GamificationProvider } from '../src/context/GamificationContext';
import { BrowserRouter } from 'react-router-dom';
import { safeSetItem } from '../src/utils/storage';
import { initializeIndexedDB } from '../src/utils/offlineDB';
import 'fake-indexeddb/auto';

describe('UI Components Integration Tests', () => {
  beforeEach(async () => {
    safeSetItem('mock_auth_session', JSON.stringify({
      user: {
        id: '00000000-0000-0000-0000-000000000001',
        email: 'rajesh.lic@gmail.com',
        user_metadata: { full_name: 'Rajesh Verma' }
      }
    }));
    await initializeIndexedDB();
  });
  it('renders ActionEngineCard with correct badges and filter callback', () => {
    let selected = null;
    render(
      <ActionEngineCard
        followUpsCount={3}
        callbacksCount={2}
        docsPendingCount={1}
        missedCount={1}
        activeFilter="all"
        onSelectFilter={(f) => { selected = f; }}
      />
    );

    expect(screen.getByText("Today's Action Engine")).toBeTruthy();
    expect(screen.getByText('Follow-ups')).toBeTruthy();
    expect(screen.getByText('3')).toBeTruthy();
    expect(screen.getByText('2')).toBeTruthy();

    const callbackBtn = screen.getByText('Callbacks');
    fireEvent.click(callbackBtn);
    expect(selected).toBe('callback');
  });

  it('renders WhatsAppTemplatePicker with template preview and selection', () => {
    render(
      <BrowserRouter>
        <AuthProvider>
          <GamificationProvider>
            <WhatsAppTemplatePicker
              client={{ full_name: 'Vikram Malhotra', phone: '9833445566' }}
              policy={{ policy_name: 'LIC Jeevan Umang', premium_amount: 72000 }}
              defaultTemplate="renewal_reminder"
            />
          </GamificationProvider>
        </AuthProvider>
      </BrowserRouter>
    );

    expect(screen.getByText('Send WhatsApp Message')).toBeTruthy();
    expect(screen.getByText('Renewal Reminder')).toBeTruthy();
    expect(screen.getByText(/WhatsApp Web/i)).toBeTruthy();
    expect(screen.getByText(/WhatsApp App/i)).toBeTruthy();
  });

  it('renders BottomNav with Leads tab right after Home', async () => {
    render(
      <BrowserRouter>
        <AuthProvider>
          <BottomNav />
        </AuthProvider>
      </BrowserRouter>
    );

    const items = await screen.findAllByRole('link');
    const itemTexts = items.map(el => el.textContent);
    expect(itemTexts[0]).toContain('Home');
    expect(itemTexts[1]).toContain('Leads');
  });
});
