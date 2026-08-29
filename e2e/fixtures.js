import { test as base, expect } from '@playwright/test';
import { readFileSync } from 'node:fs';

export const API = process.env.API_URL || 'https://listgem-platform-production.up.railway.app';
export const SITE = process.env.SITE_URL || 'https://listgem-website.netlify.app';

export async function api(method, path, body, token) {
  const res = await fetch(`${API}${path}`, {
    method,
    headers: { 'content-type': 'application/json', ...(token ? { authorization: `Bearer ${token}` } : {}) },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const text = await res.text();
  const data = text ? JSON.parse(text) : {};
  if (!res.ok) throw new Error(`${method} ${path} → ${res.status}: ${text.slice(0, 200)}`);
  return data;
}

async function adminToken() {
  if (process.env.ADMIN_TOKEN) return process.env.ADMIN_TOKEN;
  if (process.env.ADMIN_EMAIL && process.env.ADMIN_PASSWORD) {
    const { token } = await api('POST', '/auth/login', {
      email: process.env.ADMIN_EMAIL, password: process.env.ADMIN_PASSWORD,
    });
    return token;
  }
  const cred = JSON.parse(readFileSync(`${process.env.HOME}/.listgem_admin_cred`, 'utf8'));
  if (cred.token) return cred.token;
  return (await api('POST', '/auth/login', { email: cred.email, password: cred.password })).token;
}

/**
 * Fixtures for the concierge surface.
 *
 * `admin` seeds the portal's session the way AuthContext does, so a navigation
 * lands logged in. `pitch` creates a scratch pitch and takes it down after —
 * takedown purges contact, revokes both tokens and archives, in one call.
 *
 * Everything here runs against production, because that is the only
 * environment. Nothing is left behind that a run can avoid leaving.
 */
export const test = base.extend({
  admin: async ({ page }, use) => {
    const token = await adminToken();
    const claims = JSON.parse(Buffer.from(token.split('.')[1], 'base64url').toString());
    if (claims.exp && claims.exp * 1000 < Date.now()) {
      throw new Error('admin credential expired — the run would report auth bounces as failures');
    }
    const user = { user_id: claims.user_id || claims.sub, email: claims.email, username: 'admin', is_admin: true };

    // Before any app code runs, or RequireAuth bounces to /login first.
    await page.addInitScript(([t, u]) => {
      sessionStorage.setItem('token', t);
      sessionStorage.setItem('user', u);
    }, [token, JSON.stringify(user)]);

    await use({ token, user });
  },

  pitch: async ({ admin }, use) => {
    const made = await api('POST', '/pitches', {
      target_name: 'E2E — automated',
      proposed_title: 'E2E — automated',
      thing_type: 'Movie',
      notes: 'Created by e2e. Taken down in teardown.',
    }, admin.token);
    const pitchId = made.pitch.pitch_id;

    await use({ pitchId, token: admin.token });

    await api('POST', `/pitches/${pitchId}/takedown`, { reason: 'e2e teardown' }, admin.token)
      .catch(() => {});
  },
});

export { expect };
