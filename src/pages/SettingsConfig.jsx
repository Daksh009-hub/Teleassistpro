import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { Link } from 'react-router-dom';

export function SettingsConfig() {
  const { agent, updateAgentProfile, logout } = useAuth();

  const [fullName, setFullName] = useState(agent?.full_name || 'Rajesh Verma');
  const [phone, setPhone] = useState(agent?.phone || '+91 98765 43210');
  const [licenseNumber, setLicenseNumber] = useState(agent?.license_number || 'LIC/2019/DEL/849201');
  const [cardSlug, setCardSlug] = useState(agent?.card_slug || 'rajesh-verma');

  const [savedNotice, setSavedNotice] = useState(null);

  const handleSaveSettings = async (e) => {
    e.preventDefault();

    await updateAgentProfile({
      full_name: fullName,
      phone,
      license_number: licenseNumber,
      card_slug: cardSlug.toLowerCase().replace(/[^a-z0-9-]/g, '-')
    });

    setSavedNotice('✓ Settings and profile updated successfully!');
    setTimeout(() => setSavedNotice(null), 4000);
  };

  return (
    <div className="container py-3 px-3">
      {/* Header */}
      <div className="d-flex justify-content-between align-items-center mb-3">
        <Link to="/dashboard" className="btn btn-sm btn-light border py-1 px-2 d-flex align-items-center">
          <i className="bi bi-arrow-left me-1"></i> Dashboard
        </Link>
        <span className="badge bg-secondary text-white">⚙️ App Settings</span>
      </div>

      <div className="card shadow-sm border-0 mb-3 bg-white">
        <div className="card-body p-3">
          <h5 className="fw-bold text-dark mb-1">Agent Settings</h5>
          <p className="text-muted small mb-3">
            Configure your personal profile details and digital visiting card link.
          </p>

          {savedNotice && (
            <div className="alert alert-success py-2 small mb-3 animate__animated animate__fadeIn">
              {savedNotice}
            </div>
          )}

          <form onSubmit={handleSaveSettings}>
            {/* Agent Info */}
            <h6 className="fw-bold small text-muted text-uppercase mb-2">Profile Information</h6>
            <div className="mb-2">
              <label className="form-label small fw-bold">Full Name</label>
              <input
                type="text"
                className="form-control form-control-sm"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
              />
            </div>

            <div className="row g-2 mb-2">
              <div className="col-6">
                <label className="form-label small fw-bold">Phone Number</label>
                <input
                  type="text"
                  className="form-control form-control-sm"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                />
              </div>
              <div className="col-6">
                <label className="form-label small fw-bold">LIC Agency Code</label>
                <input
                  type="text"
                  className="form-control form-control-sm"
                  value={licenseNumber}
                  onChange={(e) => setLicenseNumber(e.target.value)}
                />
              </div>
            </div>

            <div className="mb-3">
              <label className="form-label small fw-bold">Digital Visiting Card URL Slug</label>
              <div className="input-group input-group-sm">
                <span className="input-group-text bg-light text-muted">/card/</span>
                <input
                  type="text"
                  className="form-control"
                  value={cardSlug}
                  onChange={(e) => setCardSlug(e.target.value)}
                />
              </div>
            </div>

            <button type="submit" className="btn btn-primary w-100 fw-bold py-2 mb-3">
              Save Settings
            </button>
          </form>

          {/* Logout */}
          <div className="pt-3 border-top">
            <button
              type="button"
              className="btn btn-outline-danger btn-sm w-100 py-2"
              onClick={() => logout()}
            >
              <i className="bi bi-box-arrow-right me-1"></i> Logout
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
