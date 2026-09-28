import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { App } from './App';
import { AuthProvider } from './context/AuthContext';
import { GamificationProvider } from './context/GamificationContext';
import { OfflineProvider } from './context/OfflineContext';
import 'bootstrap/dist/js/bootstrap.bundle.min.js';
import './index.css';

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <BrowserRouter>
      <AuthProvider>
        <GamificationProvider>
          <OfflineProvider>
            <App />
          </OfflineProvider>
        </GamificationProvider>
      </AuthProvider>
    </BrowserRouter>
  </React.StrictMode>
);
