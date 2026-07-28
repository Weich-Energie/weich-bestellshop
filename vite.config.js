import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
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
