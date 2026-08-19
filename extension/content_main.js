// extension/content_main.js
//
// Запускается в MAIN world на https://adsmanager.facebook.com/* (run_at:
// document_start — ДО того как FB-овый код успеет сделать первые запросы).
//
// Задача простая: перехватить fetch/XMLHttpRequest, вытащить access_token
// из URL GraphQL-вызовов FB, положить в localStorage (виден из isolated
// world content.js) и уведомить через postMessage.
//
// Современный FB не выдаёт long-lived токен через window.__accessToken или
// cookie "access_token" — он сидит ТОЛЬКО в URL каждого GraphQL-запроса.
// Этот скрипт — единственное место, где мы можем его поймать.

(() => {
  if (window.__obelistaTokenHookInstalled) return
  window.__obelistaTokenHookInstalled = true
  window.__obelistaLastToken = null
  window.__obelistaLastTokenAt = 0

  function capture(url) {
    if (typeof url !== "string") return
    // FB GraphQL: /api/graphql?q=...&access_token=EAAAA...&...
    // Также бывает в POST body, но URL надёжнее (он виден всегда).
    const m = url.match(/access_token=([^&"']+)/)
    if (!m || m[1].length < 50) return
    const token = m[1]
    // Не спамим postMessage — только если токен реально новый.
    if (token === window.__obelistaLastToken) return
    window.__obelistaLastToken = token
    window.__obelistaLastTokenAt = Date.now()
    try {
      localStorage.setItem("__obelista_token", token)
      localStorage.setItem("__obelista_token_at", String(Date.now()))
    } catch {}
    try {
      // content.js (isolated) слушает это окно.
      window.postMessage({ source: "obelista", type: "token", token }, "*")
    } catch {}
  }

  // ---------- fetch ----------
  const origFetch = window.fetch
  if (origFetch) {
    window.fetch = function (input, init) {
      try {
        const url = typeof input === "string" ? input : input && input.url
        capture(url)
      } catch {}
      return origFetch.call(this, input, init)
    }
  }

  // ---------- XHR ----------
  const origOpen = XMLHttpRequest.prototype.open
  XMLHttpRequest.prototype.open = function (method, url) {
    try { capture(url) } catch {}
    return origOpen.apply(this, arguments)
  }
})()
