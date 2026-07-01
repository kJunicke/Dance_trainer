<script setup lang="ts">
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import { useAuthStore } from '../stores/authStore'

const auth = useAuthStore()
const router = useRouter()

const mode = ref<'login' | 'signup'>('login')
const email = ref('')
const password = ref('')
const displayName = ref('')
const submitting = ref(false)
const info = ref<string | null>(null)

// Dev-only quick-login buttons. Sign these two accounts up once via the form.
// The array is behind import.meta.env.DEV so the credentials are dead-code
// eliminated from the production bundle (not just hidden by the v-if).
const isDev = import.meta.env.DEV
const testUsers = import.meta.env.DEV
  ? [
      { label: 'Test User 1', email: 'test1@example.com', password: 'testpass123' },
      { label: 'Test User 2', email: 'test2@example.com', password: 'testpass123' },
    ]
  : []

async function loginAs(user: { email: string; password: string }) {
  const ok = await auth.signIn(user.email, user.password)
  if (ok) router.push({ name: 'boards' })
}

function toggleMode() {
  // Fields stay bound to the same refs, so typed values persist across the toggle.
  mode.value = mode.value === 'login' ? 'signup' : 'login'
  info.value = null
  auth.error = null
}

async function onSubmit() {
  submitting.value = true
  info.value = null
  try {
    if (mode.value === 'signup') {
      const loggedIn = await auth.signUp(email.value, password.value, displayName.value)
      if (auth.error) return
      if (loggedIn) {
        router.push({ name: 'boards' })
      } else {
        info.value = `Check your email to confirm ${email.value}, then sign in.`
      }
    } else {
      const ok = await auth.signIn(email.value, password.value)
      if (ok) router.push({ name: 'boards' })
    }
  } finally {
    submitting.value = false
  }
}
</script>

<template>
  <div class="auth">
    <form class="card" @submit.prevent="onSubmit">
      <h1>{{ mode === 'login' ? 'Log in' : 'Sign up' }}</h1>

      <label>
        Email
        <input v-model="email" type="email" autocomplete="email" required />
      </label>

      <label v-if="mode === 'signup'">
        Display name
        <input v-model="displayName" type="text" autocomplete="name" required />
      </label>

      <label>
        Password
        <input
          v-model="password"
          type="password"
          :autocomplete="mode === 'login' ? 'current-password' : 'new-password'"
          required
        />
      </label>

      <p v-if="auth.error" class="msg error">{{ auth.error }}</p>
      <p v-else-if="info" class="msg info">{{ info }}</p>

      <button class="submit" type="submit" :disabled="submitting">
        {{ submitting ? '…' : mode === 'login' ? 'Log in' : 'Sign up' }}
      </button>

      <button class="toggle" type="button" @click="toggleMode">
        {{ mode === 'login' ? 'Need an account? Sign up' : 'Have an account? Log in' }}
      </button>

      <div v-if="isDev" class="dev">
        <span class="dev-label">dev quick login</span>
        <button
          v-for="u in testUsers"
          :key="u.email"
          class="dev-btn"
          type="button"
          @click="loginAs(u)"
        >
          {{ u.label }}
        </button>
      </div>
    </form>
  </div>
</template>

<style scoped>
.auth {
  display: flex;
  justify-content: center;
  align-items: flex-start;
  min-height: 100vh;
  padding: 48px 16px;
}

.card {
  display: flex;
  flex-direction: column;
  gap: 14px;
  width: 100%;
  max-width: 360px;
  padding: 24px;
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-lg);
  box-shadow: var(--shadow-modal);
}

h1 {
  font-family: var(--font-display);
  font-weight: 700;
  font-size: 26px;
  letter-spacing: -0.01em;
  color: var(--color-ink);
}

label {
  display: flex;
  flex-direction: column;
  gap: 4px;
  font-size: 13px;
  color: var(--color-ink-dim);
}

input {
  padding: 10px 12px;
  border: 1px solid var(--color-border);
  border-radius: var(--radius-sm);
  background: var(--color-bg);
  color: var(--color-ink);
  font-size: 16px;
}

input:focus {
  outline: none;
  border-color: var(--color-ember);
}

.msg {
  font-size: 13px;
  margin: 0;
}

.msg.error {
  color: var(--color-overdue);
}

.msg.info {
  color: var(--color-good);
}

.submit {
  padding: 12px;
  border: none;
  border-radius: var(--radius-sm);
  background: var(--color-ember);
  color: var(--color-text-on-ember);
  font-size: 15px;
  font-weight: 600;
  cursor: pointer;
}

.submit:hover:not(:disabled) {
  background: var(--color-ember-light);
}

.submit:disabled {
  opacity: 0.6;
  cursor: default;
}

.toggle {
  padding: 4px;
  border: none;
  background: transparent;
  color: var(--color-ink-dim);
  font-size: 13px;
  text-decoration: underline;
  cursor: pointer;
}

.dev {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px;
  margin-top: 8px;
  padding-top: 12px;
  border-top: 1px dashed var(--color-border);
}

.dev-label {
  width: 100%;
  font-family: var(--font-mono);
  font-size: 11px;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  color: var(--color-ink-dim);
}

.dev-btn {
  flex: 1;
  padding: 8px;
  border: 1px solid var(--color-good);
  border-radius: var(--radius-sm);
  background: transparent;
  color: var(--color-good);
  font-size: 13px;
  cursor: pointer;
}
</style>
