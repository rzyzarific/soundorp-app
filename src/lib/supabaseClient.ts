import type { SupabaseClient } from '@supabase/supabase-js'

let clientPromise: Promise<SupabaseClient> | null = null

/**
 * True once VITE_SUPABASE_URL/VITE_SUPABASE_ANON_KEY are set. Lets callers
 * skip attempting a connection entirely on a free-tier-only deploy (no env
 * vars configured yet), rather than triggering a network attempt that's
 * guaranteed to fail.
 */
export function isSupabaseConfigured(): boolean {
  return Boolean(import.meta.env.VITE_SUPABASE_URL) && Boolean(import.meta.env.VITE_SUPABASE_ANON_KEY)
}

/**
 * Lazily loads @supabase/supabase-js on first call instead of bundling it
 * into the app's initial chunk. Most visitors are free-tier and never sign
 * in, so this keeps their load/parse cost unaffected by the accounts feature.
 */
export function getSupabaseClient(): Promise<SupabaseClient> {
  if (!clientPromise) {
    clientPromise = import('@supabase/supabase-js').then(({ createClient }) => {
      const url = import.meta.env.VITE_SUPABASE_URL
      const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

      if (!url || !anonKey) {
        throw new Error(
          'Supabase is not configured. Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY in .env.local (see .env.example).',
        )
      }

      return createClient(url, anonKey)
    })
  }

  return clientPromise
}
