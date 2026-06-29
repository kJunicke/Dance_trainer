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
  background: #fff;
  border-radius: 12px;
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.1);
}

h1 {
  font-size: 20px;
  color: #333;
}

label {
  display: flex;
  flex-direction: column;
  gap: 4px;
  font-size: 13px;
  color: #555;
}

input {
  padding: 10px 12px;
  border: 1px solid #ccc;
  border-radius: 8px;
  font-size: 16px;
}

input:focus {
  outline: none;
  border-color: #6b8cae;
}

.msg {
  font-size: 13px;
  margin: 0;
}

.msg.error {
  color: #c00;
}

.msg.info {
  color: #2a6;
}

.submit {
  padding: 12px;
  border: none;
  border-radius: 8px;
  background: #6b8cae;
  color: #fff;
  font-size: 15px;
  cursor: pointer;
}

.submit:disabled {
  opacity: 0.6;
  cursor: default;
}

.toggle {
  padding: 4px;
  border: none;
  background: transparent;
  color: #6b8cae;
  font-size: 13px;
  cursor: pointer;
}
</style>
