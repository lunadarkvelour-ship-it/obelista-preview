// extension/options.js
// Vanilla JS. Кнопка Save пишет в chrome.storage.local, Test / Drop —
// посылают сообщения в background.

const $endpoint = document.getElementById("endpoint")
const $save = document.getElementById("save")
const $test = document.getElementById("test")
const $drop = document.getElementById("drop")
const $out = document.getElementById("out")

const DEFAULT_ENDPOINT = "https://obelista-preview.vercel.app/api/extension/ingest"

function render(obj, cls) {
  $out.className = cls || ""
  $out.textContent = typeof obj === "string" ? obj : JSON.stringify(obj, null, 2)
}

async function load() {
  const { endpoint } = await chrome.storage.local.get("endpoint")
  $endpoint.value = endpoint || DEFAULT_ENDPOINT
}

$save.addEventListener("click", async () => {
  const url = $endpoint.value.trim().replace(/\/+$/, "")
  if (!url) {
    render("Endpoint is empty", "err")
    return
  }
  await chrome.storage.local.set({ endpoint: url })
  render({ saved: true, endpoint: url }, "ok")
})

$test.addEventListener("click", async () => {
  render("Testing…")
  try {
    const r = await chrome.runtime.sendMessage({ type: "test_connection" })
    render(r, r?.ok ? "ok" : "err")
  } catch (e) {
    render({ ok: false, error: String(e) }, "err")
  }
})

$drop.addEventListener("click", async () => {
  render("Sending test drop…")
  try {
    const r = await chrome.runtime.sendMessage({ type: "send_test_drop" })
    render(r, r?.ok ? "ok" : "err")
  } catch (e) {
    render({ ok: false, error: String(e) }, "err")
  }
})

load()
