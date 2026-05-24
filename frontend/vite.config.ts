import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'
import path from 'path'

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      manifest: {
        name: 'invoice.plan',
        short_name: 'invoice.plan',
        description: 'planeje. emita. cresça.',
        theme_color: '#050505',
        background_color: '#050505',
        display: 'standalone',
        icons: [
          { src: '/icon-dark.png', sizes: '192x192', type: 'image/png' },
          { src: '/icon-dark.png', sizes: '512x512', type: 'image/png' },
        ],
      },
    }),
  ],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  server: {
    port: 3000,
  },
})
