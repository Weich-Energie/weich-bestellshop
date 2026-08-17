import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// Die App laeuft unter der Dach-App (Weich-Energie-App) im Pfad /bestellshop/.
// BASE ist die einzige Stelle mit dem Praefix: Vite leitet daraus die Asset-URLs
// und import.meta.env.BASE_URL ab, der Router zieht ihn in main.jsx daraus.
const BASE = '/bestellshop/'

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
