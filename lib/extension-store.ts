// lib/extension-store.ts
//
// Два режима:
//   - "forward" (по умолчанию в проде): все запросы идут в obelista_mcp backend
//     через EXTENSION_BACKEND_URL. Панель ничего не хранит сама — это proxy.
//   - "local" (для dev/demo): in-memory + файл /tmp/extension-drops.json.
//     Бэкенд не нужен, удобно гонять UI локально без поднятого obelista_mcp.
//
// Контракт в обоих режимах одинаковый: record() / state() возвращают то же, что
// backend. Свич — одной env переменной, без правки кода.

import type { IngestRequest, ExtensionState } from "./extension-types"

const STORE_MODE = (process.env.EXTENSION_STORE_MODE ?? "forward") as "forward" | "local"
const BACKEND_URL = process.env.EXTENSION_BACKEND_URL ?? ""
const BACKEND_TOKEN = process.env.EXTENSION_BACKEND_TOKEN ?? ""
const FILE_PATH = process.env.EXTENSION_DATA_FILE ?? "/tmp/extension-drops.json"

interface LocalDrop {
  id: string
  fb_user_id: string
  type: string
  captured_at: string
  received_at: string
  summary: string
  payload: unknown
}

let localDrops: LocalDrop[] = []
let localStartedAt = Date.now()

async function loadLocal() {
  if (STORE_MODE !== "local") return
  try {
    const fs = await import("node:fs/promises")
    const raw = await fs.readFile(FILE_PATH, "utf8")
    localDrops = JSON.parse(raw)
  } catch {
    localDrops = []
  }
}

async function saveLocal() {
  if (STORE_MODE !== "local") return
  try {
    const fs = await import("node:fs/promises")
    await fs.writeFile(FILE_PATH, JSON.stringify(localDrops, null, 2), "utf8")
  } catch {
    /* /tmp может не писаться — ок, in-memory остаётся */
  }
}

function summarize(req: IngestRequest): string {
  if (req.type === "token") {
    const p = req.payload as { access_token?: string }
    return p.access_token ? `token (${p.access_token.slice(0, 8)}...)` : "token (empty)"
  }
  if (req.type === "adsmanager_state") {
    const p = req.payload as { accounts?: Array<{ act_id: string; campaigns?: unknown[] }> }
    const accs = p.accounts?.length ?? 0
    const camps = p.accounts?.reduce((s, a) => s + (a.campaigns?.length ?? 0), 0) ?? 0
    return `${accs} accounts, ${camps} campaigns`
  }
  return req.type
}

if (STORE_MODE === "local") {
  loadLocal()
}

export const store = {
  async record(req: IngestRequest): Promise<{ ok: boolean; id?: string; error?: string }> {
    if (STORE_MODE === "forward") {
      if (!BACKEND_URL) return { ok: false, error: "EXTENSION_BACKEND_URL not set" }
      try {
        const r = await fetch(`${BACKEND_URL}/extension/ingest`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${BACKEND_TOKEN}`,
          },
          body: JSON.stringify(req),
          cache: "no-store",
        })
        const data = (await r.json()) as { ok?: boolean; id?: string; error?: string }
        return { ok: r.ok && !!data.ok, id: data.id, error: data.error }
      } catch (e) {
        return { ok: false, error: String(e) }
      }
    }
    // local
    const drop: LocalDrop = {
      id: crypto.randomUUID(),
      fb_user_id: req.fb_user_id,
      type: req.type,
      captured_at: req.captured_at,
      received_at: new Date().toISOString(),
      summary: summarize(req),
      payload: req.payload,
    }
    localDrops.unshift(drop)
    if (localDrops.length > 500) localDrops = localDrops.slice(0, 500)
    await saveLocal()
    return { ok: true, id: drop.id }
  },

  async state(): Promise<ExtensionState> {
    if (STORE_MODE === "forward") {
      if (!BACKEND_URL) {
        return { tokens: [], drops: [], health: { uptime_s: 0, last_ingest_at: null, total_drops: 0 } }
      }
      try {
        const r = await fetch(`${BACKEND_URL}/extension/state`, {
          headers: { Authorization: `Bearer ${BACKEND_TOKEN}` },
          cache: "no-store",
        })
        if (!r.ok) {
          return { tokens: [], drops: [], health: { uptime_s: 0, last_ingest_at: null, total_drops: 0 } }
        }
        return (await r.json()) as ExtensionState
      } catch {
        return { tokens: [], drops: [], health: { uptime_s: 0, last_ingest_at: null, total_drops: 0 } }
      }
    }
    // local
    const tokensMap = new Map<string, { last_seen: string; count: number }>()
    for (const d of localDrops) {
      const t = tokensMap.get(d.fb_user_id) ?? { last_seen: d.received_at, count: 0 }
      if (d.received_at > t.last_seen) t.last_seen = d.received_at
      t.count++
      tokensMap.set(d.fb_user_id, t)
    }
    const tokens = Array.from(tokensMap.entries()).map(([id, v]) => ({
      fb_user_id: id,
      last_seen: v.last_seen,
      drop_count: v.count,
    }))
    const drops = localDrops.slice(0, 50).map((d) => ({
      fb_user_id: d.fb_user_id,
      type: d.type as "token" | "adsmanager_state",
      captured_at: d.captured_at,
      summary: d.summary,
    }))
    return {
      tokens,
      drops,
      health: {
        uptime_s: Math.floor((Date.now() - localStartedAt) / 1000),
        last_ingest_at: localDrops[0]?.received_at ?? null,
        total_drops: localDrops.length,
      },
    }
  },
}

export const storeMode = STORE_MODE
