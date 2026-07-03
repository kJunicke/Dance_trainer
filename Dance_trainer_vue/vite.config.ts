import { fileURLToPath, URL } from 'node:url'
import { readFileSync } from 'node:fs'

import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import vueDevTools from 'vite-plugin-vue-devtools'
import { VitePWA } from 'vite-plugin-pwa'

// https://vite.dev/config/
export default defineConfig(({ command }) => {
  // Served under /Dance_trainer/ on GitHub Pages; root path for local dev.
  const base = command === 'build' ? '/Dance_trainer/' : '/'

  // Version shown in the UI so it's clear on-device when a new build has
  // deployed. The semver comes from package.json; the short commit SHA
  // (GITHUB_SHA in the Pages build, 'dev' locally) makes it change every deploy.
  const pkg = JSON.parse(readFileSync(new URL('./package.json', import.meta.url), 'utf-8'))
  const commit = (process.env.GITHUB_SHA ?? '').slice(0, 7)
  const appVersion = `v${pkg.version} (${commit || 'dev'})`

  return {
    base,
    define: {
      __APP_VERSION__: JSON.stringify(appVersion),
    },
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
          background_color: '#e6e0d4',
          theme_color: '#e6e0d4',
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
