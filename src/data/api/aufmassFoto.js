// Aufmasszettel als Foto — die Uebergangsloesung, bis das Aufmass durchgaengig
// in der App erfasst wird (Gewerk klima in weich-aufmass).
//
// Ablauf: Foto hochladen, KI liest die Zeilen, Mensch bestaetigt, daraus werden
// Nachkalkulations-Positionen. Zwischen "gelesen" und "Position" liegt bewusst
// ein Bestaetigungsschritt: Handschrift wird verwechselt, und der Vordruck
// traegt gedruckte Mengen, die nicht gelten.

import { supabase } from '../../supabaseClient.js'
import { normalizeArtikelnr } from './belege.js'

const BUCKET = 'shop-belege'
const PRAEFIX = 'aufmass'

// ─── Hochladen ─────────────────────────────────────────────────────────

export async function uploadAufmassFoto({ nachkalkulationId, file, seitennr = null, erfasstVon = null }) {
  const stamp = Date.now()
  const rand = Math.random().toString(36).slice(2, 8)
  const name = file.name.replace(/[^a-zA-Z0-9._-]/g, '_')
  const pfad = `${PRAEFIX}/${nachkalkulationId}/${stamp}-${rand}-${name}`

  const { error: upErr } = await supabase.storage
    .from(BUCKET)
    .upload(pfad, file, { cacheControl: '3600', upsert: false })
  if (upErr) throw upErr

  const { data, error } = await supabase
    .from('shop_aufmass_foto')
    .insert({
      nachkalkulation_id: nachkalkulationId,
      bild_pfad: pfad,
      original_name: file.name,
      seitennr,
      status: 'neu',
      erfasst_von: erfasstVon || null,
    })
    .select()
    .single()
  if (error) throw error
  return data
}

// ─── Lesen lassen ──────────────────────────────────────────────────────

// Ruft shop-ai, schreibt die gelesenen Zeilen und ordnet ihnen Shop-Artikel zu.
// Ein zweiter Lauf ersetzt die noch offenen Zeilen; bereits uebernommene
// bleiben stehen, sonst haette man sie doppelt in der Nachkalkulation.
export async function leseAufmassFoto(fotoId) {
  const { data: foto, error: fErr } = await supabase
    .from('shop_aufmass_foto')
    .select('id, bild_pfad, nachkalkulation_id')
    .eq('id', fotoId)
    .single()
  if (fErr) throw fErr

  // Welche Baustelle gerade bearbeitet wird. Ein Stundenzettel läuft oft über
  // eine ganze Woche und führt mehrere Baustellen — ohne diesen Hinweis wandern
  // fremde Zeilen in die Nachkalkulation (Patrick, 02.10.2026, Fall Schmidt).
  const { data: nk } = await supabase
    .from('shop_nachkalkulation')
    .select('bezeichnung, pds_vorgangs_nummer, baustelle_adresse')
    .eq('id', foto.nachkalkulation_id)
    .single()
  const baustelleHinweis = [
    nk?.bezeichnung,
    nk?.baustelle_adresse,
    nk?.pds_vorgangs_nummer && nk.pds_vorgangs_nummer !== '—' ? `Auftrag ${nk.pds_vorgangs_nummer}` : null,
  ].filter(Boolean).join(' · ')

  await supabase.from('shop_aufmass_foto').update({ status: 'laeuft', fehler_text: null }).eq('id', fotoId)

  try {
    const { data: signed, error: sErr } = await supabase.storage
      .from(BUCKET)
      .createSignedUrl(foto.bild_pfad, 300)
    if (sErr) throw sErr

    // Der Katalog als Abgleichliste. Das ist der groesste Hebel fuer die
    // Lesequalitaet: das Modell muss die Nummer nicht raten, sondern kann sie
    // wiedererkennen. Dazu die GUT-Nummern, denn die stehen auf den Zetteln —
    // im Shop steht derselbe Artikel unter seiner R+F-Nummer.
    const [artikel, bruecke] = await Promise.all([alleArtikel(), gutBruecke()])
    const rueckwaerts = new Map()
    for (const [gut, rf] of bruecke) if (!rueckwaerts.has(rf)) rueckwaerts.set(rf, gut)
    const hinweis = artikel
      .map((a) => {
        const gut = rueckwaerts.get(normalizeArtikelnr(a.artikelnr))
        return `${a.artikelnr || '—'}${gut ? ` (auch ${gut})` : ''} = ${a.name}`
      })
      .join('\n')

    const { data: antwort, error: aiErr } = await supabase.functions.invoke('shop-ai', {
      body: {
        task: 'extract_aufmass',
        bild_url: signed.signedUrl,
        artikel_hinweis: hinweis,
        baustelle_hinweis: baustelleHinweis,
      },
    })
    if (aiErr) throw aiErr
    if (antwort?.error) throw new Error(antwort.error)
    const ergebnis = antwort?.result
    if (!ergebnis) throw new Error('Kein Ergebnis von der KI')

    // Drei Sorten Blatt kommen durch denselben Upload: Materialliste,
    // Stundenzettel, Angebot. Die KI schlaegt vor, was sie gelesen hat.
    const art = ['material', 'stunden', 'angebot'].includes(ergebnis.blatt_art)
      ? ergebnis.blatt_art
      : 'unbekannt'

    // Stundenzettel: die Zeilen bleiben als Rohergebnis stehen. Sie laufen
    // NICHT von selbst in die Stundenfelder — welcher Name Techniker ist und
    // welcher Monteur, weiss nur der Betrieb, und der Satz unterscheidet sich.
    if (art === 'stunden') {
      const stundenZeilen = Array.isArray(ergebnis.stunden_zeilen) ? ergebnis.stunden_zeilen : []
      await supabase
        .from('shop_aufmass_foto')
        .update({
          status: 'gelesen',
          blatt_art: art,
          gelesen_am: new Date().toISOString(),
          stunden_gelesen: {
            zeilen: stundenZeilen,
            summe: stundenZeilen.reduce((s, z) => s + Number(z.stunden || 0), 0),
            baustelle: ergebnis.baustelle || null,
            datum: ergebnis.datum || null,
          },
        })
        .eq('id', fotoId)
      return {
        blatt_art: art,
        stunden_zeilen: stundenZeilen.length,
        stunden_summe: stundenZeilen.reduce((s, z) => s + Number(z.stunden || 0), 0),
      }
    }

    // Angebot: die Positionen sind das Soll, nicht das Ist. Sie werden hier nur
    // gelesen und zurueckgegeben; uebernommen wird mit uebernimmAngebot(), weil
    // das die Soll-Werte des Auftrags ueberschreibt.
    if (art === 'angebot') {
      const positionen = Array.isArray(ergebnis.angebot_positionen) ? ergebnis.angebot_positionen : []
      await supabase
        .from('shop_aufmass_foto')
        .update({
          status: 'gelesen',
          blatt_art: art,
          gelesen_am: new Date().toISOString(),
          stunden_gelesen: {
            angebot_positionen: positionen,
            summe_vk: ergebnis.angebot_summe_vk ?? null,
            baustelle: ergebnis.baustelle || null,
            datum: ergebnis.datum || null,
          },
        })
        .eq('id', fotoId)
      return { blatt_art: art, positionen: positionen.length, summe_vk: ergebnis.angebot_summe_vk ?? null }
    }

    // Offene Zeilen eines frueheren Laufs raeumen - aber nur die, an denen
    // niemand war. Was von Hand zugeordnet, korrigiert oder mit einer Notiz
    // versehen wurde, bleibt stehen: diese Entscheidungen stehen nicht auf dem
    // Blatt und koennte kein zweiter Lesedurchgang wiederherstellen.
    await supabase
      .from('shop_aufmass_foto_zeile')
      .delete()
      .eq('foto_id', fotoId)
      .eq('status', 'offen')
      .eq('von_hand', false)

    // Was von Hand bleibt, darf nicht noch einmal als neue Zeile entstehen.
    const { data: behalten } = await supabase
      .from('shop_aufmass_foto_zeile')
      .select('roh_artikelnr, roh_bezeichnung')
      .eq('foto_id', fotoId)
      .eq('status', 'offen')
    const schonDa = new Set(
      (behalten || []).map((b) => `${normalizeArtikelnr(b.roh_artikelnr)}|${(b.roh_bezeichnung || '').toLowerCase().trim()}`),
    )

    const zeilen = Array.isArray(ergebnis.zeilen) ? ergebnis.zeilen : []
    const rows = zeilen
      .filter((z) => z && z.menge != null && Number(z.menge) > 0)
      .map((z) => {
        const treffer = findeArtikel(artikel, z, bruecke)
        return {
          foto_id: fotoId,
          roh_artikelnr: z.artikelnr || null,
          roh_bezeichnung: z.bezeichnung || null,
          roh_menge: Number(z.menge),
          roh_einheit: z.einheit || null,
          sicherheit: z.sicherheit != null ? Math.min(1, Math.max(0, Number(z.sicherheit))) : null,
          artikel_id: treffer.artikel?.id || null,
          treffer_art: treffer.art,
          notiz: z.notiz || null,
          status: 'offen',
        }
      })

    const neueRows = rows.filter(
      (r) => !schonDa.has(`${normalizeArtikelnr(r.roh_artikelnr)}|${(r.roh_bezeichnung || '').toLowerCase().trim()}`),
    )
    if (neueRows.length) {
      const { error: insErr } = await supabase.from('shop_aufmass_foto_zeile').insert(neueRows)
      if (insErr) throw insErr
    }

    // Ein Materialblatt traegt haeufig auch die Stunden — der Monteur schreibt
    // beides auf denselben Zettel. Sie werden mitgenommen und warten auf die
    // Rollenzuordnung wie bei einem reinen Stundenzettel.
    const stundenZeilen = Array.isArray(ergebnis.stunden_zeilen) ? ergebnis.stunden_zeilen : []

    await supabase
      .from('shop_aufmass_foto')
      .update({
        status: 'gelesen',
        blatt_art: art,
        gelesen_am: new Date().toISOString(),
        ...(stundenZeilen.length
          ? {
            stunden_gelesen: {
              zeilen: stundenZeilen,
              summe: stundenZeilen.reduce((s, z) => s + Number(z.stunden || 0), 0),
              baustelle: ergebnis.baustelle || null,
              datum: ergebnis.datum || null,
            },
          }
          : {}),
      })
      .eq('id', fotoId)

    return {
      blatt_art: art,
      stunden_zeilen: stundenZeilen.length,
      kopf: {
        baustelle: ergebnis.baustelle || null,
        datum: ergebnis.datum || null,
        monteur: ergebnis.monteur || null,
      },
      zeilen: neueRows.length,
      behalten: schonDa.size,
      ohne_artikel: neueRows.filter((r) => !r.artikel_id).length,
      unsicher: neueRows.filter((r) => r.sicherheit != null && r.sicherheit < 0.8).length,
    }
  } catch (e) {
    await supabase
      .from('shop_aufmass_foto')
      .update({ status: 'fehler', fehler_text: e.message || String(e) })
      .eq('id', fotoId)
    throw e
  }
}

// Alle aktiven Artikel, nicht nur die mit Klima-Kennzeichen.
//
// Der engere Filter war ein Fehler: das Regieaufmass gilt fuer jedes Gewerk,
// und beim ersten echten Zettel (Waermepumpe) waren 30 von 30 Zeilen "nicht im
// Shop" — obwohl der Shop 486 Artikel fuehrt und nur 32 davon das
// Klima-Kennzeichen tragen.
async function alleArtikel() {
  const { data, error } = await supabase
    .from('shop_artikel')
    .select('id, artikelnr, name, einheit, preis_netto, nachkalkulation_klima')
    .eq('aktiv', true)
    .order('name')
  if (error) throw error
  return data || []
}

// Die Monteure schreiben GUT-Nummern auf, im Shop stehen die R+F-Artikel.
// `shop_gut_rf_zuordnung` ist die Bruecke (400 gepflegte Zuordnungen, siehe
// CLAUDE.md) — ohne sie bleibt jede zweite Zeile unerkannt, obwohl der Artikel
// laengst da ist.
async function gutBruecke() {
  const { data, error } = await supabase
    .from('shop_gut_rf_zuordnung')
    .select('gut_artikelnummer, rf_artikelnummer')
    .eq('entscheidung', 'zugeordnet')
  if (error) return new Map()
  const m = new Map()
  for (const z of data || []) {
    const gut = normalizeArtikelnr(z.gut_artikelnummer)
    if (gut && z.rf_artikelnummer) m.set(gut, normalizeArtikelnr(z.rf_artikelnummer))
  }
  return m
}

// Artikelnummer schlaegt Namen. Eine uebereinstimmende Nummer ist ein harter
// Treffer, der Namensvergleich bleibt Heuristik — deshalb steht die Herkunft
// des Treffers an der Zeile und ist in der Liste sichtbar.
function findeArtikel(artikel, zeile, bruecke) {
  const nr = normalizeArtikelnr(zeile.artikelnr)
  if (nr) {
    const treffer = artikel.find((a) => normalizeArtikelnr(a.artikelnr) === nr)
    if (treffer) return { artikel: treffer, art: 'artikelnr' }

    // Zweiter Anlauf ueber die GUT-Nummer. Zaehlt als harter Treffer: die
    // Zuordnung ist gepflegtes Stammdatum, keine Vermutung.
    const rfNr = bruecke?.get(nr)
    if (rfNr) {
      const ueber = artikel.find((a) => normalizeArtikelnr(a.artikelnr) === rfNr)
      if (ueber) return { artikel: ueber, art: 'artikelnr' }
    }
  }
  const text = String(zeile.bezeichnung || '').toLowerCase().trim()
  if (text.length > 4) {
    const treffer = artikel.find((a) => {
      const n = a.name.toLowerCase().trim()
      return n === text || n.includes(text) || text.includes(n)
    })
    if (treffer) return { artikel: treffer, art: 'name' }
  }
  return { artikel: null, art: 'keiner' }
}

// ─── Lesen ─────────────────────────────────────────────────────────────

export async function listFotos(nachkalkulationId) {
  const { data, error } = await supabase
    .from('shop_aufmass_foto')
    .select(`
      id, bild_pfad, original_name, seitennr, status, blatt_art, stunden_gelesen,
      fehler_text, gelesen_am, created_at,
      shop_aufmass_foto_zeile ( id, status, artikel_id, sicherheit )
    `)
    .eq('nachkalkulation_id', nachkalkulationId)
    .order('created_at', { ascending: true })
  if (error) throw error
  return (data || []).map((f) => {
    const z = f.shop_aufmass_foto_zeile || []
    return {
      ...f,
      shop_aufmass_foto_zeile: undefined,
      zeilen_gesamt: z.length,
      zeilen_offen: z.filter((x) => x.status === 'offen').length,
      zeilen_ohne_artikel: z.filter((x) => x.status === 'offen' && !x.artikel_id).length,
      zeilen_unsicher: z.filter((x) => x.status === 'offen' && x.sicherheit != null && Number(x.sicherheit) < 0.8).length,
    }
  })
}

export async function listZeilen(fotoId) {
  const { data, error } = await supabase
    .from('shop_aufmass_foto_zeile')
    .select(`
      id, roh_artikelnr, roh_bezeichnung, roh_menge, roh_einheit, sicherheit,
      artikel_id, treffer_art, status, position_id, notiz,
      artikel:shop_artikel ( id, artikelnr, name, einheit, preis_netto )
    `)
    .eq('foto_id', fotoId)
    .order('created_at', { ascending: true })
  if (error) throw error
  return data || []
}

export async function getFotoSignedUrl(pfad, gueltigSek = 3600) {
  if (!pfad) return null
  const { data, error } = await supabase.storage.from(BUCKET).createSignedUrl(pfad, gueltigSek)
  if (error) throw error
  return data?.signedUrl || null
}

// ─── Zeilen bearbeiten ─────────────────────────────────────────────────

export async function setZeileMenge(id, menge) {
  const { error } = await supabase
    .from('shop_aufmass_foto_zeile')
    .update({ roh_menge: Number(menge), von_hand: true })
    .eq('id', id)
  if (error) throw error
}

export async function setZeileArtikel(id, artikelId) {
  const { error } = await supabase
    .from('shop_aufmass_foto_zeile')
    .update({ artikel_id: artikelId, treffer_art: artikelId ? 'name' : 'keiner', von_hand: true })
    .eq('id', id)
  if (error) throw error
}

export async function verwirfZeile(id) {
  const { error } = await supabase
    .from('shop_aufmass_foto_zeile')
    .update({ status: 'verworfen', von_hand: true })
    .eq('id', id)
  if (error) throw error
}

// ─── Uebernahme in die Nachkalkulation ─────────────────────────────────

// Der Einkaufspreis wird hier kopiert und nicht verknuepft — dieselbe Regel wie
// bei jeder anderen Position: eine spaetere Preisaenderung darf eine
// abgeschlossene Nachkalkulation nicht rueckwirkend verschieben.
//
// Zeilen ohne Artikel gehen als Freitext durch. Sie bleiben damit sichtbar und
// sind die Arbeitsliste fuer den Artikelstamm der Aufmass-App: was hier steht,
// wurde verbaut und fehlt im Katalog.
export async function uebernimmZeilen(nachkalkulationId, zeilen) {
  const ergebnis = { uebernommen: 0, freitext: 0, uebersprungen: 0 }

  for (const z of zeilen) {
    if (z.status !== 'offen') { ergebnis.uebersprungen += 1; continue }
    const menge = Number(z.roh_menge)
    if (!(menge > 0)) { ergebnis.uebersprungen += 1; continue }

    const artikel = z.artikel || null
    const einzel = artikel?.preis_netto != null ? Number(artikel.preis_netto) : null

    const { data: pos, error } = await supabase
      .from('shop_nachkalkulation_positionen')
      .insert({
        nachkalkulation_id: nachkalkulationId,
        artikel_id: artikel?.id || null,
        freitext: artikel ? null : (z.roh_bezeichnung || z.roh_artikelnr || 'ohne Bezeichnung'),
        menge,
        einheit: z.roh_einheit || artikel?.einheit || null,
        ek_einzel: einzel,
        ek_gesamt: einzel != null ? Math.round(einzel * menge * 100) / 100 : null,
        quelle: 'monteur',
        notiz: z.notiz || null,
      })
      .select('id')
      .single()
    if (error) throw error

    await supabase
      .from('shop_aufmass_foto_zeile')
      .update({ status: 'uebernommen', position_id: pos.id })
      .eq('id', z.id)

    ergebnis.uebernommen += 1
    if (!artikel) ergebnis.freitext += 1
  }

  return ergebnis
}

// ─── Stundenzettel uebernehmen ─────────────────────────────────────────

// Die gelesenen Stunden laufen nicht von selbst in die Felder: welcher Name
// Techniker ist und welcher Monteur, weiss nur der Betrieb, und die Saetze
// unterscheiden sich um 6 EUR die Stunde. Die Zuordnung kommt deshalb aus der
// Oberflaeche, nicht aus dem Blatt.
//
// Addiert wird auf den vorhandenen Stand — ein Auftrag hat mehrere
// Stundenzettel, und jeder bringt seinen Teil mit.
export async function uebernimmStunden(nachkalkulationId, fotoId, { techniker = 0, monteur = 0, zeilen = null }) {
  const { data: nk, error: nErr } = await supabase
    .from('shop_nachkalkulation')
    .select('ist_stunden_techniker, ist_stunden_monteur')
    .eq('id', nachkalkulationId)
    .single()
  if (nErr) throw nErr

  const { data: foto } = await supabase
    .from('shop_aufmass_foto')
    .select('stunden_gelesen')
    .eq('id', fotoId)
    .single()

  const neuT = Number(nk.ist_stunden_techniker || 0) + Number(techniker || 0)
  const neuM = Number(nk.ist_stunden_monteur || 0) + Number(monteur || 0)

  const { error } = await supabase
    .from('shop_nachkalkulation')
    .update({
      ist_stunden_techniker: neuT > 0 ? neuT : null,
      ist_stunden_monteur: neuM > 0 ? neuM : null,
      stunden_quelle: 'zettel',
    })
    .eq('id', nachkalkulationId)
  if (error) throw error

  // Der Merker liegt im jsonb, nicht im Status: ein Materialblatt traegt oft
  // auch die Stunden, und dessen Zeilen sind nach dem Buchen noch offen. Wer
  // hier den Status auf "uebernommen" setzte, erklaerte das Material fuer
  // erledigt, das noch niemand angesehen hat.
  await supabase
    .from('shop_aufmass_foto')
    .update({
      stunden_gelesen: {
        ...(foto?.stunden_gelesen || {}),
        // Die Zeilen kommen mit der Rollen- und Baustellenentscheidung zurück.
        // Beides steht nicht auf dem Blatt und ginge sonst verloren — und der
        // Langtext in PDS führt später nur die Tage auf, die gezählt wurden.
        ...(zeilen ? { zeilen } : {}),
        gebucht_am: new Date().toISOString(),
      },
    })
    .eq('id', fotoId)
  await fotoStatusNachziehen(fotoId)

  return { techniker: neuT, monteur: neuM }
}

// ─── Angebot als Soll uebernehmen ──────────────────────────────────────

// Der Regelfall ist der Soll-Import aus PDS. Oft ist der PDS-Auftrag aber noch
// nicht gefuellt, dann ist das Reonic-Angebot die einzige Soll-Quelle
// (Patrick, 30.09.2026). Die Zahlen sehen gleich aus, sind aber verschieden
// belastbar — deshalb haelt soll_quelle fest, woher sie kamen.
//
// Die Kalkulationsart faellt dabei mit ab: enthaelt das Angebot ausser Geraeten
// noch Montage- oder Materialpositionen, waren die Stunden ausgewiesen; stehen
// nur Geraete darin, steckte die Zeit im Geraetepreis.
export async function uebernimmAngebot(nachkalkulationId, fotoId) {
  const { data: foto, error: fErr } = await supabase
    .from('shop_aufmass_foto')
    .select('stunden_gelesen, bild_pfad')
    .eq('id', fotoId)
    .single()
  if (fErr) throw fErr

  const positionen = foto.stunden_gelesen?.angebot_positionen || []
  if (!positionen.length) throw new Error('Im Angebot wurde keine Position gelesen')

  const zahl = (v) => (v == null ? 0 : Number(v) || 0)
  const geraete = positionen.filter((p) => p.ist_geraet)
  const uebrige = positionen.filter((p) => !p.ist_geraet)

  const vkGesamt = foto.stunden_gelesen?.summe_vk != null
    ? Number(foto.stunden_gelesen.summe_vk)
    : positionen.reduce((s, p) => s + zahl(p.vk_gesamt), 0)
  const vkGeraete = geraete.reduce((s, p) => s + zahl(p.vk_gesamt), 0)
  const ekGeraete = geraete.reduce((s, p) => s + zahl(p.ek_gesamt), 0)
  const erloesMontage = uebrige.reduce((s, p) => s + zahl(p.vk_gesamt), 0)

  const { data: nk } = await supabase
    .from('shop_nachkalkulation')
    .select('kalkulationsart')
    .eq('id', nachkalkulationId)
    .single()

  const felder = {
    soll_quelle: 'reonic_angebot',
    soll_beleg_pfad: foto.bild_pfad,
    soll_vk_gesamt: runde(vkGesamt),
    soll_vk_geraete: runde(vkGeraete),
    soll_ek_geraete: runde(ekGeraete),
    soll_erloes_montage: runde(erloesMontage),
    soll_stand: new Date().toISOString(),
    soll_positionen: { angebot: positionen },
  }
  // Eine von Hand gesetzte Art bleibt stehen.
  if (!nk?.kalkulationsart || nk.kalkulationsart === 'unbekannt') {
    felder.kalkulationsart = erloesMontage > 0 ? 'stunden_ausgewiesen' : 'zeit_im_artikel'
  }

  const { error } = await supabase.from('shop_nachkalkulation').update(felder).eq('id', nachkalkulationId)
  if (error) throw error

  await supabase.from('shop_aufmass_foto').update({ status: 'uebernommen' }).eq('id', fotoId)
  return {
    positionen: positionen.length,
    vk_gesamt: runde(vkGesamt),
    ek_geraete: runde(ekGeraete),
    // Ohne Einkaufspreise im Angebot fehlt die halbe Rechnung — das gehoert
    // gesagt, nicht stillschweigend als 0 gefuehrt.
    ohne_ek: geraete.filter((p) => p.ek_gesamt == null).length,
  }
}

function runde(n) {
  return Math.round(Number(n || 0) * 100) / 100
}

// ─── Nachkalkulation ohne PDS-Auftrag ──────────────────────────────────

// Fuer den Fall, dass es den Auftrag in PDS noch gar nicht gibt. Der Bezug zum
// Vorgang kann spaeter nachgetragen werden; bis dahin traegt die Zeile nur den
// Namen der Baustelle.
export async function neueNachkalkulation({ bezeichnung, reonicProjektId = null }) {
  const { data, error } = await supabase
    .from('shop_nachkalkulation')
    .insert({
      pds_vorgang_uuid: null,
      pds_vorgangs_nummer: '—',
      bezeichnung,
      soll_quelle: 'hand',
      reonic_projekt_id: reonicProjektId,
    })
    .select('id')
    .single()
  if (error) throw error
  return data
}

// Setzt das Foto auf "uebernommen", wenn keine offene Zeile mehr da ist.
export async function fotoStatusNachziehen(fotoId) {
  const { count, error } = await supabase
    .from('shop_aufmass_foto_zeile')
    .select('id', { count: 'exact', head: true })
    .eq('foto_id', fotoId)
    .eq('status', 'offen')
  if (error) throw error
  if (count === 0) {
    await supabase.from('shop_aufmass_foto').update({ status: 'uebernommen' }).eq('id', fotoId)
  }
}

// ─── Loeschen ──────────────────────────────────────────────────────────

// Das Bild geht mit. Die daraus entstandenen Positionen bleiben stehen — sie
// gehoeren zur Nachkalkulation, nicht zum Foto.
export async function deleteFoto(id) {
  const { data: foto } = await supabase.from('shop_aufmass_foto').select('bild_pfad').eq('id', id).single()
  if (foto?.bild_pfad) {
    try { await supabase.storage.from(BUCKET).remove([foto.bild_pfad]) } catch { /* egal */ }
  }
  const { error } = await supabase.from('shop_aufmass_foto').delete().eq('id', id)
  if (error) throw error
}
