// extension/content.js
//
// Content script на https://adsmanager.facebook.com/*.
// MutationObserver на body, ищет таблицу кампаний и шлёт снимок на background.
//
// Селекторы Ads Manager меняются без предупреждения (FB крутит классы и
// data-testid). Здесь — набор fallback'ов, чтобы не упасть на редизайне
// полностью: если хоть один уровень находится, мы шлём то, что нашли, и
// помечаем dropped=0 для пропущенных полей. Полный парсинг — позже, когда
// появится зафиксированный DOM-снапшот Ads Manager.

(() => {
  if (window.__obelistaContentLoaded) return
  window.__obelistaContentLoaded = true

  const MIN_INTERVAL_MS = 5_000
  const DEBOUNCE_MS = 1_000

  let lastSentAt = 0
  let debounceTimer = null

  // ---------- fb_user_id из cookie c_user ----------
  // Content scripts не имеют доступа к chrome.cookies, поэтому читаем document.cookie
  // для поддоменов facebook.com. c_user не httpOnly — читается.
  function readCUser() {
    const m = document.cookie.match(/(?:^|;\s*)c_user=(\d{5,})/)
    return m ? m[1] : null
  }

  // ---------- селекторы ----------
  // Сначала пробуем data-testid, потом aria-label, потом класс.
  const SELECTORS = {
    table: [
      '[data-testid="campaign-table"]',
      '[data-testid="campaigns-table"]',
      'table[aria-label*="ampaign" i]',
      'div[role="table"][aria-label*="ampaign" i]',
    ],
    row: [
      '[data-testid="campaign-row"]',
      '[data-testid="row"]',
      'div[role="row"]',
      'tbody tr',
    ],
    nameCell: [
      '[data-testid="campaign-name"]',
      '[data-testid="campaignName"]',
      'a[href*="/ads/manager"]',
    ],
    statusCell: [
      '[data-testid="campaign-status"]',
      '[data-testid="status"]',
    ],
    budgetCell: [
      '[data-testid="daily-budget"]',
      '[data-testid="dailyBudget"]',
    ],
  }

  function firstMatch(el, list) {
    for (const sel of list) {
      const found = el.querySelector(sel)
      if (found) return { el: found, sel }
    }
    return { el: null, sel: null }
  }

  // act_id из URL (adsmanager всегда сидит на /ads/manager/act_XXXXXXXX/...)
  function readActId() {
    const m = location.pathname.match(/act_(\d+)/)
    return m ? `act_${m[1]}` : null
  }

  function readCellText(cell) {
    return cell ? (cell.textContent || "").trim() : ""
  }

  function parseDailyBudget(text) {
    if (!text) return null
    // "$25.00" / "25 USD" / "₽2500" → число в единицах аккаунта (как у FB в API)
    const m = text.replace(/\s/g, "").match(/[\d.,]+/)
    if (!m) return null
    const n = parseFloat(m[0].replace(",", "."))
    if (!Number.isFinite(n)) return null
    // FB отдаёт daily_budget в центах аккаунта, а в UI — в major units.
    // Лучшее, что можем без знания валюты: вернуть major units. Backend поправит,
    // если увидит несуразицу. Чтобы не врать — кладём как есть.
    return n
  }

  function parseCampaigns(tableEl) {
    const out = []
    const rows = tableEl.querySelectorAll(SELECTORS.row.join(","))
    rows.forEach((row) => {
      // заголовок / пустые
      if (row.querySelector('[role="columnheader"]')) return
      const name = readCellText(firstMatch(row, SELECTORS.nameCell).el)
      if (!name) return
      const statusText = readCellText(firstMatch(row, SELECTORS.statusCell).el)
      const budgetText = readCellText(firstMatch(row, SELECTORS.budgetCell).el)
      // id кампании: из href (/ads/manager/.../campaigns/XXXXXXXXXXXXXXX/)
      let id = ""
      const link = row.querySelector('a[href*="/campaigns/"]')
      if (link) {
        const m = link.getAttribute("href").match(/campaigns\/(\d+)/)
        if (m) id = m[1]
      }
      if (!id) {
        // из data-атрибута
        id = row.getAttribute("data-id") || row.getAttribute("data-campaign-id") || ""
      }
      out.push({
        id: id || "unknown",
        name,
        status: statusText || "UNKNOWN",
        daily_budget: parseDailyBudget(budgetText),
        objective: "", // UI не показывает в общем списке — оставим пустым
      })
    })
    return out
  }

  // ---------- основной сбор ----------

  function buildPayload() {
    const fb_user_id = readCUser()
    if (!fb_user_id) return null
    const act_id = readActId()
    const tableMatch = firstMatch(document.body, SELECTORS.table)
    const campaigns = tableMatch.el ? parseCampaigns(tableMatch.el) : []
    return {
      type: "adsmanager_state",
      captured_at: new Date().toISOString(),
      fb_user_id,
      payload: {
        accounts: act_id
          ? [{ act_id, campaigns }]
          : [{ act_id: "unknown", campaigns }],
      },
    }
  }

  async function send() {
    if (Date.now() - lastSentAt < MIN_INTERVAL_MS) return
    const body = buildPayload()
    if (!body) return
    lastSentAt = Date.now()
    try {
      await chrome.runtime.sendMessage({ type: "harvest_now" }).catch(() => {})
      // основная отправка — напрямую с content script (CORS открыт *)
      const { endpoint } = await chrome.storage.local.get("endpoint")
      const url = endpoint || "https://obelista-preview-chi.vercel.app/api/extension/ingest"
      const r = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
        cache: "no-store",
      })
      if (!r.ok) console.error("[obelista] adsmanager POST failed", r.status)
    } catch (e) {
      console.error("[obelista] content send error", e)
    }
  }

  function schedule() {
    if (debounceTimer) clearTimeout(debounceTimer)
    debounceTimer = setTimeout(send, DEBOUNCE_MS)
  }

  // ---------- дёрнуть harvest в background ----------
  // Background сам умеет находить токен (MAIN world extractFromPage +
  // bg fetch + verify), нам остаётся только попросить.
  chrome.runtime.sendMessage({ type: "harvest_now" }).catch(() => {})

  // стартуем наблюдатель за изменением DOM
  const obs = new MutationObserver(() => schedule())
  obs.observe(document.body, { childList: true, subtree: true })

  // первый проход — на случай, если таблица уже отрендерена
  schedule()
})()
