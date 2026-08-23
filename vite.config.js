import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// Die App laeuft unter der Dach-App (Weich-Energie-App) im Pfad /bestellshop/.
// BASE ist die einzige Stelle mit dem Praefix: Vite leitet daraus die Asset-URLs
// und import.meta.env.BASE_URL ab, der Router zieht ihn in main.jsx daraus.
//
// Ausnahme Vorschau-Deployment: dort laeuft die App auf ihrer eigenen
// *.vercel.app-Adresse, nicht unter der Dach-App. Die Bundles lagen dann unter
// /bestellshop/assets/... — ein Pfad, den es auf dieser Adresse nicht gibt. Der
// Catch-all-Rewrite aus vercel.json lieferte daraufhin index.html als Antwort auf
// die Anfrage nach einer .js-Datei, der Browser lehnte sie wegen des MIME-Typs ab,
// und die Vorschau blieb weiss. Genau die Vorschau empfiehlt CLAUDE.md aber zum
// Testen von Unfertigem.
//
// Bewusst nur 'preview' aufweichen und nicht auf 'production' pruefen: ohne
// gesetztes VERCEL_ENV (lokaler Build, `npx vite build` als Check) bleibt es beim
// Praefix, damit lokal dieselben URLs gelten wie in der Produktion.
const IST_VORSCHAU = process.env.VERCEL_ENV === 'preview'
const BASE = IST_VORSCHAU ? '/' : '/bestellshop/'

export default defineConfig({
  base: BASE,
  plugins: [react()],
  build: {
    rolldownOptions: {
      output: {
        codeSplitting: {
          groups: [
            { name: 'vendor-react', test: /[\\/]node_modules[\\/](react|react-dom|scheduler)[\\/]/ },
            { name: 'vendor-chakra', test: /[\\/]node_modules[\\/](@chakra-ui|@emotion|@ark-ui|@zag-js)[\\/]/ },
            { name: 'vendor-query', test: /[\\/]node_modules[\\/]@tanstack[\\/]/ },
            { name: 'vendor-supabase', test: /[\\/]node_modules[\\/]@supabase[\\/]/ },
            { name: 'vendor-icons', test: /[\\/]node_modules[\\/]lucide-react[\\/]/ },
          ],
        },
      },
    },
    chunkSizeWarningLimit: 600,
  },
})
