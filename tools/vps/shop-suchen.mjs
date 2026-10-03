// shop-suchen.mjs — Freitextsuche in einem Lieferantenshop, mit Nummern und
// Preisen. Rein lesend, nichts wird in einen Warenkorb gelegt.
//
// Gegenstueck zu shop-nummern.mjs: das schlaegt eine bekannte Nummer nach,
// dieses hier findet den Artikel, wenn nur die Bezeichnung feststeht. Genau
// der Fall beim Regieaufmass, wenn die Nummer auf dem Zettel zu nichts passt.
//
// Mit --details N werden fuer die ersten N Treffer die Bezeichnungen
// nachgeladen, sofern die Trefferliste des Shops keine fuehrt (GUT). Das
// kostet je Treffer einen Seitenwechsel, deshalb nicht fuer alle.
//
// Aufruf: node shop-suchen.mjs --lieferant gut "KFE Hahn" [--details 5] [--max 20]

import { oeffnen, playbook, seiteOeffnen } from './shop-lib.mjs'

const args = process.argv.slice(2)
const wert = (n, s) => { const i = args.indexOf(`--${n}`); return i >= 0 && args[i + 1] ? args[i + 1] : s }
const slug = wert('lieferant', null)
const max = Number(wert('max', 20))
const details = Number(wert('details', 0))
// --json: Ausgabe fuer Maschinen statt fuer Menschen. So ruft weich-api das
// Skript, und die Antwort geht unveraendert bis in die Oberflaeche durch.
const alsJson = args.includes('--json')
const begriff = args.find((a, i) => !a.startsWith('--') && !['--lieferant', '--max', '--details'].includes(args[i - 1]))
if (!slug || !begriff) { console.error('Aufruf: --lieferant <slug> "<begriff>"'); process.exit(1) }

const { browser, page, angemeldet } = await oeffnen(slug)
if (!angemeldet) {
  // Eigenes Kennzeichen: eine abgelaufene Sitzung ist kein Suchfehler, sondern
  // braucht eine neue Anmeldung. Der Aufrufer soll nicht sinnlos wiederholen.
  if (alsJson) console.log(JSON.stringify({ sitzung_abgelaufen: true, lieferant: slug }))
  else console.error(`${slug}: nicht angemeldet`)
  await browser.close(); process.exit(2)
}
const pb = playbook(slug)

try {
  // Zwei Wege zur Trefferliste, und der zweite faengt den ersten auf.
  //
  // Nicht jedes Playbook hat ein eigenes suchen(): vier von sieben kennen nur
  // eine sucheUrl, und dort stuerzte der Aufruf ab ("pb.suchen is not a
  // function") - erst in der Oberflaeche, nicht beim Anlegen der Weissliste.
  //
  // Und wo es eines gibt, kann sein Selektor veraltet sein: bei R+F wartete
  // suchen() am 03.10.2026 vergeblich auf ein Suchfeld, das es so nicht mehr
  // gibt. Deshalb faengt der URL-Weg auch einen Fehlschlag auf, statt nur ein
  // fehlendes suchen() zu ersetzen.
  let gesucht = false
  if (typeof pb.suchen === "function") {
    try {
      await pb.suchen(page, begriff)
      gesucht = true
    } catch (e) {
      console.error(`${slug}: suchen() scheiterte (${String(e).slice(0, 80)}), versuche die Such-URL`)
    }
  }
  if (!gesucht) {
    if (typeof pb.sucheUrl !== "function") {
      const hinweis = `${slug}: dieses Playbook kann nicht suchen`
      if (alsJson) console.log(JSON.stringify({ fehler: hinweis, lieferant: slug }))
      else console.error(hinweis)
      await browser.close()
      process.exit(3)
    }
    await seiteOeffnen(page, pb.sucheUrl(begriff), pb)
    await page.waitForTimeout(2500)
  }

  // Bevor irgendetwas ausgelesen wird: ist das ueberhaupt eine Suchseite?
  // Eine abgelaufene Sitzung zeigt das Login, und der Textweg liest daraus
  // brav "Benutzername" und "Passwort vergessen" als Artikel. Scheintreffer
  // sind schlimmer als keine - sie sehen aus wie ein Ergebnis.
  const istLogin = await page.evaluate(() => {
    const t = document.body.innerText.slice(0, 4000)
    return /Passwort vergessen|Kennwort vergessen|melden Sie sich|Zugangsdaten eingeben|um sich im Online Shop anzumelden/i.test(t)
      && !/Warenkorb|Treffer|Artikelnummer/i.test(t)
  }).catch(() => false)
  if (istLogin || /\/login/i.test(page.url())) {
    const hinweis = `${slug}: Sitzung abgelaufen, die Seite zeigt das Login`
    if (alsJson) console.log(JSON.stringify({ sitzung_abgelaufen: true, lieferant: slug, url: page.url() }))
    else console.error(hinweis)
    await browser.close()
    process.exit(2)
  }

  let treffer = typeof pb.trefferAusListe === "function" ? await pb.trefferAusListe(page).catch(() => []) : []

  // Kein Playbook-Weg, oder er fand nichts: der Textweg liest die Seite als
  // Text. Grober, aber er funktioniert bei jedem Shop - ohne ihn liefern
  // fuenf von sieben Lieferanten immer eine leere Liste.
  if (!treffer.length) {
    treffer = await page.evaluate(() => {
      const zeilen = document.body.innerText.replace(/\r/g, "").split("\n").map((z) => z.trim()).filter(Boolean)
      const istPreis = (z) => /^[\d.]+,\d{2}\s*€?$/.test(z)
      // Eine Artikelnummer traegt immer Ziffern, und mindestens drei am
      // Stueck. Ohne diese Schranke hielt der Textweg "WarenkorbPLUS" und
      // "Bestellmatrix" aus der Navigation fuer Artikel.
      const istNummer = (z) => /^[A-Z0-9][A-Z0-9.\-\/]{4,}$/i.test(z)
        && /\d{3}/.test(z) && !istPreis(z)
      const zahl = (t) => (t ? Number(t.replace(/[^\d,]/g, "").replace(",", ".")) : null)
      const out = []
      for (let i = 0; i < zeilen.length && out.length < 40; i++) {
        if (!istNummer(zeilen[i])) continue
        const danach = zeilen.slice(i + 1, i + 8)
        const preise = danach.filter(istPreis)
        const titel = danach.find((z) => z.length > 10 && !istPreis(z) && !/^\+/.test(z))
        // Ohne Bezeichnung ist es keine Artikelzeile, sondern irgendeine
        // andere Zeichenkette auf der Seite.
        if (!titel) continue
        out.push({
          url: location.href,
          artikelnummer: zeilen[i],
          titel,
          netto_preis: zahl(preise[0] ?? null),
          listenpreis: zahl(preise[1] ?? null),
          einheit: danach.find((z) => /^(STK|MTR|PAK|ROL|KG|LTR|SET|Stück|m)$/i.test(z)) || null,
        })
      }
      return out
    }).catch(() => [])
  }

  treffer = treffer.slice(0, max)

  // Bezeichnungen nachladen, wo die Liste keine fuehrt. Jeder Aufruf wechselt
  // die Seite, deshalb wird danach neu gesucht — sonst findet der naechste
  // Durchgang seine Zeile nicht mehr.
  for (let i = 0; i < Math.min(details, treffer.length); i++) {
    if (treffer[i].titel || typeof pb.detail !== 'function') continue
    const d = await pb.detail(page, treffer[i].artikelnummer).catch(() => null)
    if (d?.titel) { treffer[i].titel = d.titel; treffer[i].hersteller = d.hersteller ?? null }
    await pb.suchen(page, begriff)
  }

  if (alsJson) {
    // Die URL gehoert mit: eine Suche, die still auf der Startseite bleibt,
    // liefert eine Liste, die wie ein Ergebnis aussieht und keines ist.
    const norm = (x) => String(x || '').toUpperCase().replace(/[^A-Z0-9]/g, '')
    console.log(JSON.stringify({
      lieferant: slug,
      begriff,
      url: page.url(),
      gesamt: treffer.length,
      treffer: treffer.map((t) => ({
        artikelnr: t.artikelnummer ?? null,
        name: t.titel ?? null,
        hersteller: t.hersteller ?? null,
        preis_netto: t.netto_preis ?? null,
        listenpreis: t.listenpreis ?? null,
        einheit: t.einheit ?? null,
        // Sagt der Oberflaeche, ob sie den Treffer vorschlagen darf oder nur
        // anbieten: eine uebereinstimmende Nummer ist etwas anderes als ein
        // Artikel, der bei der Suche zufaellig mit dabei war.
        exakt: norm(t.artikelnummer) === norm(begriff),
      })),
    }))
  } else {
    console.log(`"${begriff}" bei ${slug} — ${treffer.length} Treffer  [${page.url()}]`)
    for (const t of treffer) {
      const preis = t.netto_preis != null ? `${t.netto_preis.toFixed(2)} €` : '?'
      console.log(`${String(t.artikelnummer ?? '?').padEnd(16)} ${preis.padStart(10)} ${(t.einheit ?? '').padEnd(10)} ${t.titel ?? ''}`)
    }
  }
} finally {
  await browser.close()
}
