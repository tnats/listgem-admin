import { defineConfig } from '@playwright/test';

/**
 * These specs run against the deployed portal, not a dev server: what they are
 * checking is what an operator and a target actually see, and every defect they
 * exist for survived a green unit suite.
 */
export default defineConfig({
  testDir: './specs',
  // Resolution goes out to TMDB and back; a paste of four rows takes ~15s.
  timeout: 120_000,
  expect: { timeout: 15_000 },
  // Serial: each spec creates a scratch pitch against production, and parallel
  // runs would interleave scratch data on a shared board for no gain.
  workers: 1,
  fullyParallel: false,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [['github'], ['list']] : [['list']],
  use: {
    baseURL: process.env.ADMIN_URL || 'https://listgem-admin.netlify.app',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
});
