// extension/popup.js
//
// Показывает ЖИВОЕ состояние с бэка: последние дропы, время, сколько.
// Кнопка Refresh принудительно триггерит harvestToken в SW и сравнивает
// новый токен с тем что попап видел в прошлый раз — пишет "token same"
// или "token updated".

const $status = document.getElementById("status")
const $meta = document.getElementById("meta")
const $drops = document.getElementById("drops")
const $open = document.getElementById("open-options")
const $refresh = document.getElementById("refresh")

const TOKEN_CACHE_KEY = "lastSeenTokenSummary"
let lastSeenTokenSummary = null

function setStatus(label, cls) {
  $status.textContent = label
  $status.className = `pill ${cls}`
}

function fmtTime(iso) {
  if (!iso) return ""
  const d = new Date(iso)
  if (isNaN(d.getTime())) return ""
  return d.toLocaleTimeString()
}

function fmtAgo(iso) {
  if (!iso) return ""
  const d = new Date(iso)
  if (isNaN(d.getTime())) return ""
  const sec = Math.max(0, Math.round((Date.now() - d.getTime()) / 1000))
  if (sec < 60) return `${sec}s ago`
  if (sec < 3600) return `${Math.round(sec / 60)}m ago`
  if (sec < 86400) return `${Math.round(sec / 3600)}h ago`
  return `${Math.round(sec / 86400)}d ago`
}

$open.addEventListener("click", (e) => {
  e.preventDefault()
  chrome.runtime.openOptionsPage()
})

function renderDrops(drops) {
  if (!Array.isArray(drops) || drops.length === 0) {
    $drops.innerHTML = `<div class="empty">No drops yet.</div>`
    return
  }
  $drops.innerHTML = drops
    .slice(0, 5)
    .map((d) => {
      const ago = fmtAgo(d.received_at || d.captured_at)
      const summary = (d.summary || "").replace(/[<>]/g, "")
      return `<div class="drop"><span class="t">${ago}</span><span class="s">${summary}</span></div>`
    })
    .join("")
}

async function loadCache() {
  const v = await chrome.storage.local.get(TOKEN_CACHE_KEY)
  lastSeenTokenSummary = v[TOKEN_CACHE_KEY] || null
}

async function saveCache(summary) {
  lastSeenTokenSummary = summary
  await chrome.storage.local.set({ [TOKEN_CACHE_KEY]: summary })
}

async function refreshToken() {
  $refresh.disabled = true
  const oldLabel = $refresh.textContent
  $refresh.textContent = "Refreshing…"
  setStatus("Idle", "idle")
  $meta.textContent = "Forcing harvest…"
  $drops.innerHTML = ""
  try {
    // Триггерим harvest в SW. background сам применит debounce 60s на user
    await chrome.runtime.sendMessage({ type: "harvest_now" }).catch(() => {})
    // Ждём: getAccessToken + verifyToken (≤16s на таймауты) + POST. 2.5s мало
    // для первой попытки, но если кандидат из кэша MAIN world — хватит. Если
    // нет — следующий клик или alarm доделает.
    await new Promise((r) => setTimeout(r, 2500))
    const r = await chrome.runtime.sendMessage({ type: "get_state" })
    if (!r || !r.ok || !r.body) {
      setStatus("Refresh failed", "err")
      $meta.textContent = `Backend unreachable: ${r?.error || r?.status || "?"}`
      return
    }
    const drops = r.body.drops || []
    const tokenDrop = drops.find((d) => d.type === "token")
    const newSummary = tokenDrop ? tokenDrop.summary : null
    if (newSummary && newSummary !== lastSeenTokenSummary) {
      setStatus("Token updated", "ok")
      $meta.textContent = `${newSummary} · ${fmtTime(tokenDrop.received_at)}`
      await saveCache(newSummary)
    } else if (newSummary) {
      setStatus("Token same", "ok")
      $meta.textContent = `${newSummary} · unchanged since ${fmtTime(tokenDrop.received_at)}`
    } else {
      setStatus("No token", "err")
      $meta.textContent = "Harvest ran but backend has no token yet."
    }
    renderDrops(drops)
  } catch (e) {
    setStatus("Error", "err")
    $meta.textContent = String(e)
  } finally {
    $refresh.disabled = false
    $refresh.textContent = oldLabel
  }
}

$refresh.addEventListener("click", () => {
  refreshToken().catch((e) => console.error("[obelista] refresh failed", e))
})

;(async () => {
  await loadCache()
  try {
    const local = await chrome.runtime.sendMessage({ type: "get_status" })
    if (!local || !local.endpoint) {
      setStatus("Not configured", "idle")
      $meta.textContent = "Open options to set endpoint."
      $drops.innerHTML = ""
      return
    }
    const r = await chrome.runtime.sendMessage({ type: "get_state" })
    if (r && r.ok && r.body) {
      const { drops = [], health = {} } = r.body
      const total = Array.isArray(drops) ? drops.length : 0
      const tokenDrop = drops.find((d) => d.type === "token")
      const tokenSummary = tokenDrop ? tokenDrop.summary : null
      if (total > 0) {
        const last = drops[0]
        const uptime = health.uptime_s ? ` · up ${Math.round(health.uptime_s / 60)}m` : ""
        setStatus("Connected", "ok")
        $meta.textContent = `${total} drop${total === 1 ? "" : "s"}${uptime} · last ${fmtTime(last.received_at)}`
        renderDrops(drops)
        // Кэшируем последний виденный токен для сравнения при Refresh
        if (tokenSummary && tokenSummary !== lastSeenTokenSummary) {
          await saveCache(tokenSummary)
        }
        // Если последний дроп старше 2 мин — дёрнем harvest
        const lastAt = new Date(last.received_at || last.captured_at).getTime()
        if (Date.now() - lastAt > 2 * 60_000) {
          $meta.textContent += " · refreshing…"
          chrome.runtime.sendMessage({ type: "harvest_now" }).catch(() => {})
        }
      } else {
        setStatus("Idle", "idle")
        $meta.textContent = "Backend reachable, no drops yet."
        $drops.innerHTML = ""
        chrome.runtime.sendMessage({ type: "harvest_now" }).catch(() => {})
      }
    } else {
      if (local.lastResult && local.lastResult.ok) {
        setStatus("Local ok", "ok")
        $meta.textContent = `Backend down. Last local: ${local.lastResult.type} @ ${fmtTime(local.lastResult.at)}`
      } else {
        setStatus("Offline", "err")
        $meta.textContent = `Backend unreachable: ${r?.error || r?.status || "?"}`
      }
      $drops.innerHTML = ""
    }
  } catch (e) {
    setStatus("Error", "err")
    $meta.textContent = String(e)
  }
})()
