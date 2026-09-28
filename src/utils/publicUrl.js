import { safeGetItem } from './storage';

/**
 * Returns the public base URL for sharing digital cards, quotes, and KYC links.
 * In production/deployment, automatically uses the live website origin (e.g. https://your-site.vercel.app).
 * In local dev, falls back to the local origin or custom VITE_PUBLIC_URL if specified.
 */
export function getPublicBaseUrl() {
  // 1. User-configured override in localStorage
  const savedUrl = safeGetItem('public_base_url');
  if (savedUrl && savedUrl.trim()) {
    return savedUrl.trim().replace(/\/+$/, '');
  }

  // 2. Active browser domain if running on deployed website / non-localhost
  if (typeof window !== 'undefined' && window.location && window.location.origin) {
    const origin = window.location.origin;
    const isLocal = origin.includes('localhost') || origin.includes('127.0.0.1') || origin.includes('0.0.0.0');
    if (!isLocal) {
      return origin;
    }
  }

  // 3. Environment variable from Vite (.env)
  if (typeof import.meta !== 'undefined' && import.meta.env?.VITE_PUBLIC_URL && import.meta.env.VITE_PUBLIC_URL.trim()) {
    return import.meta.env.VITE_PUBLIC_URL.trim().replace(/\/+$/, '');
  }

  // 4. Default fallback to current window origin (in dev or SSR fallback)
  if (typeof window !== 'undefined' && window.location && window.location.origin) {
    return window.location.origin;
  }

  return '';
}

/**
 * Builds the full public URL for a given path (e.g. /card/rajesh-verma).
 */
export function buildPublicUrl(path = '') {
  const base = getPublicBaseUrl();
  const cleanPath = path.startsWith('/') ? path : `/${path}`;
  return `${base}${cleanPath}`;
}
