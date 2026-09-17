// aufmass-rf-suche — Artikel bei R+F suchen und in eine Aufmaß-Kategorie
// übernehmen. Rein lesend gegenüber dem Shop: es wird nichts in einen Korb
// gelegt und nichts bestellt.
//
// Warum über eine Function und nicht direkt aus der App: rf24.de verlangt
// einen Login, der im Playwright-Browser auf dem VPS liegt. Die App hat dort
// keinen Zugang und soll den Bearer für weich-api auch nicht kennen.
//
// Zwei Aktionen, weil die Suchantwort des Shops keinen Preis enthält:
//   { aktion: "suchen",   begriff }       -> Trefferliste (ohne Preis)
//   { aktion: "uebernehmen", artikelnr, kategorie_id }
//        -> holt Preis/VPE/Bild, legt den Artikel in shop_artikel an (falls
//           neu) und hängt ihn als Zeile an die Kategorie.
//
// Recht: nur der Aufmaß-Admin. Übernehmen legt Artikel im Stamm an — das ist
// keine Monteurs-Aufgabe.

import { createClient } from "jsr:@supabase/supabase-js@2"

const CORS = { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" }

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: CORS })
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
  if (req.method !== "POST") return json({ fehler: "Nur POST erlaubt" }, 405)

  const sb = createClient(
    Deno.env.get("SUPABASE_URL") || "",
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "",
  )
  try {
    const authHeader = req.headers.get("Authorization")
    if (!authHeader?.startsWith("Bearer ")) return json({ fehler: "Nicht autorisiert" }, 401)
    const { data: userData, error: authErr } = await sb.auth.getUser(authHeader.replace("Bearer ", ""))
    if (authErr || !userData?.user?.email) return json({ fehler: "Ungültige Session" }, 401)

    // fail-closed: kein `?? true`. Artikel anlegen darf nur der Aufmaß-Admin.
    const { data: profil } = await sb.from("employees")
      .select("berechtigungen").eq("email", userData.user.email).single()
    const rechte = (profil?.berechtigungen ?? {}) as Record<string, any>
    const darf = rechte?.app_access?.aufmass_admin === true
      || rechte?.app_access?.bestellshop_admin === true
      || rechte?.rolle === "admin"
    if (!darf) return json({ fehler: "Nur der Aufmaß-Admin darf Artikel anlegen" }, 403)

    const { data: secret } = await sb.from("integration_secrets")
      .select("value").eq("key", "weich_api").maybeSingle()
    const cfg = secret?.value as { bearer?: string; base_url?: string } | undefined
    if (!cfg?.bearer || !cfg?.base_url) {
      return json({
        fehler: "Keine Zugangsdaten für weich-api hinterlegt "
          + "(integration_secrets, Schlüssel 'weich_api' mit bearer und base_url)",
      }, 503)
    }
    const basis = cfg.base_url.replace(/\/$/, "")

    async function api(pfad: "/rf/suche" | "/rf/artikel", rumpf: unknown) {
      const r = await fetch(basis + pfad, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${cfg!.bearer}` },
        body: JSON.stringify(rumpf),
      })
      const text = await r.text()
      let daten: any = null
      try { daten = JSON.parse(text) } catch { /* kein JSON */ }
      if (!r.ok) {
        // Die abgelaufene Shop-Sitzung wird durchgereicht: dagegen hilft kein
        // Wiederholen, sondern nur eine neue Anmeldung am VPS.
        const e: any = new Error(daten?.fehler || `weich-api antwortete ${r.status}`)
        e.status = r.status
        e.sitzungAbgelaufen = !!daten?.sitzungAbgelaufen
        throw e
      }
      return daten
    }

    const body = await req.json().catch(() => ({}))
    const aktion = String(body?.aktion ?? "suchen")

    if (aktion === "suchen") {
      const ergebnis = await api("/rf/suche", {
        begriff: String(body?.begriff ?? ""),
        treffer: Number(body?.treffer ?? 8),
      })
      // Schon im Katalog? Dann muss der Admin ihn nicht neu anlegen, sondern
      // nur die Zeile setzen -- das soll die Oberfläche zeigen können.
      const nummern = (ergebnis?.treffer ?? []).map((t: any) => t.artikelnr).filter(Boolean)
      const bekannt = new Map<string, any>()
      if (nummern.length) {
        const { data } = await sb.from("shop_artikel")
          .select("id, artikelnr, name, preis_netto, sichtbar_aufmass")
          .in("artikelnr", nummern)
        for (const a of data ?? []) bekannt.set(a.artikelnr, a)
      }
      return json({
        ...ergebnis,
        treffer: (ergebnis?.treffer ?? []).map((t: any) => ({
          ...t,
          im_katalog: bekannt.has(t.artikelnr),
          katalog: bekannt.get(t.artikelnr) ?? null,
        })),
      })
    }

    if (aktion === "uebernehmen") {
      const artikelnr = String(body?.artikelnr ?? "").trim()
      const kategorieId = String(body?.kategorieId ?? body?.kategorie_id ?? "").trim()
      if (!/^\d{13}$/.test(artikelnr)) return json({ fehler: "Artikelnummer hat 13 Stellen" }, 400)
      if (!kategorieId) return json({ fehler: "Keine Kategorie angegeben" }, 400)

      const { data: kat } = await sb.from("aufmass_kategorie")
        .select("id, name, ansicht").eq("id", kategorieId).maybeSingle()
      if (!kat) return json({ fehler: "Kategorie nicht gefunden" }, 404)

      // Einzelartikel gehören in die Zählliste. In der Sammelansicht steht
      // eine Zeile für eine Preisgruppe, kein einzelner Artikel -- außer in
      // den Zubehör-Rubriken, die kein Materialsystem tragen.
      if (kat.ansicht === "gruppen") {
        const { data: kk } = await sb.from("aufmass_kategorie")
          .select("formteil_system").eq("id", kategorieId).maybeSingle()
        if (kk?.formteil_system) {
          return json({
            fehler: `"${kat.name}" ist eine Preisgruppe der Sammelansicht — `
              + "dort zählt der Monteur gebündelt. Einzelartikel gehören in die Zählliste.",
          }, 400)
        }
      }

      // 1. Stammdaten vom Shop. Ohne Preis wird nichts angelegt: eine Zeile
      //    ohne Preis wäre im Aufmaß unbewertbar.
      const artikel = await api("/rf/artikel", { artikelnr })
      if (artikel?.preis_netto == null) {
        return json({
          fehler: `Für ${artikelnr} liefert der Shop keinen Stückpreis. `
            + "Ohne Preis lässt sich die Zeile nicht bewerten.",
          artikel,
        }, 422)
      }

      // 2. Artikel anlegen, falls neu. Bestehende Preise bleiben unangetastet:
      //    Shop-Preise sind Listenpreise und schlechter als Lager- oder
      //    Rechnungspreise.
      const { data: vorhanden } = await sb.from("shop_artikel")
        .select("id, name, preis_netto, sichtbar_aufmass").eq("artikelnr", artikelnr).maybeSingle()
      let artikelId = vorhanden?.id as string | undefined
      let angelegt = false
      if (!artikelId) {
        const { data: neu, error } = await sb.from("shop_artikel").insert({
          artikelnr,
          name: artikel.name,
          preis_netto: artikel.preis_netto,
          preis_quelle: "r-f-shop",
          preis_stand: new Date().toISOString(),
          bild_url: artikel.bild_url ?? null,
          bild_ist_extern: !!artikel.bild_url,
          lieferant: "R+F",
          einheit: "Stück",
          aktiv: true,
          sichtbar_aufmass: true,
          bestellbar: false,
        }).select("id").single()
        if (error) return json({ fehler: `Artikel anlegen fehlgeschlagen: ${error.message}` }, 500)
        artikelId = neu.id
        angelegt = true
      } else if (!vorhanden?.sichtbar_aufmass) {
        await sb.from("shop_artikel").update({ sichtbar_aufmass: true }).eq("id", artikelId)
      }

      // 3. Zeile an die Kategorie. Schon vorhanden heißt: nichts tun.
      const { data: schon } = await sb.from("aufmass_kategorie_position")
        .select("id, aktiv").eq("kategorie_id", kategorieId).eq("artikel_id", artikelId).maybeSingle()
      if (schon) {
        if (!schon.aktiv) await sb.from("aufmass_kategorie_position").update({ aktiv: true }).eq("id", schon.id)
        return json({ ok: true, artikelId, positionId: schon.id, angelegt, schon_vorhanden: true, artikel })
      }
      const { data: maxP } = await sb.from("aufmass_kategorie_position")
        .select("sortierung").eq("kategorie_id", kategorieId)
        .order("sortierung", { ascending: false }).limit(1).maybeSingle()
      const { data: pos, error: posErr } = await sb.from("aufmass_kategorie_position").insert({
        kategorie_id: kategorieId,
        art: "artikel",
        artikel_id: artikelId,
        bezeichnung: String(artikel.name).slice(0, 60),
        sortierung: Number(maxP?.sortierung ?? 0) + 10,
      }).select("id").single()
      if (posErr) return json({ fehler: `Zeile anlegen fehlgeschlagen: ${posErr.message}` }, 500)

      return json({ ok: true, artikelId, positionId: pos.id, angelegt, artikel, kategorie: kat.name })
    }

    return json({ fehler: `Unbekannte Aktion "${aktion}"` }, 400)
  } catch (e) {
    const f = e as any
    const status = typeof f?.status === "number" && f.status >= 400 && f.status < 600 ? f.status : 502
    return json({ fehler: String(f?.message ?? e), sitzungAbgelaufen: !!f?.sitzungAbgelaufen }, status)
  }
})
