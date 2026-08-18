"use client";

import { useState, useMemo } from "react";
import {
  Search,
  AlertTriangle,
  CreditCard,
  KeyRound,
  CircleSlash,
  X,
  Building2,
  TrendingUp,
  Coins,
  Check,
  Copy,
  EyeOff,
  Wallet,
  MapPin,
  Calendar,
  ShieldAlert,
  ShieldCheck,
  CheckCircle2,
  CircleDot,
  Info,
} from "lucide-react";
import {
  ACCOUNTS,
  canUpload,
  money,
  noUploadReason,
  num,
  pct,
  statusLabel,
  whenShort,
  PANEL_BACKEND,
} from "@/lib/mock";
import { StatusPill, StatusPillForStatusLabel, StatusPillForNoUpload, Dot } from "@/components/StatusPill";
import { SidePanel } from "@/components/SidePanel";
import type { UnifiedAccount } from "@/lib/types";

/* ─────────────────────────────────────────────────────────────────────
 * AccountsView — production-faithful accounts sheet
 *
 * Layout (5 columns):
 *   1. cab  (act_id, name, BM, personal flag)
 *   2. profile (which social can upload, all owners, noUploadReason)
 *   3. spend (lifetime, today, status_checked_at)
 *   4. billing (funding, balance, daily_limit, daily_limit_note)
 *   5. pixel (id, name, last_fired_time)
 *
 * Interactions:
 *   - Click row → opens SidePanel with full CloudAccount details
 *   - Search across name / act_id / BM / profile names
 *   - Status filter (5 buckets from lib/account-status.ts)
 *   - Personal accounts shown faded (never upload)
 * ───────────────────────────────────────────────────────────────────── */

const STATUS_FILTERS = [
  { key: "all",      label: "All statuses" },
  { key: "active",   label: "Active" },
  { key: "disabled", label: "Banned" },
  { key: "billing",  label: "Billing / unsettled" },
  { key: "review",   label: "Under review" },
  { key: "unknown",  label: "Not collected" },
] as const;

const GEO_TINT: Record<string, string> = {
  DZ: "var(--color-geo-dz)",
  BD: "var(--color-geo-bd)",
  BR: "var(--color-geo-br)",
  OTHER: "var(--color-geo-other)",
};

export function AccountsView() {
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<typeof STATUS_FILTERS[number]["key"]>("all");
  const [selected, setSelected] = useState<UnifiedAccount | null>(null);
  const [copyHint, setCopyHint] = useState<string | null>(null);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return ACCOUNTS.filter((a) => {
      if (statusFilter !== "all" && statusLabel(a.status) !== statusFilter) return false;
      if (!q) return true;
      const owners = a.owners.map((o) => (o.name || o.profile_id).toLowerCase()).join(" ");
      const hay = [a.act_id, a.name, a.bm_name, a.profileLabel, owners].join(" ").toLowerCase();
      return hay.includes(q);
    });
  }, [query, statusFilter]);

  const totalSpend = useMemo(
    () => filtered.reduce((s, a) => s + (a.amount_spent ?? 0), 0),
    [filtered]
  );
  const readyCount = useMemo(() => filtered.filter(canUpload).length, [filtered]);
  const noCardCount = useMemo(
    () => filtered.filter((a) => !a.funding_display_string && !a.personal).length,
    [filtered]
  );

  const copy = async (text: string, label: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopyHint(label);
      setTimeout(() => setCopyHint(null), 1500);
    } catch {
      /* ignore */
    }
  };

  return (
    <div style={{ padding: "24px 32px 80px" }}>
      {/* Header */}
      <header
        style={{
          display: "flex",
          alignItems: "flex-end",
          justifyContent: "space-between",
          marginBottom: 24,
          gap: 16,
        }}
      >
        <div>
          <h1 style={{ fontSize: 24, fontWeight: 700, color: "var(--color-ink)", letterSpacing: -0.2 }}>
            Accounts
          </h1>
          <p style={{ fontSize: 13, color: "var(--color-ink-muted)", marginTop: 4 }}>
            <span className="mono">{filtered.length}</span> of <span className="mono">{ACCOUNTS.length}</span> ad accounts ·{" "}
            <span className="mono">{readyCount}</span> ready to upload ·{" "}
            <span className="mono">{noCardCount}</span> without a card
          </p>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <StatusPill
            tone={readyCount === filtered.length ? "ok" : readyCount === 0 ? "bad" : "warn"}
            icon={readyCount === filtered.length ? <Check size={11} strokeWidth={2.5} /> : <AlertTriangle size={11} strokeWidth={2.5} />}
          >
            {readyCount} / {filtered.length} uploadable
          </StatusPill>
        </div>
      </header>

      {/* Summary bar */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1fr 1fr 1fr",
          gap: 12,
          marginBottom: 20,
        }}
      >
        <SummaryTile
          icon={<TrendingUp size={14} strokeWidth={2} />}
          label="Total spend (lifetime, in window)"
          value={money(totalSpend)}
          sub={`${filtered.length} accounts`}
        />
        <SummaryTile
          icon={<ShieldCheck size={14} strokeWidth={2} />}
          label="Ready to upload"
          value={`${readyCount}`}
          sub={readyCount === filtered.length ? "all green" : `${filtered.length - readyCount} blocked`}
          tone={readyCount === filtered.length ? "ok" : "warn"}
        />
        <SummaryTile
          icon={<Wallet size={14} strokeWidth={2} />}
          label="Without a card"
          value={`${noCardCount}`}
          sub={noCardCount === 0 ? "all paid" : "clicks will be rejected"}
          tone={noCardCount === 0 ? "ok" : "bad"}
        />
      </div>

      {/* Toolbar */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 8,
          marginBottom: 12,
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
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search by name, act_id, BM, profile…"
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
        <div className="seg" role="tablist">
          {STATUS_FILTERS.map((s) => (
            <button
              key={s.key}
              className={statusFilter === s.key ? "active" : ""}
              onClick={() => setStatusFilter(s.key)}
            >
              {s.label}
            </button>
          ))}
        </div>
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
        <div
          role="row"
          style={{
            display: "grid",
            gridTemplateColumns: "minmax(260px, 1.6fr) minmax(240px, 1.4fr) minmax(160px, 0.9fr) minmax(200px, 1.1fr) minmax(200px, 1.1fr)",
            padding: "10px 16px",
            borderBottom: "1px solid var(--color-line)",
            background: "var(--color-surface-subtle)",
            fontSize: 11,
            fontWeight: 600,
            color: "var(--color-ink-faint)",
            letterSpacing: 0.4,
            textTransform: "uppercase",
          }}
        >
          <span>Ad account</span>
          <span>Profile</span>
          <span>Spend</span>
          <span>Billing</span>
          <span>Pixel</span>
        </div>

        {filtered.length === 0 && (
          <div
            style={{
              padding: "48px 24px",
              textAlign: "center",
              color: "var(--color-ink-muted)",
              fontSize: 14,
            }}
          >
            Nothing matches these filters.{" "}
            <button
              onClick={() => {
                setQuery("");
                setStatusFilter("all");
              }}
              style={{
                color: "var(--color-brand-700)",
                background: "transparent",
                border: 0,
                cursor: "pointer",
                padding: 0,
                textDecoration: "underline",
              }}
            >
              Reset filters
            </button>
          </div>
        )}

        {filtered.map((a) => (
          <AccountRow
            key={a.act_id}
            a={a}
            onClick={() => setSelected(a)}
            copy={copy}
          />
        ))}
      </div>

      {/* Copy hint toast */}
      {copyHint && (
        <div
          role="status"
          style={{
            position: "fixed",
            bottom: 24,
            left: "50%",
            transform: "translateX(-50%)",
            padding: "10px 16px",
            borderRadius: 10,
            background: "var(--color-ink)",
            color: "#fff",
            fontSize: 13,
            fontWeight: 500,
            display: "inline-flex",
            alignItems: "center",
            gap: 8,
            boxShadow: "0 8px 24px rgba(17,24,39,0.20)",
            zIndex: 80,
          }}
        >
          <Check size={14} strokeWidth={2.5} /> {copyHint} copied
        </div>
      )}

      {/* Side panel */}
      <SidePanel
        open={!!selected}
        onClose={() => setSelected(null)}
        title={selected?.name}
        subtitle={
          selected ? (
            <span style={{ fontFamily: "var(--font-mono)", fontSize: 12 }}>
              {selected.act_id}
              {selected.bm_name ? ` · ${selected.bm_name}` : ""}
            </span>
          ) : null
        }
      >
        {selected && <AccountDetail a={selected} copy={copy} />}
      </SidePanel>
    </div>
  );
}

/* ── Sub-components ─────────────────────────────────────────────── */

function SummaryTile({
  icon,
  label,
  value,
  sub,
  tone = "neutral",
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  sub?: string;
  tone?: "ok" | "warn" | "bad" | "neutral";
}) {
  return (
    <div
      style={{
        background: "var(--color-surface)",
        border: "1px solid var(--color-line)",
        borderRadius: 12,
        padding: "14px 16px",
        display: "flex",
        alignItems: "center",
        gap: 12,
      }}
    >
      <div
        style={{
          width: 36,
          height: 36,
          borderRadius: 8,
          background:
            tone === "ok"
              ? "var(--color-ok-soft)"
              : tone === "warn"
              ? "var(--color-warn-soft)"
              : tone === "bad"
              ? "var(--color-bad-soft)"
              : "var(--color-surface-sunken)",
          color:
            tone === "ok"
              ? "#047857"
              : tone === "warn"
              ? "#92400e"
              : tone === "bad"
              ? "#b91c1c"
              : "var(--color-ink-muted)",
          display: "inline-flex",
          alignItems: "center",
          justifyContent: "center",
          flexShrink: 0,
        }}
      >
        {icon}
      </div>
      <div style={{ minWidth: 0 }}>
        <div style={{ fontSize: 11, color: "var(--color-ink-faint)", fontWeight: 600, letterSpacing: 0.4, textTransform: "uppercase" }}>
          {label}
        </div>
        <div style={{ display: "flex", alignItems: "baseline", gap: 6, marginTop: 2 }}>
          <span className="num" style={{ fontSize: 20, fontWeight: 700, color: "var(--color-ink)", letterSpacing: -0.2 }}>
            {value}
          </span>
          {sub && (
            <span style={{ fontSize: 12, color: "var(--color-ink-muted)" }}>{sub}</span>
          )}
        </div>
      </div>
    </div>
  );
}

function AccountRow({
  a,
  onClick,
  copy,
}: {
  a: UnifiedAccount;
  onClick: () => void;
  copy: (text: string, label: string) => void;
}) {
  const reason = noUploadReason(a);
  const isDead = statusLabel(a.status) === "disabled";
  return (
    <div
      role="row"
      onClick={onClick}
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === "Enter") onClick();
      }}
      style={{
        display: "grid",
        gridTemplateColumns: "minmax(260px, 1.6fr) minmax(240px, 1.4fr) minmax(160px, 0.9fr) minmax(200px, 1.1fr) minmax(200px, 1.1fr)",
        padding: "14px 16px",
        borderBottom: "1px solid var(--color-line-soft)",
        alignItems: "center",
        fontSize: 13,
        color: "var(--color-ink)",
        cursor: "pointer",
        opacity: a.personal || isDead ? 0.62 : 1,
        transition: "background-color 200ms ease",
      }}
      onMouseEnter={(e) => (e.currentTarget.style.background = "var(--color-surface-subtle)")}
      onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
    >
      {/* Col 1: Ad account */}
      <div style={{ display: "flex", alignItems: "center", gap: 10, minWidth: 0 }}>
        <div
          style={{
            width: 32,
            height: 32,
            borderRadius: 8,
            background: "var(--color-surface-sunken)",
            color: "var(--color-ink-muted)",
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            flexShrink: 0,
          }}
        >
          <Building2 size={16} strokeWidth={2} />
        </div>
        <div style={{ minWidth: 0, display: "flex", flexDirection: "column", gap: 2 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <span style={{ fontWeight: 600, color: "var(--color-ink)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
              {a.name}
            </span>
            {a.personal && (
              <StatusPill tone="neutral" size="sm">
                personal
              </StatusPill>
            )}
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 11, color: "var(--color-ink-muted)" }}>
            <span className="mono">{a.act_id}</span>
            {a.bm_name && (
              <>
                <span>·</span>
                <span>{a.bm_name}</span>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Col 2: Profile + noUploadReason */}
      <div style={{ display: "flex", flexDirection: "column", gap: 4, minWidth: 0 }}>
        {a.profile ? (
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <Dot tone="ok" />
            <span style={{ fontWeight: 500 }}>{a.profileLabel}</span>
            <span style={{ fontSize: 11, color: "var(--color-ink-muted)" }}>
              ({a.owners.length === 1 ? "only owner" : `+${a.owners.length - 1} other`})
            </span>
          </div>
        ) : (
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <Dot tone="bad" />
            <span style={{ color: "var(--color-ink-muted)" }}>no upload path</span>
          </div>
        )}
        {reason && <StatusPillForNoUpload reason={reason} />}
        <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 11, color: "var(--color-ink-muted)" }}>
          <StatusPillForStatusLabel s={statusLabel(a.status)} />
          {a.status_checked_at && (
            <span>checked {whenShort(a.status_checked_at)}</span>
          )}
        </div>
      </div>

      {/* Col 3: Spend */}
      <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
        <span className="num" style={{ fontWeight: 600, fontSize: 14 }}>
          {money(a.amount_spent, a.currency)}
        </span>
        <span style={{ fontSize: 11, color: "var(--color-ink-muted)" }}>
          lifetime
        </span>
      </div>

      {/* Col 4: Billing */}
      <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
        {a.funding_display_string ? (
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <CreditCard size={12} strokeWidth={2} style={{ color: "var(--color-ink-muted)" }} />
            <span style={{ fontSize: 13 }}>{a.funding_display_string}</span>
          </div>
        ) : a.personal ? (
          <span style={{ fontSize: 12, color: "var(--color-ink-faint)" }}>personal</span>
        ) : (
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <Wallet size={12} strokeWidth={2} style={{ color: "var(--color-ink-muted)" }} />
            <span style={{ fontSize: 12, color: "var(--color-ink-muted)" }}>no card</span>
          </div>
        )}
        <span className="num" style={{ fontSize: 12, color: a.balance != null && a.balance < 0 ? "#b91c1c" : "var(--color-ink-muted)" }}>
          balance {money(a.balance, a.currency)}
        </span>
        {a.daily_limit_note && (
          <span style={{ fontSize: 11, color: "var(--color-ink-faint)" }}>{a.daily_limit_note}</span>
        )}
      </div>

      {/* Col 5: Pixel */}
      <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
        {a.pixels.length === 0 ? (
          <span style={{ fontSize: 12, color: "var(--color-ink-faint)" }}>—</span>
        ) : (
          <>
            <span className="mono" style={{ fontSize: 12 }}>
              {a.pixels[0].name || a.pixels[0].id}
            </span>
            {a.pixels.length > 1 && (
              <span style={{ fontSize: 11, color: "var(--color-ink-muted)" }}>
                +{a.pixels.length - 1} more
              </span>
            )}
            {a.pixels[0].last_fired_time && (
              <span style={{ fontSize: 11, color: "var(--color-ink-faint)" }}>
                fired {whenShort(a.pixels[0].last_fired_time)}
              </span>
            )}
          </>
        )}
      </div>
    </div>
  );
}

function AccountDetail({ a, copy }: { a: UnifiedAccount; copy: (text: string, label: string) => void }) {
  const reason = noUploadReason(a);
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
      {/* Top — status + reason */}
      <Section title="Status">
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <span style={{ fontSize: 12, color: "var(--color-ink-muted)" }}>Meta says:</span>
            <span className="mono" style={{ fontSize: 13, fontWeight: 600 }}>{a.status}</span>
            <StatusPillForStatusLabel s={statusLabel(a.status)} />
          </div>
          {a.disable_reason && (
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <span style={{ fontSize: 12, color: "var(--color-ink-muted)" }}>Reason:</span>
              <span style={{ fontSize: 13 }}>{a.disable_reason}</span>
            </div>
          )}
          {reason && (
            <div
              style={{
                marginTop: 4,
                padding: 12,
                borderRadius: 8,
                background: "var(--color-bad-soft)",
                border: "1px solid #fecaca",
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 11, fontWeight: 600, color: "#b91c1c", textTransform: "uppercase", letterSpacing: 0.4, marginBottom: 4 }}>
                <ShieldAlert size={12} strokeWidth={2.5} />
                Why no upload
              </div>
              <div style={{ fontSize: 13, color: "#7f1d1d" }}>
                <StatusPillForNoUpload reason={reason} />
              </div>
            </div>
          )}
          <div style={{ fontSize: 12, color: "var(--color-ink-faint)" }}>
            Status checked {whenShort(a.status_checked_at)} — that's the freshness of the check, not the freshness of the status itself.
          </div>
        </div>
      </Section>

      {/* Owners */}
      <Section title={`Owners (${a.owners.length})`}>
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {a.owners.length === 0 ? (
            <div style={{ fontSize: 13, color: "var(--color-ink-muted)" }}>
              No profile reports seeing this ad account. Connect a Facebook account on the Profiles page — ad accounts it can reach will show up here.
            </div>
          ) : (
            a.owners.map((o, i) => (
              <div
                key={o.profile_id}
                style={{
                  display: "grid",
                  gridTemplateColumns: "20px 1fr auto",
                  gap: 10,
                  alignItems: "center",
                  padding: 10,
                  borderRadius: 8,
                  border: "1px solid var(--color-line-soft)",
                  background: i === 0 ? "var(--color-surface-subtle)" : "transparent",
                }}
              >
                <Dot
                  tone={
                    o.vendor_state === "нет_вендора"
                      ? "bad"
                      : o.oauth && o.in_antidetect
                      ? "ok"
                      : o.oauth
                      ? "warn"
                      : "neutral"
                  }
                />
                <div style={{ minWidth: 0 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                    <span style={{ fontSize: 13, fontWeight: 500 }}>{o.name || o.profile_id}</span>
                    {i === 0 && <StatusPill tone="brand" size="sm">primary</StatusPill>}
                  </div>
                  <div style={{ fontSize: 11, color: "var(--color-ink-muted)", marginTop: 2 }}>
                    oauth: <b style={{ color: o.oauth ? "#047857" : "var(--color-ink-muted)" }}>{o.oauth ? "yes" : "no"}</b>{" "}
                    · window:{" "}
                    <b style={{ color: o.in_antidetect === false ? "#b91c1c" : o.in_antidetect === true ? "#047857" : "var(--color-ink-muted)" }}>
                      {o.in_antidetect === null ? "antidetect never answered" : o.in_antidetect ? "open" : "closed"}
                    </b>
                    {o.vendor_state && o.vendor_state !== "живой" && (
                      <> · <b style={{ color: o.vendor_state === "нет_вендора" ? "#b91c1c" : "var(--color-warn)" }}>{o.vendor_state}</b></>
                    )}
                  </div>
                </div>
                <span className="mono" style={{ fontSize: 11, color: "var(--color-ink-faint)" }}>
                  {o.vendor || "—"}
                </span>
              </div>
            ))
          )}
        </div>
      </Section>

      {/* Money */}
      <Section title="Money">
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
          <MoneyRow label="Balance" value={money(a.balance, a.currency)} tone={a.balance != null && a.balance < 0 ? "bad" : "neutral"} />
          <MoneyRow label="Lifetime spend" value={money(a.amount_spent, a.currency)} />
          <MoneyRow
            label="Spend cap"
            value={a.spend_cap == null ? DASH_NO : money(a.spend_cap, a.currency)}
          />
          <MoneyRow
            label="Daily limit"
            value={
              a.daily_limit != null
                ? money(a.daily_limit, a.currency)
                : a.daily_limit_note ?? DASH_NO
            }
            sub={a.daily_limit_note}
          />
        </div>
      </Section>

      {/* Funding */}
      <Section title="Funding">
        {a.funding_display_string ? (
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <CreditCard size={16} strokeWidth={2} style={{ color: "var(--color-ink-muted)" }} />
            <div>
              <div style={{ fontSize: 13 }}>{a.funding_display_string}</div>
              <div style={{ fontSize: 11, color: "var(--color-ink-faint)" }}>{a.funding_type}</div>
            </div>
          </div>
        ) : (
          <div style={{ fontSize: 13, color: "var(--color-ink-muted)" }}>
            No payment method. Clicks will be rejected by Meta until a card is added on the ad account itself.
          </div>
        )}
      </Section>

      {/* Pixels */}
      <Section title={`Pixels (${a.pixels.length})`}>
        {a.pixels.length === 0 ? (
          <div style={{ fontSize: 13, color: "var(--color-ink-muted)" }}>
            No pixel is bound to this ad account. Set one in the Goal step of the bundle, or pick it per-member in the Cabs step.
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            {a.pixels.map((p) => (
              <div
                key={p.id}
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  padding: "8px 10px",
                  borderRadius: 8,
                  border: "1px solid var(--color-line-soft)",
                  fontSize: 13,
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <span style={{ fontWeight: 500 }}>{p.name || "—"}</span>
                  <span className="mono" style={{ fontSize: 11, color: "var(--color-ink-faint)" }}>{p.id}</span>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  {p.last_fired_time && (
                    <span style={{ fontSize: 11, color: "var(--color-ink-muted)" }}>
                      fired {whenShort(p.last_fired_time)}
                    </span>
                  )}
                  <button
                    onClick={() => copy(p.id, "Pixel id")}
                    style={{
                      width: 24,
                      height: 24,
                      borderRadius: 6,
                      border: "1px solid var(--color-line)",
                      background: "var(--color-surface)",
                      color: "var(--color-ink-muted)",
                      cursor: "pointer",
                      display: "inline-flex",
                      alignItems: "center",
                      justifyContent: "center",
                    }}
                    aria-label="Copy pixel id"
                  >
                    <Copy size={11} strokeWidth={2} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </Section>

      {/* Quick copy */}
      <Section title="Quick copy">
        <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
          <CopyChip onClick={() => copy(a.act_id, "act_id")}>{a.act_id}</CopyChip>
          {a.bm_name && <CopyChip onClick={() => copy(a.bm_name!, "BM name")}>{a.bm_name}</CopyChip>}
          {a.profileLabel && <CopyChip onClick={() => copy(a.profileLabel, "Profile")}>{a.profileLabel}</CopyChip>}
        </div>
      </Section>
    </div>
  );
}

const DASH_NO = "—";

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

function MoneyRow({ label, value, sub, tone = "neutral" }: { label: string; value: string; sub?: string; tone?: "bad" | "neutral" }) {
  return (
    <div>
      <div style={{ fontSize: 11, color: "var(--color-ink-faint)", fontWeight: 500 }}>{label}</div>
      <div className="num" style={{ fontSize: 16, fontWeight: 600, color: tone === "bad" ? "#b91c1c" : "var(--color-ink)", marginTop: 2 }}>
        {value}
      </div>
      {sub && <div style={{ fontSize: 11, color: "var(--color-ink-faint)", marginTop: 2 }}>{sub}</div>}
    </div>
  );
}

function CopyChip({ children, onClick }: { children: React.ReactNode; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="mono"
      style={{
        height: 28,
        padding: "0 10px",
        borderRadius: 8,
        border: "1px solid var(--color-line)",
        background: "var(--color-surface)",
        color: "var(--color-ink-muted)",
        fontSize: 12,
        cursor: "pointer",
        display: "inline-flex",
        alignItems: "center",
        gap: 6,
        transition: "background-color 200ms ease, color 200ms ease",
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.background = "var(--color-surface-subtle)";
        e.currentTarget.style.color = "var(--color-ink)";
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.background = "var(--color-surface)";
        e.currentTarget.style.color = "var(--color-ink-muted)";
      }}
    >
      {children}
    </button>
  );
}
