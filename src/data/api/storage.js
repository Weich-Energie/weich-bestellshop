import { supabase } from '../../supabaseClient.js'

const ARTIKEL_BUCKET = 'shop-artikel'
const BEDARF_BUCKET = 'shop-bedarf'

function buildPath(prefix, filename) {
  const ext = (filename.split('.').pop() || 'jpg').toLowerCase()
  const stamp = Date.now()
  const rand = Math.random().toString(36).slice(2, 8)
  return `${prefix}/${stamp}-${rand}.${ext}`
}

export async function uploadArtikelBild(artikelId, file) {
  const path = buildPath(artikelId, file.name)
  const { error } = await supabase.storage
    .from(ARTIKEL_BUCKET)
    .upload(path, file, { cacheControl: '3600', upsert: false })
  if (error) throw error
  return path
}

export async function deleteArtikelBild(path) {
  if (!path) return
  const { error } = await supabase.storage.from(ARTIKEL_BUCKET).remove([path])
  if (error) throw error
}

export async function uploadBedarfBild(userId, file) {
  const path = buildPath(userId, file.name)
  const { error } = await supabase.storage
    .from(BEDARF_BUCKET)
    .upload(path, file, { cacheControl: '3600', upsert: false })
  if (error) throw error
  return path
}

export async function deleteBedarfBild(path) {
  if (!path) return
  const { error } = await supabase.storage.from(BEDARF_BUCKET).remove([path])
  if (error) throw error
}

// Signed-URL fuer ein privates Bild — Bucket wird per Prefix des Pfads bestimmt.
// Fallback: shop-artikel (Rueckwaertskompatibilitaet).
export async function getSignedUrl(path, expiresIn = 3600, bucket = ARTIKEL_BUCKET, transform = null) {
  if (!path) return null
  const options = transform ? { transform } : undefined
  const { data, error } = await supabase.storage.from(bucket).createSignedUrl(path, expiresIn, options)
  if (error) throw error
  return data?.signedUrl || null
}

// Serverseitig skaliertes Vorschaubild (Supabase Image Transformation, Pro-Plan).
// Wichtig fuer Mobilfunk: ein 4-MB-Handyfoto wird sonst in Originalgroesse
// geladen, nur um in einer 120-px-Kachel zu landen.
// Quadratisch + cover, weil alle Kacheln quadratisch sind und objectFit="cover" nutzen.
// Die Anfrage laeuft ueber die Einzel-API, weil createSignedUrls (Batch) kein
// transform kennt — die Ersparnis an Bytes wiegt die Extra-Requests deutlich auf.
export async function getBildVorschauUrl(path, kantenlaenge = 400, bucket = ARTIKEL_BUCKET) {
  return getSignedUrl(path, 3600, bucket, {
    width: kantenlaenge,
    height: kantenlaenge,
    resize: 'cover',
    quality: 75,
  })
}

// Ohne transform — die Bedarfs-Bilder gehen so auch an die KI-Bildanalyse,
// die von voller Auflösung profitiert.
export async function getBedarfSignedUrl(path, expiresIn = 3600) {
  return getSignedUrl(path, expiresIn, BEDARF_BUCKET)
}
