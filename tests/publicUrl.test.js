import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { getPublicBaseUrl, buildPublicUrl } from '../src/utils/publicUrl';
import { safeSetItem, safeRemoveItem } from '../src/utils/storage';

describe('publicUrl Utility Tests', () => {
  afterEach(() => {
    safeRemoveItem('public_base_url');
  });

  it('automatically resolves live deployed domain when running on production', () => {
    const originalLocation = window.location;
    delete window.location;
    window.location = new URL('https://teleasistre.vercel.app');

    const url = getPublicBaseUrl();
    expect(url).toBe('https://teleasistre.vercel.app');

    const cardUrl = buildPublicUrl('/card/rajesh-verma');
    expect(cardUrl).toBe('https://teleasistre.vercel.app/card/rajesh-verma');

    window.location = originalLocation;
  });

  it('builds full public URL with leading slash handling', () => {
    const originalLocation = window.location;
    delete window.location;
    window.location = new URL('https://my-insurance-app.com');

    const cardUrlWithSlash = buildPublicUrl('/card/rajesh-verma');
    expect(cardUrlWithSlash).toBe('https://my-insurance-app.com/card/rajesh-verma');

    const cardUrlWithoutSlash = buildPublicUrl('card/rajesh-verma');
    expect(cardUrlWithoutSlash).toBe('https://my-insurance-app.com/card/rajesh-verma');

    window.location = originalLocation;
  });

  it('prioritizes user-configured localStorage override if present', () => {
    safeSetItem('public_base_url', 'https://my-custom-tunnel.ngrok-free.app');
    const url = getPublicBaseUrl();
    expect(url).toBe('https://my-custom-tunnel.ngrok-free.app');

    const cardUrl = buildPublicUrl('/card/rajesh-verma');
    expect(cardUrl).toBe('https://my-custom-tunnel.ngrok-free.app/card/rajesh-verma');
  });
});
