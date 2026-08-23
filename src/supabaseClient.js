import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

// Fehlen die Variablen, wirft createClient unten ein nacktes "supabaseUrl is
// required" — und zwar beim Import, also bevor React oder die ErrorBoundary
// ueberhaupt laufen. Sichtbar war davon nur eine weisse Seite. Typischer Fall:
// die Env-Vars sind bei Vercel nur fuer Production freigegeben, nicht fuer die
// Vorschau-Deployments.
if (!supabaseUrl || !supabaseAnonKey) {
  const meldung =
    'Konfiguration fehlt: VITE_SUPABASE_URL und VITE_SUPABASE_ANON_KEY sind nicht gesetzt. ' +
    'Bei Vercel muessen die Variablen fuer die jeweilige Umgebung freigegeben sein ' +
    '(Production UND Preview), lokal gehoeren sie in die .env.'
  console.error(meldung)
  const wurzel = typeof document !== 'undefined' ? document.getElementById('root') : null
  if (wurzel) {
    wurzel.style.cssText = 'padding:24px;font-family:sans-serif;line-height:1.5'
    wurzel.textContent = meldung
  }
  throw new Error(meldung)
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
