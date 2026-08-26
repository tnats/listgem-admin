import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    port: 5174,
    proxy: Object.fromEntries(
      [
        '/auth', '/admin', '/metrics', '/moderation', '/queue-stats', '/feed',
        // Concierge + verification (#533)
        '/pitches', '/verification', '/resolve', '/imports',
        // Federated catalogue search + the canonical type vocabulary. Absent
        // here, they 404 against the dev server while working fine in a
        // production build, which points debugging at entirely the wrong place.
        '/search-to-add', '/types', '/things',
        // Cover art from hotlink-blocking sources is fetched through the API.
        '/images',
      ].map(
        (path) => [
          path,
          {
            target: 'https://listgem-platform-production.up.railway.app',
            changeOrigin: true,
            secure: true,
            configure: (proxy) => {
              proxy.on('proxyReq', (proxyReq) => {
                proxyReq.removeHeader('origin');
              });
            },
          },
        ],
      ),
    ),
  },
  test: {
    // jsdom is pinned to ^26: 27 pulls a CJS→ESM require chain that needs
    // Node ≥20.19 (dev is on 20.18).
    environment: 'jsdom',
    // Clears storage between tests — the builder persists drafts, and a leaked
    // one restores into the next case.
    setupFiles: ['./src/test/setup.js'],
    globals: true,
    include: ['src/**/*.test.{js,jsx}'],
    restoreMocks: true,
  },
})
