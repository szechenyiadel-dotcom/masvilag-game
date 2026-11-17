import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig(({ mode }) => ({
  plugins: [react()],
  /* R108: build time in Budapest, shown in the app header */
  define: {
    __BUILD_STAMP__: JSON.stringify(new Date().toLocaleString('sv-SE', { timeZone: 'Europe/Budapest' }).slice(5, 16)),
  },
  build: {
    outDir: 'dist'
  },
  base: '/',
  server: {
    host: true,
    allowedHosts: true,
    proxy: {
      '/ai': {
        target: 'http://127.0.0.1:3000',
        changeOrigin: true,
        secure: false,
        ws: true,
      }
    }
  },
  preview: {
    host: true,
    allowedHosts: true,
    proxy: {
      '/ai': {
        target: 'http://127.0.0.1:3000',
        changeOrigin: true,
        secure: false,
      }
    }
  }
}))
