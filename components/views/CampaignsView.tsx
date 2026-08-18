"use client";

import { useState } from "react";
import {
  Play,
  Pause,
  AlertTriangle,
  Archive,
  CircleDot,
  ShieldAlert,
  Clock,
  CircleHelp,
  Filter,
  Activity,
  X,
} from "lucide-react";
import { CAMPAIGNS, CAMPAIGN_TIMELINE, whenShort } from "@/lib/mock";
import type { Campaign } from "@/lib/types";
import { SidePanel } from "@/components/SidePanel";
import { StatusPill, Dot } from "@/components/StatusPill";

/* ─────────────────────────────────────────────────────────────────────
 * CampaignsView — Gantt timeline
 * Inspired by Behance Rentier: horizontal days × vertical cabs,
 * color-coded campaign strips inside each row.
 *
 * Click strip → opens side panel with the campaign details
 * (wanted vs delivering, freshness, owner, budget, ads inside).
 * ───────────────────────────────────────────────────────────────────── */

const STRIP_COLORS = {
  ACTIVE:           { bg: "var(--color-ok-soft)",    fg: "#047857", border: "var(--color-ok)" },
  PAUSED:           { bg: "var(--color-surface-sunken)", fg: "var(--color-ink-muted)", border: "var(--color-line)" },
  CAMPAIGN_PAUSED:  { bg: "var(--color-warn-soft)", fg: "#92400e", border: "var(--color-warn)" },
  ADSET_PAUSED:     { bg: "var(--color-warn-soft)", fg: "#92400e", border: "var(--color-warn)" },
  BANNED:           { bg: "var(--color-bad-soft)",  fg: "#b91c1c", border: "var(--color-bad)" },
  BILLING:          { bg: "var(--color-warn-soft)", fg: "#92400e", border: "var(--color-warn)" },
  REVIEW:           { bg: "var(--color-warn-soft)", fg: "#92400e", border: "var(--color-warn)" },
  DEAD:             { bg: "var(--color-bad-soft)",  fg: "#b91c1c", border: "var(--color-bad)" },
  ARCHIVED:         { bg: "var(--color-surface-sunken)", fg: "var(--color-ink-faint)", border: "var(--color-line-soft)" },
  PERSONAL:         { bg: "var(--color-brand-50)",  fg: "var(--color-brand-700)", border: "var(--color-brand-300)" },
} as const;

type StripStatus = keyof typeof STRIP_COLORS;

const STATUSES: StripStatus[] = [
  "ACTIVE", "PAUSED", "CAMPAIGN_PAUSED", "ADSET_PAUSED",
  "BILLING", "REVIEW", "DEAD", "BANNED", "ARCHIVED", "PERSONAL",
];

const FUNNEL_NOTICE = "Funnel data for this cab did not arrive in the last hour. Spend and clicks are still correct; sub / contact / checkout / ftd / rd show only the rows the collector caught.";

const DAYS = 7;
const TODAY = "18 Aug";
const DAY_LABELS = ["12 Aug", "13 Aug", "14 Aug", "15 Aug", "16 Aug", "17 Aug", TODAY];

export function CampaignsView() {
  const [selected, setSelected] = useState<Campaign | null>(null);
  const [showOnlyActive, setShowOnlyActive] = useState(false);

  const visibleRows = showOnlyActive
    ? CAMPAIGN_TIMELINE.filter((r) => r.strips.some((s) => s.status === "ACTIVE"))
    : CAMPAIGN_TIMELINE;

  return (
    <div style={{ padding: "24px 32px 80px" }}>
      {/* Header */}
      <header style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", marginBottom: 20, gap: 16 }}>
        <div>
          <h1 style={{ fontSize: 24, fontWeight: 700, color: "var(--color-ink)", letterSpacing: -0.2 }}>
            Campaigns
          </h1>
          <p style={{ fontSize: 13, color: "var(--color-ink-muted)", marginTop: 4 }}>
            <span className="num">{CAMPAIGN_TIMELINE.length}</span> ad accounts ·{" "}
            <span className="num">{CAMPAIGNS.filter((c) => c.status === "ACTIVE").length}</span> campaigns wanted active ·{" "}
            <span style={{ color: "var(--color-ink-faint)" }}>read from our database</span>
          </p>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <button
            className="toolbar-btn"
            onClick={() => setShowOnlyActive((v) => !v)}
            style={showOnlyActive ? { background: "var(--color-surface-subtle)", color: "var(--color-ink)" } : undefined}
          >
            <Filter size={14} strokeWidth={2} />
            {showOnlyActive ? "Showing active only" : "All"}
          </button>
        </div>
      </header>

      {/* Funnel notice */}
      <div
        style={{
          marginBottom: 20,
          padding: "10px 14px",
          borderRadius: 10,
          background: "var(--color-warn-soft)",
          border: "1px solid #fde68a",
          display: "flex",
          alignItems: "flex-start",
          gap: 10,
        }}
      >
        <AlertTriangle size={16} strokeWidth={2} style={{ color: "#92400e", marginTop: 2, flexShrink: 0 }} />
        <div style={{ fontSize: 12, color: "#7c2d12", lineHeight: 1.5 }}>
          {FUNNEL_NOTICE}
        </div>
      </div>

      {/* Timeline */}
      <div
        style={{
          background: "var(--color-surface)",
          border: "1px solid var(--color-line)",
          borderRadius: 12,
          overflow: "hidden",
        }}
      >
        {/* Day header */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "minmax(240px, 1.4fr) repeat(7, minmax(0, 1fr))",
            background: "var(--color-surface-subtle)",
            borderBottom: "1px solid var(--color-line)",
            fontSize: 11,
            fontWeight: 600,
            color: "var(--color-ink-faint)",
            letterSpacing: 0.4,
            textTransform: "uppercase",
          }}
        >
          <div style={{ padding: "10px 16px" }}>Ad account</div>
          {DAY_LABELS.map((d, i) => (
            <div
              key={d}
              style={{
                padding: "10px 8px",
                textAlign: "center",
                color: d === TODAY ? "var(--color-brand-700)" : "var(--color-ink-faint)",
                fontWeight: d === TODAY ? 700 : 600,
                borderLeft: "1px solid var(--color-line-soft)",
              }}
            >
              {d}
            </div>
          ))}
        </div>

        {/* Rows */}
        {visibleRows.map((row) => (
          <TimelineRow
            key={row.act_id}
            row={row}
            onStripClick={(strip) => {
              const c = CAMPAIGNS.find(
                (c) => c.act_id === row.act_id && strip.status === (c.status as StripStatus) || strip.status === c.effective_status
              );
              if (c) setSelected(c);
              else {
                // Synthesize a minimal Campaign for the side panel
                setSelected({
                  fb_id: `${row.act_id}-${strip.label}`,
                  level: "campaign",
                  act_id: row.act_id,
                  act_name: row.act_name,
                  name: strip.label,
                  status: strip.status === "PERSONAL" ? "PAUSED" : strip.status as any,
                  effective_status: strip.status as any,
                  daily_budget: null,
                  lifetime_budget: null,
                  currency: "USD",
                  checked_at: "2026-08-18T22:14:00Z",
                  owner: "hiu_buyer3",
                  status_source: strip.status === "DEAD" || strip.status === "BANNED" ? "derived" : "live",
                  active_ads: 0,
                  spend: 0,
                  impressions: 0,
                  clicks: 0,
                  link_clicks: 0,
                  reach: null,
                  results: null,
                  result_type: null,
                  results_mixed: false,
                });
              }
            }}
          />
        ))}
      </div>

      {/* Legend */}
      <div
        style={{
          marginTop: 16,
          display: "flex",
          flexWrap: "wrap",
          gap: 12,
          fontSize: 11,
          color: "var(--color-ink-muted)",
        }}
      >
        {STATUSES.map((s) => (
          <div key={s} style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
            <span
              style={{
                width: 12,
                height: 8,
                borderRadius: 2,
                background: STRIP_COLORS[s].bg,
                border: `1px solid ${STRIP_COLORS[s].border}`,
              }}
            />
            <span>{statusLabelForStrip(s)}</span>
          </div>
        ))}
      </div>

      {/* Side panel */}
      <SidePanel
        open={!!selected}
        onClose={() => setSelected(null)}
        title={selected?.name}
        subtitle={
          selected ? (
            <span style={{ fontFamily: "var(--font-mono)", fontSize: 12 }}>
              {selected.act_name} · {selected.fb_id}
            </span>
          ) : null
        }
      >
        {selected && <CampaignDetail c={selected} />}
      </SidePanel>
    </div>
  );
}

function statusLabelForStrip(s: StripStatus) {
  switch (s) {
    case "ACTIVE": return "Active";
    case "PAUSED": return "Paused";
    case "CAMPAIGN_PAUSED":
    case "ADSET_PAUSED": return "Paused by Meta";
    case "BILLING": return "Billing / unsettled";
    case "REVIEW": return "Under review";
    case "DEAD":
    case "BANNED": return "Banned / closed";
    case "ARCHIVED": return "Archived";
    case "PERSONAL": return "Personal — never upload";
  }
}

function TimelineRow({
  row,
  onStripClick,
}: {
  row: typeof CAMPAIGN_TIMELINE[number];
  onStripClick: (s: typeof CAMPAIGN_TIMELINE[number]["strips"][number]) => void;
}) {
  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "minmax(240px, 1.4fr) repeat(7, minmax(0, 1fr))",
        borderBottom: "1px solid var(--color-line-soft)",
        fontSize: 13,
        alignItems: "stretch",
        minHeight: 56,
      }}
    >
      <div style={{ padding: "10px 16px", display: "flex", flexDirection: "column", gap: 4, justifyContent: "center" }}>
        <span style={{ fontWeight: 600, color: "var(--color-ink)" }}>{row.act_name}</span>
        <span className="mono" style={{ fontSize: 11, color: "var(--color-ink-faint)" }}>{row.act_id}</span>
      </div>
      <div
        style={{
          gridColumn: "2 / span 7",
          position: "relative",
          padding: "10px 0",
          background: "var(--color-surface)",
          backgroundImage:
            "linear-gradient(to right, var(--color-line-soft) 1px, transparent 1px)",
          backgroundSize: "calc(100% / 7) 100%",
          display: "flex",
          alignItems: "center",
          gap: 4,
          paddingLeft: 8,
          paddingRight: 8,
        }}
      >
        {row.strips.map((s, i) => {
          const w = ((s.end - s.start + 1) / DAYS) * 100;
          const x = (s.start / DAYS) * 100;
          const colors = STRIP_COLORS[s.status as StripStatus] ?? STRIP_COLORS.PAUSED;
          return (
            <div
              key={i}
              onClick={() => onStripClick(s)}
              style={{
                position: "absolute",
                left: `calc(${x}% + 4px)`,
                width: `calc(${w}% - 8px)`,
                height: 28,
                background: colors.bg,
                border: `1px solid ${colors.border}`,
                borderRadius: 6,
                color: colors.fg,
                fontSize: 11,
                fontWeight: 600,
                padding: "0 8px",
                display: "flex",
                alignItems: "center",
                cursor: "pointer",
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
                transition: "transform 150ms ease, box-shadow 150ms ease",
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.transform = "translateY(-1px)";
                e.currentTarget.style.boxShadow = "0 4px 12px rgba(17,24,39,0.10)";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.transform = "translateY(0)";
                e.currentTarget.style.boxShadow = "none";
              }}
              title={s.label}
            >
              {s.label}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function CampaignDetail({ c }: { c: Campaign }) {
  const fresh = freshnessLevel(c.checked_at);
  const freshColor = fresh === "fresh" ? "#047857" : fresh === "late" ? "#b45309" : fresh === "cold" ? "#b91c1c" : "var(--color-ink-muted)";
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      <Section title="Status">
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <span style={{ fontSize: 12, color: "var(--color-ink-muted)" }}>Wanted:</span>
            <span className="mono" style={{ fontSize: 13, fontWeight: 600 }}>{c.status}</span>
            {c.status === "ACTIVE" ? (
              <StatusPill tone="ok" icon={<Play size={11} strokeWidth={2.5} />}>Active</StatusPill>
            ) : c.status === "PAUSED" ? (
              <StatusPill tone="neutral" icon={<Pause size={11} strokeWidth={2.5} />}>Paused</StatusPill>
            ) : c.status === "ARCHIVED" ? (
              <StatusPill tone="neutral" icon={<Archive size={11} strokeWidth={2.5} />}>Archived</StatusPill>
            ) : (
              <StatusPill tone="neutral">Unknown</StatusPill>
            )}
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <span style={{ fontSize: 12, color: "var(--color-ink-muted)" }}>Delivering:</span>
            <span className="mono" style={{ fontSize: 13, fontWeight: 600 }}>{c.effective_status}</span>
            {c.status !== c.effective_status && (
              <StatusPill tone="warn" size="sm">
                wanted ≠ delivering
              </StatusPill>
            )}
          </div>
          {c.status_source === "derived" && (
            <div
              style={{
                padding: 10,
                borderRadius: 8,
                background: "var(--color-surface-subtle)",
                border: "1px solid var(--color-line-soft)",
                fontSize: 12,
                color: "var(--color-ink-muted)",
                lineHeight: 1.4,
              }}
            >
              <b>Derived from children.</b> The collector did not visit this campaign directly — the status is rolled up from its ad sets.
            </div>
          )}
          {c.status_source === "unknown" && (
            <div
              style={{
                padding: 10,
                borderRadius: 8,
                background: "var(--color-warn-soft)",
                border: "1px solid #fde68a",
                fontSize: 12,
                color: "#7c2d12",
                lineHeight: 1.4,
              }}
            >
              We do not know the current state, so we will not write over it.
            </div>
          )}
        </div>
      </Section>

      <Section title="Owner">
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span className="mono" style={{ fontSize: 13 }}>{c.owner}</span>
          <span style={{ fontSize: 12, color: "var(--color-ink-muted)" }}>
            can pause / resume this campaign
          </span>
        </div>
      </Section>

      <Section title="Budget">
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
          <MoneyField label="Daily budget" value={c.daily_budget} currency={c.currency} />
          <MoneyField label="Lifetime budget" value={c.lifetime_budget} currency={c.currency} />
        </div>
        {c.daily_budget == null && c.level === "adset" && (
          <p style={{ fontSize: 12, color: "var(--color-ink-faint)", marginTop: 6 }}>
            null here means the budget lives on the campaign (CBO) — that is normal at the adset level.
          </p>
        )}
      </Section>

      <Section title="Freshness">
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <Dot tone={fresh === "fresh" ? "ok" : fresh === "late" ? "warn" : "bad"} />
          <span style={{ fontSize: 13 }}>
            checked <span style={{ color: freshColor, fontWeight: 600 }}>{fresh}</span> {whenShort(c.checked_at)}
          </span>
        </div>
      </Section>

      <Section title="In this window">
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
          <Metric label="Spend" value={`$${(c.spend / 100).toFixed(2)}`} />
          <Metric label="Impressions" value={c.impressions.toLocaleString()} />
          <Metric label="Clicks" value={c.clicks.toLocaleString()} />
          <Metric label="Link clicks" value={c.link_clicks.toLocaleString()} />
          <Metric label="Active ads" value={String(c.active_ads)} />
          <Metric
            label="Results"
            value={c.results != null ? c.results.toLocaleString() : "—"}
            sub={c.result_type ?? undefined}
          />
        </div>
      </Section>

      <Section title="Action">
        {c.status === "ARCHIVED" ? (
          <div
            style={{
              padding: 12,
              borderRadius: 8,
              background: "var(--color-surface-sunken)",
              fontSize: 12,
              color: "var(--color-ink-muted)",
              lineHeight: 1.5,
            }}
          >
            <b>ARCHIVED cannot be switched back from the panel.</b> That requires a direct Meta call — outside the panel's permission.
          </div>
        ) : c.status === "PAUSED" ? (
          <button className="toolbar-btn primary">
            <Play size={14} strokeWidth={2.5} />
            Resume campaign
          </button>
        ) : (
          <button
            className="toolbar-btn"
            style={{ background: "var(--color-bad)", color: "#fff", borderColor: "var(--color-bad)" }}
          >
            <Pause size={14} strokeWidth={2.5} />
            Pause campaign
          </button>
        )}
        <p style={{ fontSize: 11, color: "var(--color-ink-faint)", marginTop: 8, lineHeight: 1.5 }}>
          Pause / resume fires one Meta API call per object. The collector writes the new state back to our database within a minute.
        </p>
      </Section>
    </div>
  );
}

function freshnessLevel(iso: string): "fresh" | "late" | "cold" | "unknown" {
  const t = new Date(iso).getTime();
  if (Number.isNaN(t)) return "unknown";
  const age = (Date.now() - t) / 1000;
  if (age < 3600) return "fresh";
  if (age < 86400) return "late";
  return "cold";
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section>
      <h3
        style={{
          fontSize: 11,
          fontWeight: 600,
          color: "var(--color-ink-faint)",
          letterSpacing: 0.4,
          textTransform: "uppercase",
          marginBottom: 8,
        }}
      >
        {title}
      </h3>
      {children}
    </section>
  );
}

function MoneyField({ label, value, currency }: { label: string; value: number | null; currency: string }) {
  return (
    <div>
      <div style={{ fontSize: 11, color: "var(--color-ink-faint)", fontWeight: 500 }}>{label}</div>
      <div className="num" style={{ fontSize: 16, fontWeight: 600, marginTop: 2 }}>
        {value == null ? "—" : `$${(value / 100).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
      </div>
    </div>
  );
}

function Metric({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div>
      <div style={{ fontSize: 11, color: "var(--color-ink-faint)", fontWeight: 500 }}>{label}</div>
      <div className="num" style={{ fontSize: 16, fontWeight: 600, marginTop: 2 }}>{value}</div>
      {sub && <div className="mono" style={{ fontSize: 11, color: "var(--color-ink-faint)", marginTop: 2 }}>{sub}</div>}
    </div>
  );
}
