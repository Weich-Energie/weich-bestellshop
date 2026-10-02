import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import fs from 'node:fs'
import path from 'node:path'

// Die App laeuft unter der Dach-App (Weich-Energie-App) im Pfad /bestellshop/.
// BASE ist die einzige Stelle mit dem Praefix: Vite leitet daraus die Asset-URLs
// und import.meta.env.BASE_URL ab, der Router zieht ihn in main.jsx daraus.
const BASE = '/bestellshop/'

// Bilddecoder von pdf.js (src/lib/pdfSeiten.js). Kopierer speichern Scans als
// JBIG2, Farbscanner als JPEG 2000 — beides dekodiert pdf.js 6 nur mit diesen
// WebAssembly-Dateien. Fehlen sie, laesst pdf.js das Bild kommentarlos weg und
// jede Seite kommt WEISS heraus (gefunden 02.10.2026 am Kopierer-Scan).
//
// Als Plugin und nicht als prebuild-Skript: Vercel ruft je nach Einstellung
// direkt `vite build` auf, und ein npm-Hook liefe dann still nicht mit.
const PDFJS_WASM = ['jbig2.wasm', 'jbig2_nowasm_fallback.js', 'openjpeg.wasm',
  'openjpeg_nowasm_fallback.js', 'qcms_bg.wasm']
const PDFJS_WASM_LIZENZEN = ['LICENSE_JBIG2', 'LICENSE_OPENJPEG', 'LICENSE_QCMS',
  'LICENSE_PDFJS_JBIG2', 'LICENSE_PDFJS_OPENJPEG', 'LICENSE_PDFJS_QCMS']
const PDFJS_WASM_QUELLE = path.resolve('node_modules/pdfjs-dist/wasm')

function pdfjsWasm() {
  return {
    name: 'pdfjs-wasm',
    generateBundle() {
      for (const datei of [...PDFJS_WASM, ...PDFJS_WASM_LIZENZEN]) {
        this.emitFile({
          type: 'asset',
          fileName: `pdfjs-wasm/${datei}`,
          source: fs.readFileSync(path.join(PDFJS_WASM_QUELLE, datei)),
        })
      }
    },
    configureServer(server) {
      server.middlewares.use(`${BASE}pdfjs-wasm/`, (req, res, next) => {
        const datei = decodeURIComponent((req.url || '').split('?')[0].replace(/^\//, ''))
        if (!PDFJS_WASM.includes(datei)) return next()
        res.setHeader('Content-Type', datei.endsWith('.wasm') ? 'application/wasm' : 'text/javascript')
        fs.createReadStream(path.join(PDFJS_WASM_QUELLE, datei)).pipe(res)
      })
    },
  }
}

export default defineConfig({
  base: BASE,
  plugins: [react(), pdfjsWasm()],
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
