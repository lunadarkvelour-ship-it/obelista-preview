// extension/popup.js
//
// Показывает ЖИВОЕ состояние с бэка: последние дропы, время, сколько.
// Не доверяем только chrome.storage.local.lastResult — он пуст, пока
// SW не дёрнул harvestToken (а он не дёргается на install/startup у
// уже-залогиненного юзера, поправлено в background.js). Поэтому попап
// сам ходит в /api/extension/state через SW и рисует что есть.

const $status = document.getElementById("status")
const $meta = document.getElementById("meta")
const $drops = document.getElementById("drops")
const $open = document.getElementById("open-options")

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

;(async () => {
  try {
    // 1) local — нужно чтобы понять, задан ли endpoint
    const local = await chrome.runtime.sendMessage({ type: "get_status" })
    if (!local || !local.endpoint) {
      setStatus("Not configured", "idle")
      $meta.textContent = "Open options to set endpoint."
      $drops.innerHTML = ""
      return
    }

    // 2) живое состояние с бэка
    const r = await chrome.runtime.sendMessage({ type: "get_state" })
    if (r && r.ok && r.body) {
      const { drops = [], health = {} } = r.body
      const total = Array.isArray(drops) ? drops.length : 0
      if (total > 0) {
        const last = drops[0]
        const uptime = health.uptime_s ? ` · up ${Math.round(health.uptime_s / 60)}m` : ""
        setStatus("Connected", "ok")
        $meta.textContent = `${total} drop${total === 1 ? "" : "s"}${uptime} · last ${fmtTime(last.received_at)}`
        renderDrops(drops)
      } else {
        setStatus("Idle", "idle")
        $meta.textContent = "Backend reachable, no drops yet."
        $drops.innerHTML = ""
      }
    } else {
      // бэк недоступен — показываем что знаем локально, не притворяемся
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
