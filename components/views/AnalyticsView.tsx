"use client";

import { useState, useMemo } from "react";
import {
  Search,
  AlertTriangle,
  X,
  Filter,
  Download,
  ChevronRight,
  ChevronDown,
  Settings2,
  CheckCircle2,
  CircleHelp,
  Eye,
  EyeOff,
} from "lucide-react";
import { BOARD, NOT_A_CREATIVE, money, num, pct, whenShort } from "@/lib/mock";
import type { CreativeRow } from "@/lib/types";
import { StatusPill, Dot } from "@/components/StatusPill";

/* ─────────────────────────────────────────────────────────────────────
 * AnalyticsView — CreativeTable leaderboard
 *
 * Одна строка = один креатив. Раскрытие = список кабов с этим крео.
 *
 * Верх:
 *  - BlockedBanner (если Meta API заблокирована)
 *  - PeriodPicker (URL-bound)
 *  - GeoTabs
 *  - FilterBar (search, hidden toggle, ColumnPicker, Collapse all, Export)
 *
 * Тело:
 *  - CreativeTable
 *  - Total row (sticky bottom)
 *
 * Ключевые семантические правила:
 *  - 0 ≠ null: null → "—", 0 → "0" / "$0"
 *  - NOT_A_CREATIVE ("unidentified") всегда внизу
 *  - hide creatives without spend (default ON)
 *  - coverage: { exact, estimate, unknown, total } — показываем
 *  - AccountCheck: diff > 0.01 → alert
 * ───────────────────────────────────────────────────────────────────── */

const PERIODS = [
  { key: "today", label: "Today" },
  { key: "yesterday", label: "Yesterday" },
  { key: "last_7d", label: "Last 7 days" },
  { key: "last_14d", label: "Last 14 days" },
  { key: "last_30d", label: "Last 30 days" },
  { key: "this_month", label: "This month" },
] as const;

const COLUMNS = [
  { key: "spend",         label: "Spend",     default: true },
  { key: "cpsub",         label: "CPSub",     default: true },
  { key: "cpcon",         label: "CPContact", default: true },
  { key: "cpcheck",       label: "CPCheckout", default: true },
  { key: "cpftd",         label: "CPFTD",     default: true },
  { key: "cprd",          label: "CPRD",      default: true },
  { key: "sub_to_contact", label: "Sub→Contact", default: false },
  { key: "sub_to_checkout",label: "Sub→Checkout", default: false },
  { key: "sub_to_ftd",    label: "Sub→FTD",   default: true },
  { key: "sub_to_rd",     label: "Sub→RD",    default: false },
  { key: "clicks_per_ftd",label: "Clicks/FTD",default: false },
  { key: "ads",           label: "Ads",        default: true },
  { key: "ads_with_ftd",  label: "with FTD",   default: false },
  { key: "clicks",        label: "Clicks",     default: false },
  { key: "geos",          label: "Geos",       default: true },
] as const;

type ColKey = typeof COLUMNS[number]["key"];

export function AnalyticsView() {
  const [period, setPeriod] = useState<typeof PERIODS[number]["key"]>("last_7d");
  const [geo, setGeo] = useState<string | null>(null);
  const [q, setQ] = useState("");
  const [hideNoSpend, setHideNoSpend] = useState(true);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [visibleCols, setVisibleCols] = useState<Set<ColKey>>(
    () => new Set(COLUMNS.filter((c) => c.default).map((c) => c.key))
  );
  const [colPickerOpen, setColPickerOpen] = useState(false);

  const geos = useMemo(() => {
    const seen = new Set<string>();
    BOARD.rows.forEach((r) => r.geos.forEach((g) => seen.add(g)));
    return Array.from(seen).sort();
  }, []);

  const rows = useMemo(() => {
    const ql = q.trim().toLowerCase();
    return BOARD.rows.filter((r) => {
      if (hideNoSpend && r.spend === 0 && !NOT_A_CREATIVE.includes(r.creative as any)) return false;
      if (geo && !r.geos.includes(geo)) return false;
      if (ql && !r.creative.toLowerCase().includes(ql)) return false;
      return true;
    });
  }, [q, geo, hideNoSpend]);

  // NOT_A_CREATIVE always last
  const sorted = useMemo(() => {
    return [...rows].sort((a, b) => {
      const aNAC = NOT_A_CREATIVE.includes(a.creative as any);
      const bNAC = NOT_A_CREATIVE.includes(b.creative as any);
      if (aNAC && !bNAC) return 1;
      if (bNAC && !aNAC) return -1;
      return b.spend - a.spend;
    });
  }, [rows]);

  const totals = useMemo(() => {
    const t: Record<string, number | null> = {};
    let spend = 0,
      clicks = 0,
      sub = 0,
      contact = 0,
      checkout = 0,
      ftd = 0,
      rd = 0,
      ads = 0,
      ads_with_ftd = 0;
    sorted.forEach((r) => {
      spend += r.spend;
      clicks += r.clicks;
      sub += r.sub;
      contact += r.contact;
      checkout += r.checkout;
      ftd += r.ftd;
      rd += r.rd;
      ads += r.ads;
      ads_with_ftd += r.ads_with_ftd;
    });
    t.spend = spend;
    t.clicks = clicks;
    t.sub = sub;
    t.contact = contact;
    t.checkout = checkout;
    t.ftd = ftd;
    t.rd = rd;
    t.ads = ads;
    t.ads_with_ftd = ads_with_ftd;
    // cpX: divide totals, not average the column (lib/analytics-total.ts)
    t.cpsub = sub > 0 ? Math.round(spend / sub) : null;
    t.cpcon = contact > 0 ? Math.round(spend / contact) : null;
    t.cpcheck = checkout > 0 ? Math.round(spend / checkout) : null;
    t.cpftd = ftd > 0 ? Math.round(spend / ftd) : null;
    t.cprd = rd > 0 ? Math.round(spend / rd) : null;
    t.sub_to_contact = sub > 0 ? (contact / sub) : null;
    t.sub_to_checkout = sub > 0 ? (checkout / sub) : null;
    t.sub_to_ftd = sub > 0 ? (ftd / sub) : null;
    t.sub_to_rd = sub > 0 ? (rd / sub) : null;
    t.clicks_per_ftd = ftd > 0 ? clicks / ftd : null;
    return t;
  }, [sorted]);

  const toggleRow = (creative: string) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(creative)) next.delete(creative);
      else next.add(creative);
      return next;
    });
  };

  const collapseAll = () => setExpanded(new Set());

  const exportCSV = () => {
    const head = ["creative", "spend", "clicks", "sub", "ftd", "rd", "ads_with_ftd", "cpftd", "cprd"];
    const lines = [head.join(",")];
    sorted.forEach((r) => {
      lines.push(
        [
          `"${r.creative}"`,
          (r.spend / 100).toFixed(2),
          r.clicks,
          r.sub,
          r.ftd,
          r.rd,
          r.ads_with_ftd,
          r.cpftd != null ? (r.cpftd / 100).toFixed(2) : "",
          r.cprd != null ? (r.cprd / 100).toFixed(2) : "",
        ].join(",")
      );
    });
    const blob = new Blob(["\ufeff" + lines.join("\n")], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `obelista-analytics-${BOARD.since}-${BOARD.until}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div style={{ padding: "24px 32px 120px" }}>
      {/* BlockedBanner — Meta API заблокирована */}
      <BlockedBanner />

      {/* Header */}
      <header style={{ marginBottom: 20 }}>
        <h1 style={{ fontSize: 24, fontWeight: 700, color: "var(--color-ink)", letterSpacing: -0.2 }}>
          Analytics
        </h1>
        <p style={{ fontSize: 13, color: "var(--color-ink-muted)", marginTop: 4 }}>
          Creative leaderboard ·{" "}
          <span className="mono">{num(sorted.length)}</span> creatives in window ·{" "}
          coverage{" "}
          <span className="mono">
            {BOARD.coverage.exact}/{BOARD.coverage.total}
          </span>{" "}
          exact ·{" "}
          <span style={{ color: BOARD.coverage.unknown > 0 ? "#b45309" : "var(--color-ink-muted)" }}>
            <span className="mono">{BOARD.coverage.unknown}</span> unknown
          </span>
        </p>
      </header>

      {/* Period + Geo tabs */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 12,
          marginBottom: 16,
          flexWrap: "wrap",
        }}
      >
        <div className="seg">
          {PERIODS.map((p) => (
            <button key={p.key} className={period === p.key ? "active" : ""} onClick={() => setPeriod(p.key)}>
              {p.label}
            </button>
          ))}
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 2, borderBottom: "1px solid var(--color-line)" }}>
          <GeoTab active={geo === null} onClick={() => setGeo(null)}>
            All geos
          </GeoTab>
          {geos.map((g) => (
            <GeoTab key={g} active={geo === g} onClick={() => setGeo(g)}>
              {g}
            </GeoTab>
          ))}
        </div>
      </div>

      {/* Filter bar */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 8,
          marginBottom: 8,
        }}
      >
        <div style={{ position: "relative", flex: 1, maxWidth: 360 }}>
          <Search
            size={14}
            strokeWidth={2}
            style={{
              position: "absolute",
              left: 12,
              top: "50%",
              transform: "translateY(-50%)",
              color: "var(--color-ink-faint)",
            }}
          />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search creatives by name…"
            style={{
              width: "100%",
              height: 36,
              padding: "0 12px 0 32px",
              borderRadius: 8,
              border: "1px solid var(--color-line)",
              background: "var(--color-surface)",
              color: "var(--color-ink)",
              fontSize: 14,
              outline: "none",
            }}
          />
        </div>

        <button
          className="toolbar-btn"
          onClick={() => setHideNoSpend((v) => !v)}
        >
          {hideNoSpend ? <EyeOff size={14} strokeWidth={2} /> : <Eye size={14} strokeWidth={2} />}
          <span>{hideNoSpend ? "Showing creatives with spend" : "Showing all"}</span>
        </button>

        <button className="toolbar-btn" onClick={collapseAll}>
          <ChevronDown size={14} strokeWidth={2} />
          Collapse all
        </button>

        <div style={{ position: "relative" }}>
          <button className="toolbar-btn" onClick={() => setColPickerOpen((v) => !v)}>
            <Settings2 size={14} strokeWidth={2} />
            Columns · {visibleCols.size}
          </button>
          {colPickerOpen && (
            <ColumnPicker
              visible={visibleCols}
              onChange={setVisibleCols}
              onClose={() => setColPickerOpen(false)}
            />
          )}
        </div>

        <button className="toolbar-btn" onClick={exportCSV}>
          <Download size={14} strokeWidth={2} />
          Export CSV
        </button>
      </div>

      {/* Table */}
      <div
        style={{
          background: "var(--color-surface)",
          border: "1px solid var(--color-line)",
          borderRadius: 12,
          overflow: "hidden",
        }}
      >
        {/* header */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: gridTemplate(visibleCols),
            padding: "10px 16px",
            background: "var(--color-surface-subtle)",
            borderBottom: "1px solid var(--color-line)",
            fontSize: 11,
            fontWeight: 600,
            color: "var(--color-ink-faint)",
            letterSpacing: 0.4,
            textTransform: "uppercase",
            alignItems: "center",
          }}
        >
          <span>Creative</span>
          {visibleCols.has("spend") && <Cell header>Spend</Cell>}
          {visibleCols.has("cpsub") && <Cell header>CPSub</Cell>}
          {visibleCols.has("cpcon") && <Cell header>CPCon</Cell>}
          {visibleCols.has("cpcheck") && <Cell header>CPCheck</Cell>}
          {visibleCols.has("cpftd") && <Cell header>CPFTD</Cell>}
          {visibleCols.has("cprd") && <Cell header>CPRD</Cell>}
          {visibleCols.has("sub_to_ftd") && <Cell header>Sub→FTD</Cell>}
          {visibleCols.has("sub_to_contact") && <Cell header>Sub→Con</Cell>}
          {visibleCols.has("sub_to_checkout") && <Cell header>Sub→Check</Cell>}
          {visibleCols.has("sub_to_rd") && <Cell header>Sub→RD</Cell>}
          {visibleCols.has("clicks_per_ftd") && <Cell header>Clicks/FTD</Cell>}
          {visibleCols.has("ads") && <Cell header>Ads</Cell>}
          {visibleCols.has("ads_with_ftd") && <Cell header>with FTD</Cell>}
          {visibleCols.has("clicks") && <Cell header>Clicks</Cell>}
          {visibleCols.has("geos") && <Cell header>Geos</Cell>}
          <Cell header>7d</Cell>
        </div>

        {sorted.length === 0 ? (
          <div style={{ padding: "48px 24px", textAlign: "center", color: "var(--color-ink-muted)" }}>
            <p style={{ marginBottom: 8 }}>None of the {BOARD.rows.length} creatives in this range have spend connected.</p>
            <button onClick={() => setHideNoSpend(false)} className="toolbar-btn primary">
              Show them
            </button>
          </div>
        ) : (
          sorted.map((r) => (
            <CreativeRow
              key={r.creative}
              row={r}
              visibleCols={visibleCols}
              expanded={expanded.has(r.creative)}
              onToggle={() => toggleRow(r.creative)}
            />
          ))
        )}

        {/* Totals row */}
        {sorted.length > 0 && (
          <div
            style={{
              display: "grid",
              gridTemplateColumns: gridTemplate(visibleCols),
              padding: "12px 16px",
              background: "var(--color-surface-subtle)",
              borderTop: "1px solid var(--color-line)",
              fontSize: 13,
              alignItems: "center",
              fontWeight: 600,
              color: "var(--color-ink)",
            }}
          >
            <span>
              Total <span style={{ color: "var(--color-ink-muted)", fontWeight: 500, marginLeft: 4 }}>· divided, not averaged</span>
            </span>
            {visibleCols.has("spend") && <Cell mono>{money(totals.spend ?? null)}</Cell>}
            {visibleCols.has("cpsub") && <Cell mono>{totals.cpsub != null ? money(totals.cpsub) : "—"}</Cell>}
            {visibleCols.has("cpcon") && <Cell mono>{totals.cpcon != null ? money(totals.cpcon) : "—"}</Cell>}
            {visibleCols.has("cpcheck") && <Cell mono>{totals.cpcheck != null ? money(totals.cpcheck) : "—"}</Cell>}
            {visibleCols.has("cpftd") && <Cell mono>{totals.cpftd != null ? money(totals.cpftd) : "—"}</Cell>}
            {visibleCols.has("cprd") && <Cell mono>{totals.cprd != null ? money(totals.cprd) : "—"}</Cell>}
            {visibleCols.has("sub_to_ftd") && <Cell mono>{pct(totals.sub_to_ftd)}</Cell>}
            {visibleCols.has("sub_to_contact") && <Cell mono>{pct(totals.sub_to_contact)}</Cell>}
            {visibleCols.has("sub_to_checkout") && <Cell mono>{pct(totals.sub_to_checkout)}</Cell>}
            {visibleCols.has("sub_to_rd") && <Cell mono>{pct(totals.sub_to_rd)}</Cell>}
            {visibleCols.has("clicks_per_ftd") && <Cell mono>{totals.clicks_per_ftd?.toFixed(1) ?? "—"}</Cell>}
            {visibleCols.has("ads") && <Cell mono>{num(totals.ads)}</Cell>}
            {visibleCols.has("ads_with_ftd") && <Cell mono>{num(totals.ads_with_ftd)}</Cell>}
            {visibleCols.has("clicks") && <Cell mono>{num(totals.clicks)}</Cell>}
            {visibleCols.has("geos") && <Cell mono>—</Cell>}
            <Cell mono />
          </div>
        )}
      </div>

      <p
        style={{
          fontSize: 11,
          color: "var(--color-ink-faint)",
          marginTop: 8,
          textAlign: "right",
        }}
      >
        totals summed over the ads the filter kept ·{" "}
        <span className="mono">—</span> means the column has no value (null, not 0)
      </p>
    </div>
  );
}

/* ── Sub-components ─────────────────────────────────────────────── */

function BlockedBanner() {
  return (
    <div
      role="status"
      style={{
        marginBottom: 16,
        padding: "12px 16px",
        borderRadius: 10,
        background: "var(--color-warn-soft)",
        border: "1px solid #fde68a",
        display: "flex",
        alignItems: "flex-start",
        gap: 10,
      }}
    >
      <AlertTriangle size={16} strokeWidth={2} style={{ color: "#92400e", marginTop: 2, flexShrink: 0 }} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 13, fontWeight: 600, color: "#7c2d12" }}>
          No answer from the collector
        </div>
        <div style={{ fontSize: 12, color: "#7c2d12", marginTop: 2 }}>
          Last successful read 4 min ago. The daemon is in a backoff window — the data you see is the last good sweep, not stale.{" "}
          <a style={{ textDecoration: "underline", color: "#7c2d12" }} href="#">Refresh</a>{" "}
          ·{" "}
          <a style={{ textDecoration: "underline", color: "#7c2d12" }} href="#">View health</a>
        </div>
      </div>
    </div>
  );
}

function GeoTab({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      style={{
        height: 32,
        padding: "0 12px",
        background: "transparent",
        border: 0,
        borderBottom: active ? "2px solid var(--color-brand-700)" : "2px solid transparent",
        color: active ? "var(--color-brand-700)" : "var(--color-ink-muted)",
        fontSize: 12,
        fontWeight: active ? 600 : 500,
        cursor: "pointer",
        marginBottom: -1,
        transition: "color 200ms ease, border-color 200ms ease",
      }}
    >
      {children}
    </button>
  );
}

function Cell({
  children,
  header = false,
  mono = false,
}: {
  children?: React.ReactNode;
  header?: boolean;
  mono?: boolean;
}) {
  return (
    <span
      className={mono ? "num" : undefined}
      style={{
        textAlign: "right",
        color: header ? "var(--color-ink-faint)" : "var(--color-ink)",
        fontFamily: mono ? "var(--font-mono)" : undefined,
        fontVariantNumeric: mono ? "tabular-nums" : undefined,
      }}
    >
      {children}
    </span>
  );
}

function gridTemplate(visible: Set<ColKey>) {
  // 240px creative | per-visible 90px | 120px sparkline
  const n = COLUMNS.filter((c) => visible.has(c.key)).length;
  return `minmax(240px, 1.6fr) ${Array(n).fill("minmax(70px, 0.8fr)").join(" ")} minmax(120px, 0.9fr)`;
}

function CreativeRow({
  row,
  visibleCols,
  expanded,
  onToggle,
}: {
  row: CreativeRow;
  visibleCols: Set<ColKey>;
  expanded: boolean;
  onToggle: () => void;
}) {
  const isNAC = NOT_A_CREATIVE.includes(row.creative as any);
  return (
    <div
      style={{
        borderBottom: "1px solid var(--color-line-soft)",
        background: isNAC ? "var(--color-surface-sunken)" : "transparent",
        opacity: isNAC ? 0.7 : 1,
      }}
    >
      <div
        role="row"
        onClick={onToggle}
        style={{
          display: "grid",
          gridTemplateColumns: gridTemplate(visibleCols),
          padding: "12px 16px",
          fontSize: 13,
          alignItems: "center",
          cursor: "pointer",
          transition: "background-color 200ms ease",
        }}
        onMouseEnter={(e) => (e.currentTarget.style.background = "var(--color-surface-subtle)")}
        onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
      >
        <span style={{ display: "inline-flex", alignItems: "center", gap: 6, color: "var(--color-ink)" }}>
          {expanded ? <ChevronDown size={14} strokeWidth={2} /> : <ChevronRight size={14} strokeWidth={2} />}
          <span className="mono" style={{ fontWeight: 600, fontSize: 13 }}>{row.creative}</span>
          {isNAC && <StatusPill tone="neutral" size="sm">no bundle matched</StatusPill>}
        </span>
        {visibleCols.has("spend") && <Cell mono>{money(row.spend)}</Cell>}
        {visibleCols.has("cpsub") && <Cell mono>{row.cpsub != null ? money(row.cpsub) : "—"}</Cell>}
        {visibleCols.has("cpcon") && <Cell mono>{row.cpcon != null ? money(row.cpcon) : "—"}</Cell>}
        {visibleCols.has("cpcheck") && <Cell mono>{row.cpcheck != null ? money(row.cpcheck) : "—"}</Cell>}
        {visibleCols.has("cpftd") && <Cell mono>{row.cpftd != null ? money(row.cpftd) : "—"}</Cell>}
        {visibleCols.has("cprd") && <Cell mono>{row.cprd != null ? money(row.cprd) : "—"}</Cell>}
        {visibleCols.has("sub_to_ftd") && <Cell mono>{pct(row.sub_to_ftd)}</Cell>}
        {visibleCols.has("sub_to_contact") && <Cell mono>{pct(row.sub_to_contact)}</Cell>}
        {visibleCols.has("sub_to_checkout") && <Cell mono>{pct(row.sub_to_checkout)}</Cell>}
        {visibleCols.has("sub_to_rd") && <Cell mono>{pct(row.sub_to_rd)}</Cell>}
        {visibleCols.has("clicks_per_ftd") && <Cell mono>{row.clicks_per_ftd != null ? row.clicks_per_ftd.toFixed(1) : "—"}</Cell>}
        {visibleCols.has("ads") && <Cell mono>{num(row.ads)}</Cell>}
        {visibleCols.has("ads_with_ftd") && <Cell mono>{num(row.ads_with_ftd)}</Cell>}
        {visibleCols.has("clicks") && <Cell mono>{num(row.clicks)}</Cell>}
        {visibleCols.has("geos") && (
          <span style={{ display: "inline-flex", gap: 4 }}>
            {row.geos.map((g) => (
              <span
                key={g}
                className="mono"
                style={{
                  display: "inline-block",
                  padding: "1px 6px",
                  borderRadius: 4,
                  fontSize: 10,
                  fontWeight: 600,
                  background: "var(--color-surface-sunken)",
                  color: "var(--color-ink-muted)",
                }}
              >
                {g}
              </span>
            ))}
            {row.geos.length === 0 && <span style={{ color: "var(--color-ink-faint)" }}>—</span>}
          </span>
        )}
        <span>
          <Sparkline points={row.days} />
        </span>
      </div>
      {expanded && <ExpandedCreative row={row} />}
    </div>
  );
}

function ExpandedCreative({ row }: { row: CreativeRow }) {
  return (
    <div
      style={{
        padding: "0 16px 16px 36px",
        background: "var(--color-surface-subtle)",
      }}
    >
      <div
        style={{
          padding: "12px 0",
          fontSize: 11,
          fontWeight: 600,
          color: "var(--color-ink-faint)",
          textTransform: "uppercase",
          letterSpacing: 0.4,
        }}
      >
        Ad accounts with this creative
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8 }}>
        {[
          { cab: "Hiuhiu_Mediabuyer3_11.8_9", agency: "hiu", status: "ACTIVE", spend: 84_120, ftd: 28 },
          { cab: "Hiuhiu_Mediabuyer3_11.8_6", agency: "hiu", status: "ADSET_PAUSED", spend: 41_200, ftd: 11 },
          { cab: "Hiuhiu_Buyer5_BD_09", agency: "hiu", status: "PENDING_RISK_REVIEW", spend: 32_400, ftd: 9 },
          { cab: "SPX_BD_08-15", agency: "spx", status: "ACTIVE", spend: 24_000, ftd: 6 },
          { cab: "SPX_DZ_06-11", agency: "spx", status: "PAUSED", spend: 8_900, ftd: 2 },
          { cab: "Hiuhiu_Mediabuyer3_11.8_12", agency: "hiu", status: "BILLING", spend: 1_400, ftd: 0 },
        ].map((c) => (
          <div
            key={c.cab}
            style={{
              background: "var(--color-surface)",
              border: "1px solid var(--color-line-soft)",
              borderRadius: 8,
              padding: 10,
            }}
          >
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <span className="mono" style={{ fontSize: 12, fontWeight: 600 }}>{c.cab}</span>
              <span
                className="mono"
                style={{
                  fontSize: 10,
                  fontWeight: 600,
                  color: c.agency === "hiu" ? "var(--color-brand-700)" : "var(--color-ink-muted)",
                }}
              >
                {c.agency}
              </span>
            </div>
            <div style={{ marginTop: 4, display: "flex", alignItems: "center", gap: 6, fontSize: 11, color: "var(--color-ink-muted)" }}>
              <span>{c.status}</span>
              <span>·</span>
              <span>{money(c.spend)}</span>
              <span>·</span>
              <span>{num(c.ftd)} ftd</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function Sparkline({ points }: { points: { date: string; spend: number }[] }) {
  if (!points.length) return <span style={{ color: "var(--color-ink-faint)" }}>—</span>;
  const W = 100;
  const H = 24;
  const max = Math.max(...points.map((p) => p.spend), 1);
  const step = W / (points.length - 1 || 1);
  const path = points
    .map((p, i) => {
      const x = i * step;
      const y = H - (p.spend / max) * (H - 2) - 1;
      return `${i === 0 ? "M" : "L"} ${x.toFixed(1)} ${y.toFixed(1)}`;
    })
    .join(" ");
  const area = `${path} L ${W} ${H} L 0 ${H} Z`;
  return (
    <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" style={{ display: "block" }}>
      <path d={area} fill="var(--color-brand-100)" />
      <path d={path} fill="none" stroke="var(--color-brand-700)" strokeWidth={1.5} strokeLinejoin="round" />
    </svg>
  );
}

function ColumnPicker({
  visible,
  onChange,
  onClose,
}: {
  visible: Set<ColKey>;
  onChange: (next: Set<ColKey>) => void;
  onClose: () => void;
}) {
  return (
    <div
      style={{
        position: "absolute",
        right: 0,
        top: 40,
        background: "var(--color-surface)",
        border: "1px solid var(--color-line)",
        borderRadius: 10,
        boxShadow: "0 8px 24px rgba(17,24,39,0.10)",
        padding: 8,
        zIndex: 30,
        minWidth: 220,
      }}
    >
      <div
        style={{
          padding: "6px 10px 8px",
          fontSize: 11,
          fontWeight: 600,
          color: "var(--color-ink-faint)",
          textTransform: "uppercase",
          letterSpacing: 0.4,
        }}
      >
        Visible columns
      </div>
      {COLUMNS.map((c) => {
        const on = visible.has(c.key);
        return (
          <button
            key={c.key}
            onClick={() => {
              const next = new Set(visible);
              if (on) next.delete(c.key);
              else next.add(c.key);
              onChange(next);
            }}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 8,
              width: "100%",
              padding: "6px 10px",
              background: "transparent",
              border: 0,
              borderRadius: 6,
              cursor: "pointer",
              fontSize: 13,
              color: "var(--color-ink)",
              textAlign: "left",
            }}
            onMouseEnter={(e) => (e.currentTarget.style.background = "var(--color-surface-subtle)")}
            onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
          >
            <span
              style={{
                width: 14,
                height: 14,
                borderRadius: 4,
                background: on ? "var(--color-brand-700)" : "transparent",
                border: on ? "1px solid var(--color-brand-700)" : "1px solid var(--color-line)",
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
                color: "#fff",
                flexShrink: 0,
              }}
            >
              {on && <CheckCircle2 size={10} strokeWidth={3} />}
            </span>
            <span>{c.label}</span>
          </button>
        );
      })}
      <div
        style={{
          borderTop: "1px solid var(--color-line-soft)",
          marginTop: 6,
          paddingTop: 6,
          display: "flex",
          justifyContent: "flex-end",
        }}
      >
        <button onClick={onClose} className="toolbar-btn" style={{ height: 28 }}>
          Done
        </button>
      </div>
    </div>
  );
}
