import { create } from 'zustand'
import type { Session } from '@supabase/supabase-js'
import { getSupabaseClient, isSupabaseConfigured } from '../lib/supabaseClient'

interface AuthStoreState {
  session: Session | null
  status: 'idle' | 'loading' | 'ready' | 'unconfigured' | 'error'
  error: string | null
  magicLinkSentTo: string | null

  init: () => Promise<void>
  signInWithMagicLink: (email: string) => Promise<void>
  signOut: () => Promise<void>
  clearError: () => void
  clearMagicLinkSent: () => void
}

export const useAuthStore = create<AuthStoreState>((set, get) => ({
  session: null,
  status: 'idle',
  error: null,
  magicLinkSentTo: null,

  init: async () => {
    if (get().status !== 'idle') return

    // No Supabase project configured yet (e.g. a free-tier-only deploy) —
    // skip the connection attempt entirely rather than triggering a network
    // call that's guaranteed to fail.
    if (!isSupabaseConfigured()) {
      set({ status: 'unconfigured' })
      return
    }

    set({ status: 'loading' })

    try {
      const supabase = await getSupabaseClient()
      const { data } = await supabase.auth.getSession()
      set({ session: data.session, status: 'ready' })

      supabase.auth.onAuthStateChange((_event, session) => {
        set({ session })
      })
    } catch (err) {
      set({ status: 'error', error: err instanceof Error ? err.message : 'Failed to initialize auth' })
    }
  },

  signInWithMagicLink: async (email) => {
    if (!isSupabaseConfigured()) {
      set({ error: "Sign-in isn't available yet." })
      return
    }

    set({ error: null })
    try {
      const supabase = await getSupabaseClient()
      const { error } = await supabase.auth.signInWithOtp({
        email,
        options: { emailRedirectTo: window.location.origin },
      })
      if (error) throw error
      set({ magicLinkSentTo: email })
    } catch (err) {
      set({ error: err instanceof Error ? err.message : 'Failed to send magic link' })
    }
  },

  signOut: async () => {
    try {
      const supabase = await getSupabaseClient()
      await supabase.auth.signOut()
      set({ session: null })
    } catch (err) {
      set({ error: err instanceof Error ? err.message : 'Failed to sign out' })
    }
  },

  clearError: () => set({ error: null }),
  clearMagicLinkSent: () => set({ magicLinkSentTo: null }),
}))
