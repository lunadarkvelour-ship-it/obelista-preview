// extension/popup.js

const $status = document.getElementById("status")
const $meta = document.getElementById("meta")
const $open = document.getElementById("open-options")

function setStatus(label, cls, meta) {
  $status.textContent = label
  $status.className = `pill ${cls}`
  $meta.textContent = meta
}

$open.addEventListener("click", (e) => {
  e.preventDefault()
  chrome.runtime.openOptionsPage()
})

;(async () => {
  try {
    const r = await chrome.runtime.sendMessage({ type: "get_status" })
    if (!r) {
      setStatus("Not configured", "idle", "Open options to set endpoint.")
      return
    }
    if (r.lastResult && r.lastResult.ok) {
      const at = r.lastResult.at ? new Date(r.lastResult.at).toLocaleTimeString() : ""
      setStatus("Connected", "ok", `Last: ${r.lastResult.type} ok @ ${at}`)
    } else if (r.lastResult && !r.lastResult.ok) {
      setStatus("Error", "err", `${r.lastResult.type} → ${r.lastResult.status || "?"}: ${r.lastResult.error || ""}`)
    } else {
      setStatus("Not configured", "idle", "No drops yet. Open facebook.com and log in.")
    }
  } catch (e) {
    setStatus("Error", "err", String(e))
  }
})()
