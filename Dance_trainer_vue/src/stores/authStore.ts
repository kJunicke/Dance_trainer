import { defineStore } from 'pinia'
import { ref } from 'vue'
import type { User } from '@supabase/supabase-js'
import { supabase } from '@/lib/supabase'
import { useToastStore } from './toastStore'

export const useAuthStore = defineStore('auth', () => {
  const user = ref<User | null>(null)

  async function init() {
    const { data } = await supabase.auth.getSession()
    user.value = data.session?.user ?? null
    supabase.auth.onAuthStateChange((_event, session) => {
      user.value = session?.user ?? null
    })
  }

  // Returns true if signup produced a session (email confirmation off → logged in),
  // false if a confirmation step is still required, null if signup failed.
  async function signUp(email: string, password: string, displayName: string) {
    const { data, error: err } = await supabase.auth.signUp({
      email,
      password,
      options: { data: { display_name: displayName } },
    })
    if (err) { useToastStore().show(err.message); return null }
    return data.session !== null
  }

  async function signIn(email: string, password: string) {
    const { error: err } = await supabase.auth.signInWithPassword({ email, password })
    if (err) { useToastStore().show(err.message); return false }
    return true
  }

  async function signOut() {
    const { error: err } = await supabase.auth.signOut()
    if (err) useToastStore().show(err.message)
  }

  return { user, init, signUp, signIn, signOut }
})
