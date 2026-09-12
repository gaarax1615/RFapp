import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import path from 'node:path'

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      '@': path.resolve(import.meta.dirname, 'src'),
    },
  },
  server: {
    host: true,
    port: 5173,
    proxy: {
      '/sdr-api': {
        target: 'http://127.0.0.1:8787',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/sdr-api/, ''),
      },
      '/sdr-ws': {
        target: 'ws://127.0.0.1:8787',
        ws: true,
        rewrite: (path) => path.replace(/^\/sdr-ws/, ''),
      },
    },
  },
})
