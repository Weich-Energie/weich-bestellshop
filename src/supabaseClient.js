import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

if (!supabaseUrl || !supabaseAnonKey) {
  console.error('❌ Supabase Credentials fehlen! Bitte .env pruefen.')
}

// Singleton auf globalThis (verhindert HMR-Doppel-Init, siehe Ressourcenplanung-Muster).
const GLOBAL_KEY = '__weich_bestellshop_supabase__'
const existing = globalThis[GLOBAL_KEY]

export const supabase =
  existing ||
  createClient(supabaseUrl, supabaseAnonKey, {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
    },
  })

if (!existing) globalThis[GLOBAL_KEY] = supabase
