import { fileURLToPath, URL } from 'node:url'

import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import vueDevTools from 'vite-plugin-vue-devtools'
import { VitePWA } from 'vite-plugin-pwa'

// https://vite.dev/config/
export default defineConfig(({ command }) => {
  // Served under /Dance_trainer/ on GitHub Pages; root path for local dev.
  const base = command === 'build' ? '/Dance_trainer/' : '/'

  return {
    base,
    plugins: [
      vue(),
      vueDevTools(),
      VitePWA({
        registerType: 'autoUpdate',
        base,
        scope: base,
        // App-shell caching only — no runtime caching of the Supabase API,
        // since the store has no offline write queue/conflict resolution.
        workbox: {
          globPatterns: ['**/*.{js,css,html,ico,png,svg,webmanifest}'],
        },
        manifest: {
          name: 'Dance Trainer',
          short_name: 'Dance Trainer',
          start_url: `${base}#/`,
          scope: base,
          display: 'standalone',
          background_color: '#3b1f33',
          theme_color: '#3b1f33',
          icons: [
            { src: 'pwa-192x192.png', sizes: '192x192', type: 'image/png' },
            { src: 'pwa-512x512.png', sizes: '512x512', type: 'image/png' },
            {
              src: 'pwa-maskable-512x512.png',
              sizes: '512x512',
              type: 'image/png',
              purpose: 'maskable',
            },
          ],
        },
      }),
    ],
    resolve: {
      alias: {
        '@': fileURLToPath(new URL('./src', import.meta.url)),
      },
    },
  }
})
