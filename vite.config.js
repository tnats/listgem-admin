import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    port: 5174,
    proxy: Object.fromEntries(
      ['/auth', '/admin', '/metrics', '/moderation', '/queue-stats', '/feed'].map(
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
})
