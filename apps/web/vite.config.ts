import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

const apiTarget = process.env.API_PROXY_TARGET || 'http://127.0.0.1:8000'

export default defineConfig({
  plugins: [react()],
  server: {
    host: '0.0.0.0',
    port: 5173,
    strictPort: true,
    allowedHosts: ['.e2b.app', 'localhost', '127.0.0.1'],
    proxy: {
      '/api': { target: apiTarget, changeOrigin: true },
      '/docs': { target: apiTarget, changeOrigin: true },
      '/openapi.json': { target: apiTarget, changeOrigin: true },
    },
  },
})
