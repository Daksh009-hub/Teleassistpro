import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);
  const { login } = useAuth();
  const navigate = useNavigate();

  const handleLogin = async (e) => {
    if (e) e.preventDefault();
    setError(null);
    setLoading(true);

    const res = await login(email, password);
    if (res.success) {
      navigate('/dashboard');
    } else {
      setError(res.error || 'Invalid credentials');
      setLoading(false);
    }
  };

  return (
    <div className="container py-4 d-flex flex-column justify-content-center" style={{ minHeight: '85vh' }}>
      <div className="text-center mb-4">
        <div className="display-4 mb-2">🛡️</div>
        <h3 className="fw-bold text-primary mb-1">Tele-Assist Pro</h3>
        <p className="text-muted small">LIC Agent Action & Relationship Assistant</p>
      </div>

      <div className="card shadow-sm border-0 bg-white p-4 mx-auto" style={{ maxWidth: '400px', width: '100%', borderRadius: '16px' }}>
        <h5 className="fw-bold text-dark mb-3 text-center">Agent Login</h5>

        {error && (
          <div className="alert alert-danger py-2 small mb-3">
            <i className="bi bi-exclamation-triangle-fill me-1"></i>
            {error}
          </div>
        )}

        <form onSubmit={handleLogin}>
          <div className="mb-3">
            <label className="form-label small fw-bold text-muted">Email Address</label>
            <div className="input-group input-group-sm">
              <span className="input-group-text bg-light"><i className="bi bi-envelope"></i></span>
              <input
                type="email"
                className="form-control"
                placeholder="agent@licindia.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </div>
          </div>

          <div className="mb-3">
            <label className="form-label small fw-bold text-muted">Password</label>
            <div className="input-group input-group-sm">
              <span className="input-group-text bg-light"><i className="bi bi-lock"></i></span>
              <input
                type="password"
                className="form-control"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
            </div>
          </div>

          <button
            type="submit"
            className="btn btn-primary w-100 fw-bold py-2 mb-2"
            disabled={loading}
          >
            {loading ? (
              <>
                <span className="spinner-border spinner-border-sm me-2" role="status"></span>
                Authenticating...
              </>
            ) : (
              'Sign In to Assistant'
            )}
          </button>
        </form>
      </div>
    </div>
  );
}
