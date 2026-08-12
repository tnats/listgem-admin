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
    globals: true,
    include: ['src/**/*.test.{js,jsx}'],
    restoreMocks: true,
  },
})
