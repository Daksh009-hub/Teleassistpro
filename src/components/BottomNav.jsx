import React from 'react';
import { NavLink } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export function BottomNav() {
  const { agent } = useAuth();
  if (!agent) return null;

  return (
    <nav className="bottom-nav">
      <NavLink
        to="/dashboard"
        className={({ isActive }) => `bottom-nav-item ${isActive ? 'active' : ''}`}
      >
        <i className="bi bi-house-door-fill"></i>
        <span>Home</span>
      </NavLink>

      <NavLink
        to="/leads"
        className={({ isActive }) => `bottom-nav-item ${isActive ? 'active' : ''}`}
      >
        <i className="bi bi-people-fill"></i>
        <span>Leads</span>
      </NavLink>

      <NavLink
        to="/tools/revival"
        className={({ isActive }) => `bottom-nav-item ${isActive ? 'active' : ''}`}
      >
        <i className="bi bi-calculator-fill"></i>
        <span>Revival</span>
      </NavLink>


      <NavLink
        to="/cold-leads"
        className={({ isActive }) => `bottom-nav-item ${isActive ? 'active' : ''}`}
      >
        <i className="bi bi-person-heart"></i>
        <span>Reactivate</span>
      </NavLink>

      <NavLink
        to="/profile/badges"
        className={({ isActive }) => `bottom-nav-item ${isActive ? 'active' : ''}`}
      >
        <i className="bi bi-award-fill"></i>
        <span>Badges</span>
      </NavLink>
    </nav>
  );
}
