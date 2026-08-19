// lib/extension-types.ts
//
// Контракт между браузерным расширением и панелью obelista-preview.
//
// Данные идут В ОДИН КОНЕЦ — extension → panel. Panel — это proxy в
// obelista_mcp backend, который и хранит токены/дропы. Сама панель ничего не
// хранит (cold start Vercel стирает state).
//
// Все типы тут, потому что их читают:
//   - extension/background.js (manifest v3 service worker)
//   - app/api/extension/*/route.ts (proxy)
//   - app/extension/page.tsx (UI таблица)

export type IngestType = "token" | "adsmanager_state"

export interface IngestRequest {
  /** Что именно прислали: токен или снимок Ads Manager */
  type: IngestType
  /** ISO 8601, когда расширение поймало данные */
  captured_at: string
  /** FB user id — сюда вяжутся кабы (один user = много ad accounts) */
  fb_user_id: string
  /** Сырые данные, формат зависит от type */
  payload: TokenPayload | AdsmanagerStatePayload
}

export interface TokenPayload {
  /** Длинный user access token из FB */
  access_token: string
  /** Когда протухнет, если расширение смогло достать */
  expires_at?: string
  /** Откуда вытащили — для отладки */
  source?: "cookie" | "localStorage" | "graphql"
}

export interface AdsmanagerStatePayload {
  /** Минимальный срез, который видит расширение в Ads Manager DOM */
  accounts: Array<{
    act_id: string
    campaigns: Array<{
      id: string
      name: string
      status: string
      daily_budget: number | null
      objective: string
    }>
  }>
}

/** Ответ GET /api/extension/state — что показать на /extension */
export interface ExtensionState {
  tokens: Array<{
    fb_user_id: string
    last_seen: string
    /** Сколько раз дропнули за всё время */
    drop_count: number
  }>
  /** Последние 50 дропов любого типа — для activity log в UI */
  drops: Array<{
    fb_user_id: string
    type: IngestType
    captured_at: string
    /** Короткое описание для таблицы, вычисляется в backend */
    summary: string
  }>
  health: {
    uptime_s: number
    last_ingest_at: string | null
    total_drops: number
  }
}
