import { defineStore } from 'pinia'
import { ref } from 'vue'
import type { User } from '@supabase/supabase-js'
import { supabase } from '@/lib/supabase'

export const useAuthStore = defineStore('auth', () => {
  const user = ref<User | null>(null)
  const error = ref<string | null>(null)

  async function init() {
    const { data } = await supabase.auth.getSession()
    user.value = data.session?.user ?? null
    supabase.auth.onAuthStateChange((_event, session) => {
      user.value = session?.user ?? null
    })
  }

  // Returns true if signup produced a session (email confirmation off → logged in),
  // false if a confirmation step is still required.
  async function signUp(email: string, password: string, displayName: string) {
    error.value = null
    const { data, error: err } = await supabase.auth.signUp({
      email,
      password,
      options: { data: { display_name: displayName } },
    })
    if (err) { error.value = err.message; return false }
    return data.session !== null
  }

  async function signIn(email: string, password: string) {
    error.value = null
    const { error: err } = await supabase.auth.signInWithPassword({ email, password })
    if (err) { error.value = err.message; return false }
    return true
  }

  async function signOut() {
    const { error: err } = await supabase.auth.signOut()
    if (err) error.value = err.message
  }

  return { user, error, init, signUp, signIn, signOut }
})
