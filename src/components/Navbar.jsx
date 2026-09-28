import React, { useState, useEffect } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { supabase } from '../supabaseClient';
import { getAllFromStore } from '../utils/offlineDB';

export function Navbar({ unreadLeadsCount = 0 }) {
  const { agent, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  return (
    <nav className="navbar navbar-expand navbar-dark bg-primary sticky-top px-3 shadow-sm">
      <div className="container-fluid p-0 d-flex align-items-center justify-content-between">
        <Link to="/dashboard" className="navbar-brand d-flex align-items-center mb-0 text-decoration-none">
          <span className="fs-4 me-2">🛡️</span>
          <div>
            <div className="fw-bold fs-6 lh-1">Tele-Assist Pro</div>
            <small style={{ fontSize: '0.65rem', opacity: 0.85 }}>LIC Action Assistant</small>
          </div>
        </Link>

        {agent && (
          <div className="d-flex align-items-center gap-2">
            <Link
              to={`/card/${agent.card_slug || 'rajesh-verma'}`}
              target="_blank"
              rel="noopener noreferrer"
              className="btn btn-sm btn-outline-light d-flex align-items-center gap-1 p-1 px-2 rounded-pill text-white text-decoration-none"
              title="My Digital Visiting Card"
            >
              <i className="bi bi-qr-code-scan"></i>
              <span className="small fw-semibold d-none d-sm-inline" style={{ fontSize: '0.75rem' }}>My Card</span>
            </Link>

            <Link to="/profile/badges" className="d-flex align-items-center text-white text-decoration-none bg-primary-subtle bg-opacity-25 px-2 py-1 rounded-pill border border-light border-opacity-25">
              <span className="badge bg-warning text-dark me-1 fw-bold">Lvl {agent.level || 1}</span>
              <span className="small text-truncate d-none d-sm-inline" style={{ maxWidth: '80px' }}>
                {agent.full_name?.split(' ')[0]}
              </span>
            </Link>

            <Link to="/settings" className="btn btn-sm btn-link text-white p-1" title="Settings">
              <i className="bi bi-gear-fill fs-5"></i>
            </Link>
          </div>
        )}
      </div>
    </nav>
  );
}
