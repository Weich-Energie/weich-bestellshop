// mcp-lokal.mjs — spricht den weich-api MCP-Server auf dem VPS lokal ueber
// Streamable HTTP an (localhost:3000/mcp), unabhaengig von der MCP-Verbindung
// einer Claude-Sitzung. Nur lesende Aufrufe; api_aufrufen blockt Schreiben
// serverseitig, solange ALLOW_WRITES nicht gesetzt ist.
//
// Aufruf: node mcp-lokal.mjs <toolname> '<json-args>'
//   z. B. node mcp-lokal.mjs api_suchen '{"query":"Warengruppe"}'
const BASIS = process.env.MCP_URL ?? 'http://localhost:3000/mcp'
const [, , tool, argsJson] = process.argv
if (!tool) { console.error('Aufruf: node mcp-lokal.mjs <tool> [json-args]'); process.exit(1) }
const args = argsJson ? JSON.parse(argsJson) : {}

let sessionId = null
let naechsteId = 1

async function rpc(method, params, { erwarteAntwort = true } = {}) {
  const body = { jsonrpc: '2.0', method, params }
  if (erwarteAntwort) body.id = naechsteId++
  const r = await fetch(BASIS, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      accept: 'application/json, text/event-stream',
      // Token kommt aus der .env des Servers (per Wrapper-Skript in MCP_TOKEN
      // gelegt) — der Wert verlaesst den VPS nicht.
      ...(process.env.MCP_TOKEN ? { authorization: `Bearer ${process.env.MCP_TOKEN}` } : {}),
      ...(sessionId ? { 'mcp-session-id': sessionId } : {}),
    },
    body: JSON.stringify(body),
  })
  const sid = r.headers.get('mcp-session-id')
  if (sid) sessionId = sid
  const text = await r.text()
  if (!erwarteAntwort) return null
  if (!r.ok) throw new Error(`HTTP ${r.status}: ${text.slice(0, 500)}`)
  // Streamable HTTP darf JSON oder SSE liefern — beides abfangen.
  const ct = r.headers.get('content-type') ?? ''
  if (ct.includes('text/event-stream')) {
    const daten = text.split('\n').filter((z) => z.startsWith('data:')).map((z) => z.slice(5).trim()).filter(Boolean)
    const antworten = daten.map((d) => { try { return JSON.parse(d) } catch { return null } }).filter(Boolean)
    return antworten.find((a) => a.id === body.id) ?? antworten.at(-1)
  }
  return JSON.parse(text)
}

const init = await rpc('initialize', {
  protocolVersion: '2025-03-26',
  capabilities: {},
  clientInfo: { name: 'mcp-lokal', version: '0.1' },
})
if (init?.error) { console.error('initialize fehlgeschlagen:', JSON.stringify(init.error)); process.exit(2) }
await rpc('notifications/initialized', {}, { erwarteAntwort: false })

const antwort = await rpc('tools/call', { name: tool, arguments: args })
if (antwort?.error) { console.error('Fehler:', JSON.stringify(antwort.error)); process.exit(3) }
const inhalt = antwort?.result?.content ?? []
for (const c of inhalt) {
  if (c.type === 'text') console.log(c.text)
  else console.log(JSON.stringify(c))
}
// Session serverseitig schliessen und hart beenden — offene Keep-Alive-Sockets
// halten node sonst am Leben.
if (sessionId) await fetch(BASIS, { method: 'DELETE', headers: { 'mcp-session-id': sessionId } }).catch(() => {})
process.exit(antwort?.result?.isError ? 4 : 0)
