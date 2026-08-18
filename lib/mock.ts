/* ─────────────────────────────────────────────────────────────────────
 * Obelista — Mock Data
 * Зеркало продакшна, в mock-режиме. Когда юзер положит
 * OBELISTA_SESSION_COOKIE в env — API routes начнут проксировать
 * в app.obelista.com и этот файл не читается.
 *
 * Что специально НЕ делаем:
 *  - Не выдумываем готовых "connected" vendors, у которых нет бэкенда.
 *    lib/integrations.ts:96 — PANEL_BACKEND.store=false, .check=false.
 *    Показываем missingToConnect, не "Connect now!" кнопку.
 *  - Не смешиваем null и 0. balance=null — Meta не ответил. balance=0 —
 *    Meta сказал "ноль". Три состояния: null (unknown), 0 (fact), "—"
 *    (human placeholder).
 *  - Не пишем daily_limit=null на кабах где Meta не отдаёт — пишем
 *    daily_limit_note="Not exposed via app token" (lib/cloud-accounts.ts:32).
 *
 * Деньги храним в MINOR UNITS (cents). 1247_50 = $1247.50. Делим на 100
 * в одном месте: money().
 * ───────────────────────────────────────────────────────────────────── */

import type {
  AccountCheck,
  AdRow,
  Board,
  Campaign,
  CloudAccount,
  CloudOwner,
  ConnCheckCtx,
  ConnStateKind,
  Creative,
  CreativeRow,
  MetaStatus,
  NoUploadReason,
  PanelBackend,
  PeriodPreset,
  Pixel,
  SparkPoint,
  StatusLabel,
  UnifiedAccount,
  Vendor,
  VendorState,
} from "./types";

/* ── Constants ──────────────────────────────────────────────────── */

export const DASH = "—";

/* Currencies that don't have minor units (lib/cloud-accounts.ts:135) */
const ZERO_DECIMAL = new Set([
  "JPY", "KRW", "VND", "CLP", "ISK",
  "PYG", "RWF", "UGX", "VUV", "XAF", "XOF", "XPF",
]);

const DEAD_STATUSES = new Set(["DISABLED", "PENDING_CLOSURE"]);
const REVIEW_STATUSES = new Set([
  "PENDING_RISK_REVIEW", "PENDING_APPEAL", "TEMP_UNAVAILABLE",
]);

/* 5-bucket classifier (lib/account-status.ts:14) */
export function statusLabel(s: string | undefined | null): StatusLabel {
  if (!s) return "unknown";
  if (s === "ACTIVE") return "active";
  if (DEAD_STATUSES.has(s)) return "disabled";
  if (s === "UNSETTLED" || s === "IN_GRACE_PERIOD") return "billing";
  if (REVIEW_STATUSES.has(s)) return "review";
  return "unknown"; // Meta добавляет новые статусы — мы их не выдумываем
}

/* Money: minor units → human (lib/cloud-accounts.ts:148) */
export function money(units: number | null | undefined, currency = "USD"): string {
  if (units == null || Number.isNaN(units)) return DASH;
  if (units === 0) return fmtZero(currency);
  const factor = ZERO_DECIMAL.has(currency) ? 1 : 100;
  const human = units / factor;
  return formatMoney(human, currency);
}

function formatMoney(n: number, currency: string): string {
  const sym = currency === "USD" ? "$" : currency === "EUR" ? "€" : "";
  return sym + n.toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function fmtZero(currency: string): string {
  return currency === "USD" ? "$0" : currency === "EUR" ? "€0" : "0";
}

/* 0 ≠ null в числах (lib/analytics.ts:312) */
export function num(v: number | null | undefined): string {
  if (v == null) return DASH;
  return v.toLocaleString("en-US");
}

/* pct smart precision (lib/analytics.ts:328) */
export function pct(v: number | null | undefined, digits?: number): string {
  if (v == null) return DASH;
  const f = v * 100;
  if (f === 0) return "0%";
  const d = digits ?? (f < 1 ? 2 : f < 10 ? 1 : 0);
  return f.toFixed(d) + "%";
}

/* whenShort: «at 14:23» для today, «14 Aug 14:23» для старше (lib/analytics.ts:343) */
export function whenShort(iso: string | undefined | null): string {
  if (!iso) return DASH;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return DASH;
  const now = new Date();
  const sameDay =
    d.getFullYear() === now.getFullYear() &&
    d.getMonth() === now.getMonth() &&
    d.getDate() === now.getDate();
  const time = d.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", hour12: false });
  if (sameDay) return `at ${time}`;
  const dayMonth = d.toLocaleDateString("en-GB", { day: "2-digit", month: "short" });
  return `${dayMonth} ${time}`;
}

/* staleLevel (lib/analytics.ts:357) */
export function staleLevel(gap_s: number | null | undefined): "ok" | "late" | "frozen" {
  if (gap_s == null) return "frozen";
  if (gap_s < 3 * 3600) return "ok"; // 3h
  if (gap_s < 24 * 3600) return "late";
  return "frozen";
}

/* 5 reasons a row can't be uploaded (lib/cloud-accounts.ts:54) */
export function noUploadReason(a: UnifiedAccount): NoUploadReason | null {
  if (DEAD_STATUSES.has(a.status as MetaStatus)) return "account-dead";
  if (a.profile) return null; // есть куда заливать
  if (a.owners.length === 0) return "owners-unknown";
  if (a.owners.every((o) => o.vendor_state === "нет_вендора")) return "vendor-gone";
  if (a.owners.some((o) => o.oauth)) return "no-live-window";
  return "no-connected-profile";
}

export function canUpload(a: UnifiedAccount): boolean {
  return noUploadReason(a) === null;
}

/* ConnStateKind (lib/integrations.ts:25) */
export function connState(ctx: ConnCheckCtx): ConnStateKind {
  if (!ctx.configured) return "not_configured";
  if (ctx.last_check_at && ctx.last_check_ok === false) return "unreachable";
  return "connected";
}

/* connCheckLine (lib/integrations.ts:36) */
export function connCheckLine(ctx: ConnCheckCtx): string {
  if (!ctx.configured) return "Nothing stored yet.";
  if (!ctx.last_check_at) {
    return "Stored, never checked — the panel has not confirmed it answers.";
  }
  if (ctx.last_check_ok === false) {
    const reason = ctx.last_check_reason || "no reason was returned.";
    return `Last check failed, ${whenShort(ctx.last_check_at)}: ${reason}`;
  }
  return `Answered on the last check, ${whenShort(ctx.last_check_at)}.`;
}

/* missingToConnect (lib/integrations.ts:96) */
export function missingToConnect(
  v: Vendor,
  backend: PanelBackend
): string[] {
  const out: string[] = [];
  if (v.support === "none") {
    out.push(`No adapter for ${v.name} in the engine — ${v.supportNote}`);
  }
  if (v.support === "written") {
    out.push(
      `The ${v.name} adapter is written but not merged — ${v.supportNote}`
    );
  }
  if (!backend.store && v.fields.length > 0 && !v.issuesKey && !v.custom) {
    out.push("The panel has nowhere to store an address or a key");
  }
  if (!backend.check) {
    out.push("Nothing checks the connection");
  }
  return out;
}

export const PANEL_BACKEND: PanelBackend = { store: false, check: false };

/* ISO day (UTC) (lib/analytics.ts:362) */
export function isoDay(d: Date = new Date()): string {
  return d.toISOString().slice(0, 10);
}

/* period preset → since date (last_7d → 6 days ago, etc) */
export function periodSince(p: PeriodPreset, now: Date = new Date()): string {
  const d = new Date(now);
  switch (p) {
    case "today":
      d.setHours(0, 0, 0, 0);
      return d.toISOString().slice(0, 10);
    case "yesterday":
      d.setDate(d.getDate() - 1);
      d.setHours(0, 0, 0, 0);
      return d.toISOString().slice(0, 10);
    case "last_7d":
      d.setDate(d.getDate() - 6);
      d.setHours(0, 0, 0, 0);
      return d.toISOString().slice(0, 10);
    case "last_14d":
      d.setDate(d.getDate() - 13);
      d.setHours(0, 0, 0, 0);
      return d.toISOString().slice(0, 10);
    case "last_30d":
      d.setDate(d.getDate() - 29);
      d.setHours(0, 0, 0, 0);
      return d.toISOString().slice(0, 10);
    case "this_month":
      d.setDate(1);
      d.setHours(0, 0, 0, 0);
      return d.toISOString().slice(0, 10);
  }
}

export function periodLabel(p: PeriodPreset): string {
  switch (p) {
    case "today": return "Today";
    case "yesterday": return "Yesterday";
    case "last_7d": return "Last 7 days";
    case "last_14d": return "Last 14 days";
    case "last_30d": return "Last 30 days";
    case "this_month": return "This month";
  }
}

/* account_id normalization (lib/cloud-accounts.ts:121) */
export function accKey(id: string): string {
  return id.replace(/^act_/, "").toLowerCase();
}

/* NOT_A_CREATIVE (lib/analytics.ts:388) */
export const NOT_A_CREATIVE = [
  "unidentified",
  "—not a creative—",
  "—no creative id—",
  "не определён",
  "связка не найдена",
] as const;

/* ── Owners (для accounts) ─────────────────────────────────────── */

const OWNER_HIU_3 = (oauth = true, in_antidetect = true): CloudOwner => ({
  profile_id: "hiu_buyer3",
  name: "Hiuhiu_Buyer3",
  oauth,
  in_antidetect,
  vendor_state: "живой" as VendorState,
  vendor: "adspower",
});

const OWNER_HIU_5 = (oauth = true, in_antidetect = true): CloudOwner => ({
  profile_id: "hiu_buyer5",
  name: "Hiuhiu_Buyer5",
  oauth,
  in_antidetect,
  vendor_state: "живой" as VendorState,
  vendor: "adspower",
});

const OWNER_HIU_7 = (oauth = false, in_antidetect = false): CloudOwner => ({
  profile_id: "hiu_buyer7",
  name: "Hiuhiu_Buyer7",
  oauth,
  in_antidetect,
  vendor_state: "не_подтверждён" as VendorState,
  vendor: "adspower",
});

const OWNER_SPX_MAIN = (oauth = true, in_antidetect = true): CloudOwner => ({
  profile_id: "spx_main",
  name: "SPX_Main",
  oauth,
  in_antidetect,
  vendor_state: "живой" as VendorState,
  vendor: "adspower",
});

const OWNER_SPX_BD = (oauth = true, in_antidetect: boolean | null = null): CloudOwner => ({
  profile_id: "spx_bd",
  name: "SPX_BD",
  oauth,
  in_antidetect, // null = antidetect never answered
  vendor_state: "не_подтверждён" as VendorState,
  vendor: "adspower",
});

/* ── 12 ACCOUNTS — production-realistic ────────────────────────── */

const A1: UnifiedAccount = {
  act_id: "act_2270870780419667",
  name: "Hiuhiu_Mediabuyer3_11.8_9",
  bm_id: "bm_8812993344",
  bm_name: "Hiuhiu Agency",
  currency: "USD",
  status: "ACTIVE",
  status_code: 1,
  disable_reason: undefined,
  balance: 124_750, // $1,247.50
  amount_spent: 1_849_230, // $18,492.30 lifetime
  spend_cap: 50_000_00, // $50,000 cap
  funding_type: "visa",
  funding_display_string: "Visa · 4242",
  daily_limit_note: undefined,
  status_checked_at: "2026-08-18T22:14:00Z",
  owners: [OWNER_HIU_3(), OWNER_HIU_5()],
  profile: "hiu_buyer3",
  profileLabel: "Hiuhiu_Buyer3",
  pixels: [
    { id: "px_8812330011", name: "DZ-VSL-LP1", last_fired_time: "2026-08-18T22:10:00Z" },
    { id: "px_8812330012", name: "DZ-LP-Backup", last_fired_time: "2026-08-15T08:23:00Z" },
  ],
  personal: false,
  daily_limit: 30_000_00, // $30,000/day
  inSnapshot: true,
  inCloud: true,
  fieldSources: { status: "base", balance: "base" },
};

const A2: UnifiedAccount = {
  act_id: "act_4466055873683884",
  name: "Hiuhiu_Mediabuyer3_11.8_6",
  bm_id: "bm_8812993344",
  bm_name: "Hiuhiu Agency",
  currency: "USD",
  status: "ACTIVE",
  balance: 87_640,
  amount_spent: 2_310_001,
  spend_cap: null,
  funding_display_string: "Visa · 1001",
  status_checked_at: "2026-08-18T22:14:00Z",
  owners: [OWNER_HIU_3()],
  profile: "hiu_buyer3",
  profileLabel: "Hiuhiu_Buyer3",
  pixels: [{ id: "px_8812330011", name: "DZ-VSL-LP1", last_fired_time: "2026-08-18T22:10:00Z" }],
  personal: false,
  inSnapshot: true,
  inCloud: true,
};

const A3: UnifiedAccount = {
  act_id: "act_1523320569016244",
  name: "MeDuA6aeP 11/8-1",
  bm_id: "bm_4411228899",
  bm_name: "MeDuA6aeP Holding",
  currency: "USD",
  status: "ACTIVE",
  balance: 21_400,
  amount_spent: 1_204_550,
  spend_cap: null,
  funding_display_string: "Mastercard · 8801",
  status_checked_at: "2026-08-18T22:13:00Z",
  owners: [OWNER_HIU_5()],
  profile: "hiu_buyer5",
  profileLabel: "Hiuhiu_Buyer5",
  pixels: [{ id: "px_9900112233", name: "BD-Main-LP", last_fired_time: "2026-08-18T21:55:00Z" }],
  personal: false,
  inSnapshot: true,
  inCloud: true,
};

const A4: UnifiedAccount = {
  act_id: "act_7339014558821901",
  name: "Hiuhiu_Buyer7_DZ_01",
  bm_id: "bm_8812993344",
  bm_name: "Hiuhiu Agency",
  currency: "USD",
  status: "IN_GRACE_PERIOD", // billing bucket
  balance: -12_300, // -$123.00 — owe money
  amount_spent: 4_812_990,
  spend_cap: null,
  funding_display_string: "Visa · 7777",
  daily_limit_note: "Not exposed via app token", // explicit non-value
  status_checked_at: "2026-08-18T20:01:00Z", // 2+ hours stale
  owners: [OWNER_HIU_7(false, false), OWNER_HIU_3(true, false)], // token alive, window closed
  profile: "hiu_buyer3",
  profileLabel: "Hiuhiu_Buyer3",
  pixels: [{ id: "px_8812330011", name: "DZ-VSL-LP1", last_fired_time: "2026-08-17T11:22:00Z" }],
  personal: false,
  inSnapshot: true,
  inCloud: true,
};

const A5: UnifiedAccount = {
  act_id: "act_8842013394715098",
  name: "SPX_BD_08-15",
  bm_id: "bm_6655443322",
  bm_name: "SPX Trading",
  currency: "USD",
  status: "ACTIVE",
  balance: 47_200,
  amount_spent: 1_023_400,
  spend_cap: 25_000_00,
  funding_display_string: "Visa · 3322",
  status_checked_at: "2026-08-18T22:10:00Z",
  owners: [OWNER_SPX_MAIN()],
  profile: "spx_main",
  profileLabel: "SPX_Main",
  pixels: [{ id: "px_5544332211", name: "BD-SPX-Tracker", last_fired_time: "2026-08-18T22:00:00Z" }],
  personal: false,
  inSnapshot: true,
  inCloud: true,
};

const A6: UnifiedAccount = {
  act_id: "act_2901844756137922",
  name: "SPX_BR_07-22",
  bm_id: "bm_6655443322",
  bm_name: "SPX Trading",
  currency: "BRL",
  status: "ACTIVE", // user paused locally; Meta still ACTIVE
  balance: 18_500, // R$185,00 (BRL has cents, 0.01 unit)
  amount_spent: 612_300,
  spend_cap: null,
  funding_display_string: "Visa · 0815",
  status_checked_at: "2026-08-18T22:09:00Z",
  owners: [OWNER_SPX_MAIN()],
  profile: "spx_main",
  profileLabel: "SPX_Main",
  pixels: [{ id: "px_5544332299", name: "BR-SPX-LP", last_fired_time: "2026-08-15T14:00:00Z" }],
  personal: false,
  inSnapshot: true,
  inCloud: true,
};

const A7: UnifiedAccount = {
  act_id: "act_6619200471188355",
  name: "Hiuhiu_Mediabuyer3_11.8_3",
  bm_id: "bm_8812993344",
  bm_name: "Hiuhiu Agency",
  currency: "USD",
  status: "PENDING_CLOSURE", // DEAD — навсегда
  balance: 0, // Meta сказал "ноль" (≠ null)
  amount_spent: 8_122_440,
  spend_cap: null,
  disable_reason: "ACCOUNT_DISABLED_BM_RISK",
  funding_display_string: undefined,
  status_checked_at: "2026-08-18T22:08:00Z",
  owners: [OWNER_HIU_3(true, true)], // even though dead, owner still listed
  profile: null, // dead → can't upload
  profileLabel: "—",
  pixels: [], // pixel was reset on ban
  personal: false,
  inSnapshot: true,
  inCloud: true,
};

const A8: UnifiedAccount = {
  act_id: "act_4492011583320071",
  name: "Hiuhiu_Buyer5_BD_09",
  bm_id: "bm_8812993344",
  bm_name: "Hiuhiu Agency",
  currency: "USD",
  status: "PENDING_RISK_REVIEW", // review bucket
  balance: 4_500,
  amount_spent: 988_211,
  spend_cap: null,
  funding_display_string: "Mastercard · 1144",
  status_checked_at: "2026-08-18T19:30:00Z", // 2.5h stale
  owners: [OWNER_HIU_5()],
  profile: "hiu_buyer5",
  profileLabel: "Hiuhiu_Buyer5",
  pixels: [{ id: "px_9900112233", name: "BD-Main-LP", last_fired_time: "2026-08-18T14:00:00Z" }],
  personal: false,
  inSnapshot: true,
  inCloud: true,
};

const A9: UnifiedAccount = {
  act_id: "act_1908774425630014",
  name: "MeDuA6aeP 11/8-4",
  bm_id: "bm_4411228899",
  bm_name: "MeDuA6aeP Holding",
  currency: "USD",
  status: "ACTIVE",
  balance: 8_900,
  amount_spent: 412_004,
  spend_cap: null,
  funding_display_string: "Visa · 0099",
  status_checked_at: "2026-08-18T22:12:00Z",
  owners: [OWNER_HIU_5()],
  profile: "hiu_buyer5",
  profileLabel: "Hiuhiu_Buyer5",
  pixels: [{ id: "px_9900112244", name: "BR-MeDuA-LP", last_fired_time: "2026-08-18T20:30:00Z" }],
  personal: false,
  inSnapshot: true,
  inCloud: true,
};

const A10: UnifiedAccount = {
  act_id: "act_5571299036884217",
  name: "SPX_DZ_06-11",
  bm_id: "bm_6655443322",
  bm_name: "SPX Trading",
  currency: "USD",
  status: "ACTIVE",
  balance: 31_000,
  amount_spent: 220_400,
  spend_cap: null,
  // no card — separate state, not a Meta status word
  funding_display_string: undefined,
  status_checked_at: "2026-08-18T22:11:00Z",
  owners: [OWNER_SPX_MAIN()],
  profile: "spx_main",
  profileLabel: "SPX_Main",
  pixels: [],
  personal: false,
  inSnapshot: true,
  inCloud: true,
};

const A11: UnifiedAccount = {
  act_id: "act_6024817790338159",
  name: "Hiuhiu_Mediabuyer3_11.8_12",
  bm_id: "bm_8812993344",
  bm_name: "Hiuhiu Agency",
  currency: "USD",
  status: "UNSETTLED", // billing
  balance: -3_500,
  amount_spent: 1_440_900,
  spend_cap: null,
  funding_display_string: "Visa · 4242",
  status_checked_at: "2026-08-18T22:00:00Z",
  owners: [OWNER_HIU_3()],
  profile: "hiu_buyer3",
  profileLabel: "Hiuhiu_Buyer3",
  pixels: [{ id: "px_8812330011", name: "DZ-VSL-LP1", last_fired_time: "2026-08-18T21:45:00Z" }],
  personal: false,
  inSnapshot: true,
  inCloud: true,
};

const A12: UnifiedAccount = {
  // personal — auto-detected by name match (lib/cloud-accounts.ts:87)
  // John Smith → personal ad account
  act_id: "act_3349801172290084",
  name: "John Smith",
  bm_id: "bm_4411228899",
  bm_name: "MeDuA6aeP Holding",
  currency: "USD",
  status: "ACTIVE",
  balance: 0,
  amount_spent: 18_000,
  spend_cap: null,
  funding_display_string: "Personal",
  status_checked_at: "2026-08-18T22:05:00Z",
  owners: [OWNER_HIU_5()],
  profile: null, // never upload to personal
  profileLabel: "personal",
  pixels: [],
  personal: true, // ← ключевое поле
  inSnapshot: true,
  inCloud: true,
};

export const ACCOUNTS: UnifiedAccount[] = [
  A1, A2, A3, A4, A5, A6, A7, A8, A9, A10, A11, A12,
];

/* ── 12 CREATIVES — production-realistic ────────────────────────── */

export const CREATIVES: Creative[] = [
  {
    id: "BR_VID_007_0801",
    name: "BR_VID_007_0801",
    type: "video",
    geo: "BR",
    cabs_count: 12,
    spend_total: 284_050, // $2,840.50
    status: "cached",
    size: "9:16",
    added: "2026-08-01",
  },
  {
    id: "DZ_VID_014_0708",
    name: "DZ_VID_014_0708",
    type: "video",
    geo: "DZ",
    cabs_count: 8,
    spend_total: 192_018,
    status: "cached",
    size: "9:16",
    added: "2026-07-08",
  },
  {
    id: "DZ_VID_015_0708",
    name: "DZ_VID_015_0708",
    type: "video",
    geo: "DZ",
    cabs_count: 6,
    spend_total: 114_492,
    status: "cached",
    size: "9:16",
    added: "2026-07-08",
  },
  {
    id: "BD_VID_001_0805",
    name: "BD_VID_001_0805",
    type: "video",
    geo: "BD",
    cabs_count: 4,
    spend_total: 87_241,
    status: "cached",
    size: "9:16",
    added: "2026-08-05",
  },
  {
    id: "DZ_IMG_042_0808",
    name: "DZ_IMG_042_0808",
    type: "image",
    geo: "DZ",
    cabs_count: 3,
    spend_total: 41_020,
    status: "new",
    size: "1:1",
    added: "2026-08-08",
  },
  {
    id: "DZ_IMG_043_0808",
    name: "DZ_IMG_043_0808",
    type: "image",
    geo: "DZ",
    cabs_count: 1,
    spend_total: 12_007,
    status: "new",
    size: "1:1",
    added: "2026-08-08",
  },
  {
    id: "BD_VID_002_0810",
    name: "BD_VID_002_0810",
    type: "video",
    geo: "BD",
    cabs_count: 0,
    spend_total: 0,
    status: "pending",
    size: "9:16",
    added: "2026-08-10",
    upload_progress: 47,
  },
  {
    id: "DZ_VID_016_0810",
    name: "DZ_VID_016_0810",
    type: "video",
    geo: "DZ",
    cabs_count: 0,
    spend_total: 0,
    status: "new",
    size: "9:16",
    added: "2026-08-10",
  },
  {
    id: "DZ_IMG_045_0810",
    name: "DZ_IMG_045_0810",
    type: "image",
    geo: "DZ",
    cabs_count: 0,
    spend_total: 0,
    status: "new",
    size: "4:5",
    added: "2026-08-10",
  },
  {
    id: "DZ_IMG_046_0811",
    name: "DZ_IMG_046_0811",
    type: "image",
    geo: "DZ",
    cabs_count: 2,
    spend_total: 9_834,
    status: "new",
    size: "1:1",
    added: "2026-08-11",
  },
  {
    id: "BD_IMG_011_0811",
    name: "BD_IMG_011_0811",
    type: "image",
    geo: "BD",
    cabs_count: 1,
    spend_total: 5_400,
    status: "cached",
    size: "4:5",
    added: "2026-08-11",
  },
  {
    id: "DZ_VID_017_0812",
    name: "DZ_VID_017_0812",
    type: "video",
    geo: "DZ",
    cabs_count: 0,
    spend_total: 0,
    status: "rejected",
    size: "9:16",
    added: "2026-08-12",
    rejected_on_cab: "Hiuhiu_Mediabuyer3_11.8_9",
    rejection_reason: "Landing page not loading — Meta couldn't reach the URL during review",
  },
];

/* ── 10 VENDORS — 3 connected, 1 unreachable, 4 not_configured, 1 written, 1 none, 1 custom ── */

const FB_PIXEL: Vendor = {
  id: "fb_pixel",
  name: "Facebook Pixel",
  mark: "FB",
  section: "trackers",
  summary: "Source-of-truth for sub / contact / checkout / ftd / rd on every ad account — Meta gives it back via the pixel API.",
  support: "shipped",
  supportNote: "Default tracker, attached to every active ad account at import time.",
  joinBy: "ad_name",
  gives: ["sub", "contact", "checkout", "ftd", "rd"],
  fields: [
    { key: "pixel_id", label: "Pixel ID", kind: "text", required: true, hint: "Found in Events Manager → Pixels → Settings" },
  ],
  fieldsNote: "The panel reads the pixel from the ad account — you don't need to enter it. This field exists for ad accounts where no pixel is bound yet.",
};

const ADSPOWER: Vendor = {
  id: "adspower",
  name: "AdsPower",
  mark: "AP",
  section: "trackers",
  summary: "Antidetect browser where profiles live. The panel talks to it locally to know which profile is open right now.",
  support: "shipped",
  supportNote: "Required for any upload — without a live antidetect window the upload cannot run.",
  fields: [],
  fieldsNote: "Connected at install time, no credentials needed — the panel reads the local API.",
  issuesKey: true,
};

const KEITARO: Vendor = {
  id: "keitaro",
  name: "Keitaro",
  mark: "K",
  section: "trackers",
  summary: "Tracker-side source for ftd / rd / revenue. Pairs with the Facebook pixel — the panel joins them on the click id.",
  support: "shipped",
  supportNote: "Joined by click id (sub1=subid) — see Settings → Tracker.",
  joinBy: "subid",
  gives: ["ftd", "rd", "revenue"],
  fields: [
    { key: "postback_url", label: "Postback URL", kind: "url", required: true, hint: "Use the URL the tracker gave you for ftd/rd postbacks" },
  ],
  fieldsNote: "The panel does not store the URL today — paste it into the Antidetect profile's notes and reference it from the prompt.",
};

const HUBSPOT: Vendor = {
  id: "hubspot",
  name: "HubSpot CRM",
  mark: "HS",
  section: "trackers",
  summary: "CRM where leads land after the funnel. Pairs the Facebook pixel's ftd with a deal.",
  support: "shipped",
  supportNote: "Connected via webhook from HubSpot → panel. Pairs ftd (pixel) with deal id (crm).",
  joinBy: "ad_name",
  gives: ["ftd"],
  fields: [
    { key: "webhook_url", label: "Webhook URL", kind: "url", required: true, hint: "Create in HubSpot → Settings → Integrations → Webhooks" },
  ],
  fieldsNote: "Stored locally — the panel has no remote backend yet, so this URL is per-installation.",
};

const BINOM: Vendor = {
  id: "binom",
  name: "Binom",
  mark: "B",
  section: "trackers",
  summary: "Alternative tracker. Same shape as Keitaro — ftd / rd / revenue via postback URL.",
  support: "shipped",
  supportNote: "Engine adapter is shipped. The panel cannot store the URL until PANEL_BACKEND.store is true.",
  joinBy: "subid",
  gives: ["ftd", "rd", "revenue"],
  fields: [
    { key: "postback_url", label: "Postback URL", kind: "url", required: true, hint: "From Binom → Traffic Sources → Postback URL" },
  ],
  fieldsNote: "See Keitaro. The Binom adapter reads the same fields.",
};

const BITRIX24: Vendor = {
  id: "bitrix24",
  name: "Bitrix24 CRM",
  mark: "BX",
  section: "trackers",
  summary: "Alternative CRM. Webhook-based, same idea as HubSpot.",
  support: "written",
  supportNote: "Adapter is in PR #188 — not in this build.",
  joinBy: "ad_name",
  gives: ["ftd"],
  fields: [
    { key: "webhook_url", label: "Webhook URL", kind: "url", required: true },
  ],
  fieldsNote: "Will share HubSpot's panel-side storage once the backend lands.",
};

const CRYPTOMUS: Vendor = {
  id: "cryptomus",
  name: "Cryptomus",
  mark: "₿",
  section: "trackers",
  summary: "Payment provider for crypto invoices. The panel does not connect to it yet — Stripe was deliberately postponed.",
  support: "shipped",
  supportNote: "Connected, but the panel cannot reach the api right now — DNS or auth issue.",
  gives: ["revenue"],
  fields: [
    { key: "merchant_id", label: "Merchant ID", kind: "text", required: true },
    { key: "api_key", label: "API key", kind: "secret", required: true },
  ],
  fieldsNote: "Card payments (Stripe) are a separate story and deliberately postponed: they need a legal entity, and there is none yet.",
};

const FIGMA: Vendor = {
  id: "figma",
  name: "Figma",
  mark: "F",
  section: "trackers",
  summary: "Was meant to import creative briefs. Removed: the design source lives in the operator's machine, not in Meta ads.",
  support: "none",
  supportNote: "Removed — the operator's Figma library is mirrored as files on the local antidetect host. No engine adapter exists.",
  fields: [],
  fieldsNote: "Not applicable — Figma is not a tracker.",
};

const GDRIVE: Vendor = {
  id: "gdrive",
  name: "Google Drive",
  mark: "GD",
  section: "trackers",
  summary: "Where creative masters are kept. The panel does not import from Drive — creatives are renamed locally and uploaded through the antidetect profile.",
  support: "shipped",
  supportNote: "Connected for the import-bridge plugin (machine-side, optional). The panel itself never reads Drive.",
  fields: [],
  fieldsNote: "Local only — see scripts/bridge.py if you need the import plugin.",
};

const CUSTOM_WEBHOOK: Vendor = {
  id: "custom",
  name: "Your own tracker",
  mark: "?",
  section: "trackers",
  summary: "Send postbacks to your own endpoint. The panel appends the standard ftd/rd query string — you parse it.",
  support: "shipped",
  supportNote: "Anything that accepts a URL with the standard tracker parameters.",
  custom: true,
  fields: [
    { key: "url", label: "Endpoint URL", kind: "url", required: true, hint: "https://your-endpoint/postback?subid={subid}&ftd=1" },
    { key: "secret", label: "Shared secret", kind: "secret", required: false, hint: "Appended as ?secret=… — verify server-side" },
  ],
  fieldsNote: "Tested with a single custom endpoint per installation. Add more in the prompt if you need rotation.",
};

export const VENDORS: Vendor[] = [
  FB_PIXEL, ADSPOWER, KEITARO, HUBSPOT,
  BINOM, BITRIX24, CRYPTOMUS, FIGMA, GDRIVE,
  CUSTOM_WEBHOOK,
];

/* per-vendor connection contexts (today's state) */
export const VENDOR_CONN: Record<string, ConnCheckCtx> = {
  fb_pixel: { configured: true, last_check_at: "2026-08-18T22:14:00Z", last_check_ok: true },
  adspower: { configured: true, last_check_at: "2026-08-18T22:13:00Z", last_check_ok: true },
  keitaro: { configured: true, last_check_at: "2026-08-18T20:00:00Z", last_check_ok: true },
  hubspot: { configured: true, last_check_at: "2026-08-18T22:15:00Z", last_check_ok: true },
  binom: { configured: false },
  bitrix24: { configured: false },
  cryptomus: {
    configured: true,
    last_check_at: "2026-08-18T18:42:00Z",
    last_check_ok: false,
    last_check_reason: "HTTP 503 from api.cryptomus.com (upstream timeout after 30s)",
  },
  figma: { configured: false },
  gdrive: { configured: true, last_check_at: "2026-08-18T21:00:00Z", last_check_ok: true },
  custom: { configured: false },
};

/* ── Analytics — CreativeTable leaderboard ──────────────────────── */

function spark(seed: number, days = 7): SparkPoint[] {
  // pseudo-random deterministic so SSR/CSR match
  const out: SparkPoint[] = [];
  let s = seed;
  const today = new Date("2026-08-18T00:00:00Z");
  for (let i = days - 1; i >= 0; i--) {
    s = (s * 1103515245 + 12345) & 0x7fffffff;
    const base = (s % 1000) + 200;
    const d = new Date(today);
    d.setUTCDate(d.getUTCDate() - i);
    out.push({ date: d.toISOString().slice(0, 10), spend: base * 100 }); // minor units
  }
  return out;
}

export const BOARD: Board = {
  ok: true,
  since: "2026-08-12",
  until: "2026-08-18",
  geo: null,
  by_social: { hiu_buyer3: 4_811_00, hiu_buyer5: 2_388_40, spx_main: 1_168_52 },
  coverage: { exact: 9, estimate: 0, unknown: 1, total: 10 },
  coverage_ads: { exact: 71, estimate: 0, unknown: 4, total: 75 },
  unlinked_label: "unidentified",
  rows: [
    {
      creative: "BR_VID_007_0801",
      spend: 284_050,
      clicks: 1_842,
      sub: 248,
      contact: 191,
      checkout: 142,
      ftd: 89,
      rd: 23,
      ads: 12,
      ads_with_ftd: 11,
      geos: ["BR"],
      cpftd: 3192,
      cprd: 12350,
      cpsub: 1145,
      cpcon: 1487,
      cpcheck: 2000,
      clicks_per_ftd: 21,
      sub_to_contact: 77,
      sub_to_checkout: 57,
      sub_to_ftd: 36,
      sub_to_rd: 9,
      days: spark(42, 7),
    },
    {
      creative: "DZ_VID_014_0708",
      spend: 192_018,
      clicks: 1_402,
      sub: 187,
      contact: 142,
      checkout: 98,
      ftd: 64,
      rd: 18,
      ads: 8,
      ads_with_ftd: 8,
      geos: ["DZ"],
      cpftd: 3000,
      cprd: 10668,
      cpsub: 1027,
      cpcon: 1352,
      cpcheck: 1960,
      clicks_per_ftd: 22,
      sub_to_contact: 76,
      sub_to_checkout: 52,
      sub_to_ftd: 34,
      sub_to_rd: 10,
      days: spark(91, 7),
    },
    {
      creative: "DZ_VID_015_0708",
      spend: 114_492,
      clicks: 884,
      sub: 119,
      contact: 88,
      checkout: 61,
      ftd: 41,
      rd: 9,
      ads: 6,
      ads_with_ftd: 6,
      geos: ["DZ"],
      cpftd: 2793,
      cprd: 12721,
      cpsub: 962,
      cpcon: 1301,
      cpcheck: 1877,
      clicks_per_ftd: 22,
      sub_to_contact: 74,
      sub_to_checkout: 51,
      sub_to_ftd: 34,
      sub_to_rd: 8,
      days: spark(11, 7),
    },
    {
      creative: "BD_VID_001_0805",
      spend: 87_241,
      clicks: 612,
      sub: 78,
      contact: 61,
      checkout: 39,
      ftd: 22,
      rd: 7,
      ads: 4,
      ads_with_ftd: 4,
      geos: ["BD"],
      cpftd: 3965,
      cprd: 12463,
      cpsub: 1118,
      cpcon: 1430,
      cpcheck: 2237,
      clicks_per_ftd: 28,
      sub_to_contact: 78,
      sub_to_checkout: 50,
      sub_to_ftd: 28,
      sub_to_rd: 9,
      days: spark(7, 7),
    },
    {
      creative: "DZ_IMG_042_0808",
      spend: 41_020,
      clicks: 318,
      sub: 38,
      contact: 29,
      checkout: 18,
      ftd: 11,
      rd: 2,
      ads: 3,
      ads_with_ftd: 3,
      geos: ["DZ"],
      cpftd: 3729,
      cprd: 20510,
      cpsub: 1079,
      cpcon: 1414,
      cpcheck: 2278,
      clicks_per_ftd: 29,
      sub_to_contact: 76,
      sub_to_checkout: 47,
      sub_to_ftd: 29,
      sub_to_rd: 5,
      days: spark(33, 7),
    },
    {
      creative: "DZ_IMG_043_0808",
      spend: 12_007,
      clicks: 92,
      sub: 11,
      contact: 8,
      checkout: 5,
      ftd: 3,
      rd: 1,
      ads: 1,
      ads_with_ftd: 1,
      geos: ["DZ"],
      cpftd: 4002,
      cprd: 12007,
      cpsub: 1091,
      cpcon: 1500,
      cpcheck: 2401,
      clicks_per_ftd: 31,
      sub_to_contact: 73,
      sub_to_checkout: 45,
      sub_to_ftd: 27,
      sub_to_rd: 9,
      days: spark(8, 7),
    },
    {
      creative: "DZ_IMG_046_0811",
      spend: 9_834,
      clicks: 71,
      sub: 9,
      contact: 7,
      checkout: 4,
      ftd: 2,
      rd: 0,
      ads: 2,
      ads_with_ftd: 2,
      geos: ["DZ"],
      cpftd: 4917,
      cprd: null, // 0/0 → null (not 0)
      cpsub: 1092,
      cpcon: 1404,
      cpcheck: 2458,
      clicks_per_ftd: 36,
      sub_to_contact: 78,
      sub_to_checkout: 44,
      sub_to_ftd: 22,
      sub_to_rd: 0,
      days: spark(88, 7),
    },
    {
      creative: "BD_IMG_011_0811",
      spend: 5_400,
      clicks: 41,
      sub: 5,
      contact: 4,
      checkout: 2,
      ftd: 1,
      rd: 0,
      ads: 1,
      ads_with_ftd: 1,
      geos: ["BD"],
      cpftd: 5400,
      cprd: null,
      cpsub: 1080,
      cpcon: 1350,
      cpcheck: 2700,
      clicks_per_ftd: 41,
      sub_to_contact: 80,
      sub_to_checkout: 40,
      sub_to_ftd: 20,
      sub_to_rd: 0,
      days: spark(67, 7),
    },
    // NOT_A_CREATIVE — always last
    {
      creative: "unidentified",
      spend: 0,
      clicks: 0,
      sub: 0,
      contact: 0,
      checkout: 0,
      ftd: 0,
      rd: 0,
      ads: 4,
      ads_with_ftd: 0,
      geos: [],
      cpftd: null,
      cprd: null,
      cpsub: null,
      cpcon: null,
      cpcheck: null,
      clicks_per_ftd: null,
      sub_to_contact: null,
      sub_to_checkout: null,
      sub_to_ftd: null,
      sub_to_rd: null,
      days: spark(99, 7),
    },
  ],
};

/* sample ads for one creative (DZ_VID_014_0708) */
export const SAMPLE_ADS: AdRow[] = [
  {
    fb_id: "238471122334455",
    ad_name: "DZ_VID_014_0708_v3_lp1_M_25-34",
    creative: "DZ_VID_014_0708",
    act_id: "act_2270870780419667",
    act_name: "Hiuhiu_Mediabuyer3_11.8_9",
    agency: "hiu",
    campaign_id: "238471000998877",
    campaign: "DZ-VSL-Retargeting-08",
    adset_id: "238471001112233",
    adset: "LP1_25-34_DZ_M_v3",
    geo: "DZ",
    attrib_method: "7d_click_1d_view",
    attrib_confidence: 0.94,
    effective_status: "ACTIVE",
    socials: ["hiu_buyer3"],
    owner_profile: "hiu_buyer3",
    spend: 84_120,
    clicks: 612,
    sub: 81,
    contact: 60,
    checkout: 41,
    ftd: 28,
    rd: 8,
    spend_at: "2026-08-18T22:14:00Z",
    funnel_at: "2026-08-18T22:10:00Z",
  },
  {
    fb_id: "238471122334456",
    ad_name: "DZ_VID_014_0708_v3_lp1_F_25-34",
    creative: "DZ_VID_014_0708",
    act_id: "act_2270870780419667",
    act_name: "Hiuhiu_Mediabuyer3_11.8_9",
    agency: "hiu",
    campaign_id: "238471000998877",
    campaign: "DZ-VSL-Retargeting-08",
    adset_id: "238471001112234",
    adset: "LP1_25-34_DZ_F_v3",
    geo: "DZ",
    attrib_method: "7d_click_1d_view",
    attrib_confidence: 0.92,
    effective_status: "ADSET_PAUSED",
    socials: ["hiu_buyer3"],
    owner_profile: "hiu_buyer3",
    spend: 41_200,
    clicks: 308,
    sub: 38,
    contact: 28,
    checkout: 19,
    ftd: 11,
    rd: 4,
    spend_at: "2026-08-18T18:00:00Z", // 4h ago — late
    funnel_at: "2026-08-18T16:30:00Z",
  },
  {
    fb_id: "238471122334457",
    ad_name: "DZ_VID_014_0708_v2_lp2_M_18-24",
    creative: "DZ_VID_014_0708",
    act_id: "act_4466055873683884",
    act_name: "Hiuhiu_Mediabuyer3_11.8_6",
    agency: "hiu",
    campaign_id: "238471000998878",
    campaign: "DZ-VSL-Prospecting-08",
    adset_id: "238471001112240",
    adset: "LP2_18-24_DZ_M_v2",
    geo: "DZ",
    attrib_method: "7d_click_1d_view",
    attrib_confidence: 0.88,
    effective_status: "ACTIVE",
    socials: ["hiu_buyer3"],
    owner_profile: "hiu_buyer3",
    spend: 66_698,
    clicks: 482,
    sub: 68,
    contact: 54,
    checkout: 38,
    ftd: 25,
    rd: 6,
    spend_at: "2026-08-18T22:14:00Z",
    funnel_at: "2026-08-18T22:12:00Z",
  },
];

/* AccountCheck for ad recon (lib/analytics.ts:42) */
export const ACCOUNT_CHECKS: Record<string, AccountCheck> = {
  // Mismatch on the second cab — panel has $10 less than Meta
  "act_2270870780419667": {
    diff: 0,
    meta: 609_19,
    ours: 609_19,
    at: "2026-08-18T22:14:00Z",
    date: "2026-08-18",
  },
  "act_4466055873683884": {
    diff: -10_00,
    meta: 572_53,
    ours: 562_53,
    at: "2026-08-18T22:14:00Z",
    date: "2026-08-18",
  },
};

/* ── Geo and agency aggregations ────────────────────────────────── */

export const GEO_BREAKDOWN = [
  { geo: "DZ", pct: 0.58, spend: 485_233 },
  { geo: "BD", pct: 0.24, spend: 200_762 },
  { geo: "BR", pct: 0.11, spend: 92_018 },
  { geo: "OTHER", pct: 0.07, spend: 58_550 },
] as const;

export const AGENCY_BREAKDOWN = [
  { agency: "hiu", pct: 0.71 },
  { agency: "spx", pct: 0.29 },
] as const;

/* ── Campaigns (timeline) — for CampaignsView ────────────────────── */

export const CAMPAIGNS: Campaign[] = [
  {
    fb_id: "238471000998877",
    level: "campaign",
    act_id: "act_2270870780419667",
    act_name: "Hiuhiu_Mediabuyer3_11.8_9",
    name: "DZ-VSL-Retargeting-08",
    status: "ACTIVE",
    effective_status: "ACTIVE",
    daily_budget: 25_000, // $250
    lifetime_budget: null,
    currency: "USD",
    checked_at: "2026-08-18T22:14:00Z",
    owner: "hiu_buyer3",
    status_source: "live",
    active_ads: 1,
    spend: 84_120,
    impressions: 218_440,
    clicks: 612,
    link_clicks: 489,
    reach: 31_204,
    results: 28,
    result_type: "offsite_conversion.fb_pixel_purchase",
    results_mixed: false,
  },
  {
    fb_id: "238471000998878",
    level: "campaign",
    act_id: "act_4466055873683884",
    act_name: "Hiuhiu_Mediabuyer3_11.8_6",
    name: "DZ-VSL-Prospecting-08",
    status: "ACTIVE",
    effective_status: "CAMPAIGN_PAUSED",
    daily_budget: 50_000,
    lifetime_budget: null,
    currency: "USD",
    checked_at: "2026-08-18T22:14:00Z",
    owner: "hiu_buyer3",
    status_source: "derived",
    active_ads: 1,
    spend: 66_698,
    impressions: 174_002,
    clicks: 482,
    link_clicks: 401,
    reach: 22_800,
    results: 25,
    result_type: "offsite_conversion.fb_pixel_purchase",
    results_mixed: false,
  },
  {
    fb_id: "238471000998880",
    level: "campaign",
    act_id: "act_1523320569016244",
    act_name: "MeDuA6aeP 11/8-1",
    name: "BD-Backup-08",
    status: "PAUSED",
    effective_status: "PAUSED",
    daily_budget: 15_000,
    lifetime_budget: null,
    currency: "USD",
    checked_at: "2026-08-18T22:13:00Z",
    owner: "hiu_buyer5",
    status_source: "live",
    active_ads: 0,
    spend: 12_400,
    impressions: 48_200,
    clicks: 142,
    link_clicks: 118,
    reach: 8_400,
    results: 4,
    result_type: "offsite_conversion.fb_pixel_purchase",
    results_mixed: false,
  },
  {
    fb_id: "238471000998890",
    level: "campaign",
    act_id: "act_8842013394715098",
    act_name: "SPX_BD_08-15",
    name: "SPX-BD-Scale-08",
    status: "ACTIVE",
    effective_status: "ACTIVE",
    daily_budget: 30_000,
    lifetime_budget: null,
    currency: "USD",
    checked_at: "2026-08-18T22:10:00Z",
    owner: "spx_main",
    status_source: "live",
    active_ads: 3,
    spend: 187_200,
    impressions: 412_800,
    clicks: 1_204,
    link_clicks: 982,
    reach: 64_200,
    results: 62,
    result_type: "offsite_conversion.fb_pixel_purchase",
    results_mixed: false,
  },
  {
    fb_id: "238471000998900",
    level: "campaign",
    act_id: "act_2901844756137922",
    act_name: "SPX_BR_07-22",
    name: "BR-Archive-07",
    status: "ARCHIVED",
    effective_status: "ARCHIVED",
    daily_budget: null,
    lifetime_budget: 200_000,
    currency: "BRL",
    checked_at: "2026-08-18T22:09:00Z",
    owner: "spx_main",
    status_source: "live",
    active_ads: 0,
    spend: 187_500_00, // BRL — cents
    impressions: 0,
    clicks: 0,
    link_clicks: 0,
    reach: null,
    results: null,
    result_type: null,
    results_mixed: false,
  },
];

/* Timeline-friendly campaign strips: for each cab, an array of {start, end, status} */
export const CAMPAIGN_TIMELINE = [
  {
    act_id: "act_2270870780419667",
    act_name: "Hiuhiu_Mediabuyer3_11.8_9",
    strips: [
      { start: 0, end: 4, status: "ACTIVE", label: "DZ-VSL-Retarget-07" },
      { start: 5, end: 7, status: "PAUSED", label: "paused for review" },
    ],
  },
  {
    act_id: "act_4466055873683884",
    act_name: "Hiuhiu_Mediabuyer3_11.8_6",
    strips: [
      { start: 0, end: 6, status: "ACTIVE", label: "DZ-VSL-Prospect-08" },
      { start: 6, end: 7, status: "CAMPAIGN_PAUSED", label: "paused by owner" },
    ],
  },
  {
    act_id: "act_1523320569016244",
    act_name: "MeDuA6aeP 11/8-1",
    strips: [
      { start: 0, end: 2, status: "ACTIVE", label: "BD-Backup-08" },
      { start: 2, end: 7, status: "PAUSED", label: "paused" },
    ],
  },
  {
    act_id: "act_7339014558821901",
    act_name: "Hiuhiu_Buyer7_DZ_01",
    strips: [
      { start: 0, end: 5, status: "ACTIVE", label: "DZ-Buyer7-07" },
      { start: 5, end: 7, status: "BILLING", label: "IN_GRACE_PERIOD" },
    ],
  },
  {
    act_id: "act_8842013394715098",
    act_name: "SPX_BD_08-15",
    strips: [
      { start: 0, end: 7, status: "ACTIVE", label: "SPX-BD-Scale-08" },
    ],
  },
  {
    act_id: "act_2901844756137922",
    act_name: "SPX_BR_07-22",
    strips: [
      { start: 0, end: 3, status: "ACTIVE", label: "BR-Active-07" },
      { start: 3, end: 5, status: "PAUSED", label: "paused" },
      { start: 5, end: 7, status: "ARCHIVED", label: "archived" },
    ],
  },
  {
    act_id: "act_6619200471188355",
    act_name: "Hiuhiu_Mediabuyer3_11.8_3",
    strips: [
      { start: 0, end: 2, status: "ACTIVE", label: "DZ-Buyer3-backup" },
      { start: 2, end: 7, status: "DEAD", label: "PENDING_CLOSURE" },
    ],
  },
  {
    act_id: "act_4492011583320071",
    act_name: "Hiuhiu_Buyer5_BD_09",
    strips: [
      { start: 0, end: 4, status: "ACTIVE", label: "BD-Buyer5-09" },
      { start: 4, end: 7, status: "REVIEW", label: "PENDING_RISK_REVIEW" },
    ],
  },
  {
    act_id: "act_1908774425630014",
    act_name: "MeDuA6aeP 11/8-4",
    strips: [
      { start: 0, end: 7, status: "ACTIVE", label: "BR-MeDuA-08" },
    ],
  },
  {
    act_id: "act_5571299036884217",
    act_name: "SPX_DZ_06-11",
    strips: [
      { start: 0, end: 5, status: "ACTIVE", label: "DZ-SPX-06" },
      { start: 5, end: 7, status: "PAUSED", label: "no card" },
    ],
  },
  {
    act_id: "act_6024817790338159",
    act_name: "Hiuhiu_Mediabuyer3_11.8_12",
    strips: [
      { start: 0, end: 6, status: "ACTIVE", label: "DZ-Buyer3-12" },
      { start: 6, end: 7, status: "BILLING", label: "UNSETTLED" },
    ],
  },
  {
    act_id: "act_3349801172290084",
    act_name: "John Smith",
    strips: [
      { start: 0, end: 7, status: "PERSONAL", label: "personal — no upload" },
    ],
  },
];
