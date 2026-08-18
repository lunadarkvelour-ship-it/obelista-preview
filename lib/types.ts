// ─────────────────────────────────────────────────────────────────────
// Obelista — Domain Types
// Справочник форм данных, которые движут UI. Зеркалят lib/cloud-accounts.ts,
// lib/integrations.ts, lib/account-status.ts, lib/analytics.ts из продакшна
// Obelista. Имена не произвольны: "noUploadReason" ровно так в проде, "money
// в minor units" — то же правило. Если выдумать новое имя — UI перестанет
// матчиться с тем, что у юзера на app.obelista.com.
// ─────────────────────────────────────────────────────────────────────

// ── 5 status buckets (lib/account-status.ts:5) ─────────────────────
export type StatusLabel =
  | "active"
  | "disabled"
  | "billing"
  | "review"
  | "unknown";

// 5 reasons a row can't be uploaded (lib/cloud-accounts.ts:54)
export type NoUploadReason =
  | "account-dead"
  | "owners-unknown"
  | "no-live-window"
  | "no-connected-profile"
  | "vendor-gone";

// 3 connection states for vendors (lib/integrations.ts:18)
export type ConnStateKind =
  | "not_configured"
  | "connected"
  | "unreachable";

// Funnel canon (lib/funnel-metrics.ts:5)
export type FunnelStep =
  | "sub"
  | "contact"
  | "checkout"
  | "ftd"
  | "rd"
  | "revenue";

// Tier of every Meta status word (lib/account-status.ts:14)
export type MetaStatus =
  | "ACTIVE"
  | "DISABLED"
  | "PENDING_CLOSURE"
  | "UNSETTLED"
  | "IN_GRACE_PERIOD"
  | "PENDING_RISK_REVIEW"
  | "PENDING_APPEAL"
  | "TEMP_UNAVAILABLE"
  | string; // unknown future values

// ── Cloud account — то, что приходит с бэкенда (lib/cloud-accounts.ts:21)
export interface CloudAccount {
  act_id: string;
  name: string;
  bm_id?: string;
  bm_name?: string;
  currency: string; // ISO 4217
  status: MetaStatus;
  status_code?: number;
  disable_reason?: string;
  balance: number | null; // MINOR UNITS
  amount_spent: number | null; // MINOR UNITS, lifetime
  spend_cap: number | null; // MINOR UNITS, lifetime cap
  funding_type?: string;
  funding_display_string?: string; // "Visa · 1234"
  daily_limit_note?: string; // explicit non-value: "Not exposed via app token"
  status_checked_at: string; // ISO
}

// One social = one owner row (lib/cloud-accounts.ts:42)
export type VendorState =
  | "живой"
  | "нет_вендора"
  | "не_подтверждён";

export interface CloudOwner {
  profile_id: string;
  name?: string;
  oauth?: boolean; // token alive
  in_antidetect?: boolean | null; // window open. null = antidetect never answered
  vendor_state?: VendorState;
  vendor?: string;
}

// UnifiedAccount — what the panel draws (lib/cloud-accounts.ts:71)
export interface UnifiedAccount extends CloudAccount {
  owners: CloudOwner[]; // primary first
  profile: string | null; // the social to upload from
  profileLabel: string;
  pixels: Pixel[];
  personal: boolean; // auto-created personal FB account, never upload
  daily_limit?: number | null;
  inSnapshot: boolean;
  inCloud: boolean;
  fieldSources?: Record<string, "base" | "ads" | "snapshot">;
}

// ── Pixel (lib/cloud-accounts.ts:78) ────────────────────────────────
export interface Pixel {
  id: string;
  name?: string;
  last_fired_time?: string;
}

// ── Creative (lib/naming-guard.ts) ─────────────────────────────────
export type CreativeType = "video" | "image";
export type CreativeSize = "9:16" | "1:1" | "4:5";
export type CreativeStatus =
  | "cached" // залит на ≥1 каб, video_id в индексе
  | "new" // только в локальной media library
  | "pending" // uploading, есть upload_progress
  | "rejected" // отклонён Meta
  | "available_on_cab" // есть на кабе, не использовался
  | "personal"; // только в personal-кабе, нельзя заливать

export interface Creative {
  id: string; // neutral name
  name: string;
  type: CreativeType;
  geo: "DZ" | "BD" | "BR" | "OTHER";
  cabs_count: number; // 0..N
  spend_total: number; // MINOR UNITS, lifetime
  status: CreativeStatus;
  upload_progress?: number; // 0..100, только для pending
  size: CreativeSize;
  added: string; // ISO date
  rejected_on_cab?: string; // для rejected
  rejection_reason?: string;
}

// ── Vendor / Integration (lib/integrations.ts:54) ───────────────────
export type EngineSupport = "shipped" | "written" | "none";
export type SectionId = "trackers";
export type JoinBy = "ad_name" | "subid";
export type CredentialKind = "url" | "secret" | "text";

export interface CredentialField {
  key: string;
  label: string;
  kind: CredentialKind;
  required: boolean;
  hint?: string;
}

export interface Vendor {
  id: string;
  name: string;
  mark?: string; // иконка/инициал для карточки
  section: SectionId;
  summary: string; // 1-2 строки, зачем он
  support: EngineSupport;
  supportNote: string; // почему именно этот support
  joinBy?: JoinBy;
  gives?: readonly FunnelStep[]; // какие шаги воронки отдаёт
  fields: readonly CredentialField[];
  fieldsNote: string;
  issuesKey?: boolean; // panel выдаёт одноразовый ключ
  custom?: boolean; // свой webhook, customIntegrationCard
}

// What we know about a vendor right now (lib/integrations.ts:25)
export interface ConnCheckCtx {
  configured: boolean;
  last_check_at?: string;
  last_check_ok?: boolean;
  last_check_reason?: string;
}

// What panel backend has today (lib/integrations.ts:96)
export interface PanelBackend {
  store: boolean; // есть ли где хранить ключи
  check: boolean; // есть ли что ходит и проверяет
}

// ── Analytics (lib/analytics.ts:8) ──────────────────────────────────
export type Maybe<T> = T | null;

export interface SparkPoint {
  date: string; // ISO day
  spend: number; // MINOR UNITS for that day
}

export interface CreativeRow {
  creative: string;
  spend: number; // MINOR UNITS
  clicks: number;
  sub: number;
  contact: number;
  checkout: number;
  ftd: number;
  rd: number;
  ads: number;
  ads_with_ftd: number;
  geos: string[];
  // cost-per
  cpftd: number | null; // minor units
  cprd: number | null;
  cpsub: number | null;
  cpcon: number | null;
  cpcheck: number | null;
  // ratios
  clicks_per_ftd: number | null;
  sub_to_contact: number | null;
  sub_to_checkout: number | null;
  sub_to_ftd: number | null;
  sub_to_rd: number | null;
  days: SparkPoint[];
}

export interface AdRow {
  fb_id: string;
  ad_name: string;
  creative: string;
  act_id: string;
  act_name: string;
  agency: "hiu" | "spx" | string;
  campaign_id: string;
  campaign: string;
  adset_id: string;
  adset: string;
  geo: string;
  attrib_method: string; // "7d_click_1d_view"
  attrib_confidence: number; // 0..1
  effective_status:
    | "ACTIVE"
    | "PAUSED"
    | "CAMPAIGN_PAUSED"
    | "ADSET_PAUSED"
    | "DISAPPROVED"
    | "PENDING_REVIEW"
    | string;
  socials: string[];
  owner_profile: string | null;
  spend: number;
  clicks: number;
  sub: number;
  contact: number;
  checkout: number;
  ftd: number;
  rd: number;
  spend_at?: string;
  stale_gap_s?: number;
  stale_spend?: number;
  funnel_at?: string;
}

// Per-account reconciliation (lib/analytics.ts:42)
export interface AccountCheck {
  diff: number | null; // minor units; null = daemon never reached
  meta?: number;
  ours?: number;
  at?: string;
  date?: string;
}

export interface Board {
  ok: boolean;
  since: string;
  until: string;
  geo: string | null;
  rows: CreativeRow[];
  by_social: Record<string, number>;
  coverage: { exact: number; estimate: number; unknown: number; total: number };
  coverage_ads: { exact: number; estimate: number; unknown: number; total: number };
  unlinked_label: string;
  period?: { preset?: string; since?: string; until?: string; tz?: string };
  тишина?: unknown;
}

export interface Campaign {
  fb_id: string;
  level: "campaign" | "adset" | "ad";
  parent_id?: string;
  act_id: string;
  act_name: string;
  name: string;
  status: "ACTIVE" | "PAUSED" | "ARCHIVED" | "DELETED" | string; // wanted
  effective_status:
    | "ACTIVE"
    | "PAUSED"
    | "CAMPAIGN_PAUSED"
    | "ADSET_PAUSED"
    | "ARCHIVED"
    | "DELETED"
    | string; // delivering
  daily_budget: number | null; // MINOR UNITS
  lifetime_budget: number | null; // MINOR UNITS
  currency: string;
  checked_at: string; // ISO
  owner: string; // profile that can toggle
  status_source: "live" | "derived" | "unknown";
  active_ads: number; // currently delivering
  spend: number; // MINOR UNITS in window
  impressions: number;
  clicks: number;
  link_clicks: number;
  reach: number | null; // только для 1-day окон
  results: number | null;
  result_type: string | null;
  results_mixed: boolean;
}

// ── Period (lib/period.ts) ─────────────────────────────────────────
export type PeriodPreset =
  | "today"
  | "yesterday"
  | "last_7d"
  | "last_14d"
  | "last_30d"
  | "this_month";

export interface PeriodQuery {
  preset?: PeriodPreset;
  since?: string;
  until?: string;
  tz?: string;
}

// ── Side panel & UI state ─────────────────────────────────────────
export interface SidePanelState<T = unknown> {
  open: boolean;
  data: T | null;
  source?: "row" | "filter" | "context" | "manual";
}
