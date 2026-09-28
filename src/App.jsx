import React from 'react';
import { Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { useAuth } from './context/AuthContext';
import { Navbar } from './components/Navbar';
import { BottomNav } from './components/BottomNav';
import { OfflineBanner } from './components/OfflineBanner';
import { RealTimeLeadToast } from './components/RealTimeLeadToast';
import { XPToastContainer } from './components/XPProgressBar';

import { Login } from './pages/Login';
import { Dashboard } from './pages/Dashboard';
import { ClientProfile } from './pages/ClientProfile';
import { FamilyPassbook } from './pages/FamilyPassbook';
import { KYCDropbox } from './pages/KYCDropbox';
import { QuoteTracker } from './pages/QuoteTracker';
import { QuoteViewer } from './pages/QuoteViewer';
import { RevivalCalculator } from './pages/RevivalCalculator';
import { TaxProofPDF } from './pages/TaxProofPDF';
import { VisitingCard } from './pages/VisitingCard';
import { ServiceTracker } from './pages/ServiceTracker';
import { ReferralMap } from './pages/ReferralMap';
import { ColdLeads } from './pages/ColdLeads';
import { Leads } from './pages/Leads';
import { BadgesProfile } from './pages/BadgesProfile';
import { SettingsConfig } from './pages/SettingsConfig';

export function App() {
  const { agent, loading } = useAuth();
  const location = useLocation();

  // Public routes without navbar/bottom nav framing
  const isPublicRoute =
    location.pathname.startsWith('/card/') ||
    location.pathname.startsWith('/view/') ||
    location.pathname === '/login';

  if (loading) {
    return (
      <div className="d-flex justify-content-center align-items-center vh-100 bg-light">
        <div className="text-center">
          <div className="spinner-border text-primary mb-2" role="status"></div>
          <div className="small text-muted fw-bold">Starting Tele-Assist Pro...</div>
        </div>
      </div>
    );
  }

  return (
    <div className="app-container">
      {/* Offline Status Top Banner */}
      <OfflineBanner />

      {/* Main Navbar */}
      {!isPublicRoute && <Navbar />}

      {/* Realtime Lead Notifications Toast */}
      {!isPublicRoute && <RealTimeLeadToast />}

      {/* Floating XP Gain Toasts */}
      {!isPublicRoute && <XPToastContainer />}

      {/* App Routes */}
      <main className="flex-grow-1">
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route
            path="/dashboard"
            element={agent ? <Dashboard /> : <Navigate to="/login" replace />}
          />
          <Route
            path="/client/:id"
            element={agent ? <ClientProfile /> : <Navigate to="/login" replace />}
          />
          <Route
            path="/client/:id/family"
            element={agent ? <FamilyPassbook /> : <Navigate to="/login" replace />}
          />
          <Route
            path="/kyc/:clientId"
            element={<KYCDropbox />}
          />
          <Route
            path="/quote/:policyId"
            element={agent ? <QuoteTracker /> : <Navigate to="/login" replace />}
          />
          <Route
            path="/view/:trackId"
            element={<QuoteViewer />}
          />
          <Route
            path="/tools/revival"
            element={agent ? <RevivalCalculator /> : <Navigate to="/login" replace />}
          />
          <Route
            path="/client/:id/tax-proof"
            element={agent ? <TaxProofPDF /> : <Navigate to="/login" replace />}
          />
          <Route
            path="/card/:agentSlug"
            element={<VisitingCard />}
          />
          <Route
            path="/client/:id/service"
            element={agent ? <ServiceTracker /> : <Navigate to="/login" replace />}
          />
          <Route
            path="/client/:id/referrals"
            element={agent ? <ReferralMap /> : <Navigate to="/login" replace />}
          />
          <Route
            path="/cold-leads"
            element={agent ? <ColdLeads /> : <Navigate to="/login" replace />}
          />
          <Route
            path="/leads"
            element={agent ? <Leads /> : <Navigate to="/login" replace />}
          />
          <Route
            path="/profile/badges"
            element={agent ? <BadgesProfile /> : <Navigate to="/login" replace />}
          />
          <Route
            path="/settings"
            element={agent ? <SettingsConfig /> : <Navigate to="/login" replace />}
          />

          {/* Default Redirect */}
          <Route path="*" element={<Navigate to={agent ? '/dashboard' : '/login'} replace />} />
        </Routes>
      </main>

      {/* Mobile Bottom Navigation Bar */}
      {!isPublicRoute && <BottomNav />}
    </div>
  );
}
