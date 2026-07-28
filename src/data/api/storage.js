import { supabase } from '../../supabaseClient.js'

const BUCKET = 'shop-artikel'

// Erzeugt einen eindeutigen Storage-Pfad fuer ein Artikel-Bild.
function buildPath(artikelId, filename) {
  const ext = (filename.split('.').pop() || 'jpg').toLowerCase()
  const stamp = Date.now()
  return `${artikelId}/${stamp}.${ext}`
}

export async function uploadArtikelBild(artikelId, file) {
  const path = buildPath(artikelId, file.name)
  const { error } = await supabase.storage
    .from(BUCKET)
    .upload(path, file, { cacheControl: '3600', upsert: false })
  if (error) throw error
  return path
}

export async function deleteArtikelBild(path) {
  if (!path) return
  const { error } = await supabase.storage.from(BUCKET).remove([path])
  if (error) throw error
}

// Signed-URL fuer ein privates Bild (RLS-geschuetzt).
export async function getSignedUrl(path, expiresIn = 3600) {
  if (!path) return null
  const { data, error } = await supabase.storage.from(BUCKET).createSignedUrl(path, expiresIn)
  if (error) throw error
  return data?.signedUrl || null
}
