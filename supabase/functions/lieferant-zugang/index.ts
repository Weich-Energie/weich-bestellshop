// lieferant-zugang — setzt und loescht Lieferanten-Zugangsdaten.
//
// Warum eine Edge Function und nicht direkt aus dem Browser: der Master-Key darf
// nie ins Frontend. Der Admin schickt Benutzer + Passwort hierher (TLS, mit
// seinem JWT), diese Funktion verschluesselt mit SUPPLIER_CRED_KEY und schreibt
// nur den Blob in die Tabelle. Zurueck kommt ausschliesslich "ok" — Zugangsdaten
// verlassen die Serverseite nie wieder.
//
// BYTE-FORMAT (muss identisch zu /opt/weich-browser/zugang.mjs auf weich-code sein,
// dort entschluesselt der Bot):  base64( iv[12] | tag[16] | ciphertext )
// Achtung: WebCrypto liefert ciphertext||tag, Node erwartet tag VOR ciphertext —
// deshalb wird unten umsortiert. Wer das aendert, macht alle gespeicherten
// Zugaenge unlesbar.

import "jsr:@supabase/functions-js/edge-runtime.d.ts"
import { createClient } from "jsr:@supabase/supabase-js@2"

const CORS = {
  "Content-Type": "application/json",
  "Access-Control-Allow-Origin": "*",
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: CORS })
}

async function verschluesseln(klartext: string): Promise<string> {
  const keyB64 = Deno.env.get("SUPPLIER_CRED_KEY")
  if (!keyB64) throw new Error("SUPPLIER_CRED_KEY ist nicht gesetzt (Supabase → Edge Functions → Secrets)")

  const rohschluessel = Uint8Array.from(atob(keyB64), (c) => c.charCodeAt(0))
  if (rohschluessel.length !== 32) {
    throw new Error(`SUPPLIER_CRED_KEY muss 32 Byte base64 sein (ist ${rohschluessel.length})`)
  }

  const key = await crypto.subtle.importKey("raw", rohschluessel, { name: "AES-GCM" }, false, ["encrypt"])
  const iv = crypto.getRandomValues(new Uint8Array(12))
  const ergebnis = new Uint8Array(
    await crypto.subtle.encrypt({ name: "AES-GCM", iv }, key, new TextEncoder().encode(klartext)),
  )

  // WebCrypto: ciphertext||tag → wir brauchen iv|tag|ciphertext
  const ct = ergebnis.slice(0, ergebnis.length - 16)
  const tag = ergebnis.slice(ergebnis.length - 16)
  const blob = new Uint8Array(iv.length + tag.length + ct.length)
  blob.set(iv, 0)
  blob.set(tag, iv.length)
  blob.set(ct, iv.length + tag.length)

  let binaer = ""
  for (const b of blob) binaer += String.fromCharCode(b)
  return btoa(binaer)
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", {
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "POST, OPTIONS",
        "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
      },
    })
  }

  try {
    const authHeader = req.headers.get("Authorization")
    if (!authHeader?.startsWith("Bearer ")) return json({ error: "Nicht autorisiert" }, 401)

    const sb = createClient(
      Deno.env.get("SUPABASE_URL") || "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "",
    )

    const { data: userData, error: authErr } = await sb.auth.getUser(authHeader.replace("Bearer ", ""))
    if (authErr || !userData?.user?.email) return json({ error: "Ungueltige Session" }, 401)

    // Admin-Pruefung: diese Funktion laeuft mit service_role und umgeht RLS,
    // also muss sie die Berechtigung selbst pruefen — fail-closed.
    const { data: profil } = await sb
      .from("employees")
      .select("berechtigungen")
      .eq("email", userData.user.email)
      .single()

    const rechte = (profil?.berechtigungen ?? {}) as Record<string, any>
    const istAdmin = rechte?.app_access?.bestellshop_admin === true || rechte?.rolle === "admin"
    if (!istAdmin) return json({ error: "Nur Shop-Admins duerfen Zugaenge pflegen" }, 403)

    const body = await req.json()
    const aktion = body?.aktion
    const lieferantId = body?.lieferant_id
    if (!lieferantId) return json({ error: "lieferant_id fehlt" }, 400)

    if (aktion === "setzen") {
      const benutzer = String(body?.benutzer ?? "").trim()
      const passwort = String(body?.passwort ?? "")
      if (!benutzer || !passwort) return json({ error: "Benutzer und Passwort sind Pflicht" }, 400)

      const chiffre = await verschluesseln(JSON.stringify({ benutzer, passwort }))
      const { error } = await sb
        .from("shop_lieferanten")
        .update({ zugang_chiffre: chiffre, zugang_gesetzt_am: new Date().toISOString() })
        .eq("id", lieferantId)
      if (error) throw error
      return json({ ok: true, gesetzt_am: new Date().toISOString() })
    }

    if (aktion === "loeschen") {
      const { error } = await sb
        .from("shop_lieferanten")
        .update({ zugang_chiffre: null, zugang_gesetzt_am: null })
        .eq("id", lieferantId)
      if (error) throw error
      return json({ ok: true, gesetzt_am: null })
    }

    return json({ error: `Unbekannte Aktion: ${aktion}` }, 400)
  } catch (err) {
    return json({ error: String((err as any)?.message || err) }, 500)
  }
})
