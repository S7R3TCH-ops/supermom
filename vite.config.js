import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      strategies: 'injectManifest',
      srcDir: 'src',
      filename: 'sw.js',
      registerType: 'autoUpdate',
      includeAssets: ['favicon.svg', 'icons/apple-touch-icon.png'],
      manifest: {
        name: 'Supermom for Hire',
        short_name: 'Supermom',
        description: 'Operations app for Sandra\'s personal-life-operations business',
        theme_color: '#1C1C1E',
        background_color: '#FFEFF4',
        display: 'standalone',
        orientation: 'portrait',
        scope: '/',
        start_url: '/',
        icons: [
          { src: '/icons/icon-96x96.png',            sizes: '96x96',   type: 'image/png', purpose: 'any' },
          { src: '/icons/icon-144x144.png',           sizes: '144x144', type: 'image/png', purpose: 'any' },
          { src: '/icons/icon-192.png',               sizes: '192x192', type: 'image/png', purpose: 'any' },
          { src: '/icons/icon-192x192-maskable.png',  sizes: '192x192', type: 'image/png', purpose: 'maskable' },
          { src: '/icons/icon-256x256.png',           sizes: '256x256', type: 'image/png', purpose: 'any' },
          { src: '/icons/icon-384x384.png',           sizes: '384x384', type: 'image/png', purpose: 'any' },
          { src: '/icons/icon-512.png',               sizes: '512x512', type: 'image/png', purpose: 'any' },
          { src: '/icons/icon-512x512-maskable.png',  sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
        screenshots: [
          { src: '/branding/supermom_app.jpg', sizes: '540x720', type: 'image/jpeg', form_factor: 'narrow' },
        ],
      },
      injectManifest: {
        globPatterns: ['**/*.{js,css,html,ico,png,svg,woff2}'],
      },
    }),
  ],
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (
            id.includes('node_modules/react/') ||
            id.includes('node_modules/react-dom/') ||
            id.includes('node_modules/react-router') ||
            id.includes('node_modules/@tanstack/')
          ) {
            return 'vendor';
          }
        },
      },
    },
  },
  server: {
    host: '0.0.0.0',
    port: 8080,
  },
})
