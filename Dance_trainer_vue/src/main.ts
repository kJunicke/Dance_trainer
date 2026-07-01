import { createApp } from 'vue'
import { createPinia } from 'pinia'

import './assets/tokens.css'
import App from './App.vue'
import router from './router'
import { useAuthStore } from './stores/authStore'

const app = createApp(App)

app.use(createPinia())

// Load the session before mounting so the first router guard sees the real
// auth state (no flicker / spurious redirect to /login).
await useAuthStore().init()

app.use(router)

app.mount('#app')
