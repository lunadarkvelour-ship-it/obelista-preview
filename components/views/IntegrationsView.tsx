"use client";

import { useState } from "react";
import {
  AlertTriangle,
  CircleDot,
  KeyRound,
  ShieldCheck,
  ShieldAlert,
  Wifi,
  WifiOff,
  Database,
  Webhook,
  KeySquare,
  Plug,
  Sparkles,
  Check,
  X,
  Copy,
  Link2,
  Radar,
} from "lucide-react";
import {
  VENDORS,
  VENDOR_CONN,
  PANEL_BACKEND,
  connCheckLine,
  connState,
  missingToConnect,
  whenShort,
} from "@/lib/mock";
import type { Vendor, ConnStateKind } from "@/lib/types";
import { StatusPill, StatusPillForConnState } from "@/components/StatusPill";

/* ─────────────────────────────────────────────────────────────────────
 * IntegrationsView — honest registry
 *
 * Layout:
 *   1. NoBackendNotice (ОДИН баннер на всю страницу)
 *   2. DataSourceCard (единственный рабочий switch)
 *   3. Sections → VendorCard grid
 *
 * НИКАКИХ input полей. НИКАКИХ fake "Connect" кнопок.
 * Показываем missingToConnect — список всего недостающего.
 * ───────────────────────────────────────────────────────────────────── */

type DataSource = "server" | "snapshot";

const SECTIONS = [
  { key: "trackers", title: "Trackers & CRM", blurb: "Where the funnel comes from. The panel joins them on click id or ad name." },
] as const;

export function IntegrationsView() {
  const [dataSource, setDataSource] = useState<DataSource>("server");

  return (
    <div style={{ padding: "24px 32px 80px", maxWidth: 1200, margin: "0 auto" }}>
      <header style={{ marginBottom: 20 }}>
        <h1 style={{ fontSize: 24, fontWeight: 700, color: "var(--color-ink)", letterSpacing: -0.2 }}>
          Integrations
        </h1>
        <p style={{ fontSize: 13, color: "var(--color-ink-muted)", marginTop: 4 }}>
          What talks to what. The honest registry — what's wired, what isn't, what isn't even built.
        </p>
      </header>

      <NoBackendNotice />

      <DataSourceCard value={dataSource} onChange={setDataSource} />

      {SECTIONS.map((s) => (
        <section key={s.key} style={{ marginTop: 32 }}>
          <div
            style={{
              display: "flex",
              alignItems: "baseline",
              gap: 8,
              marginBottom: 4,
            }}
          >
            <h2 style={{ fontSize: 16, fontWeight: 600, color: "var(--color-ink)" }}>{s.title}</h2>
            <span className="num" style={{ fontSize: 12, color: "var(--color-ink-faint)" }}>
              {VENDORS.filter((v) => v.section === s.key).length} sources
            </span>
          </div>
          <p style={{ fontSize: 13, color: "var(--color-ink-muted)", marginBottom: 16 }}>{s.blurb}</p>

          {s.key === "trackers" && <CustomIntegrationCard />}

          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fill, minmax(340px, 1fr))",
              gap: 12,
            }}
          >
            {VENDORS.filter((v) => v.section === s.key && !v.custom).map((v) => (
              <VendorCard key={v.id} vendor={v} />
            ))}
          </div>
        </section>
      ))}

      <div
        style={{
          marginTop: 40,
          padding: "12px 16px",
          borderRadius: 10,
          border: "1px solid var(--color-line)",
          background: "var(--color-surface)",
          fontSize: 12,
          color: "var(--color-ink-muted)",
          lineHeight: 1.5,
        }}
      >
        This page is honest. The buttons would lie — there is no backend wired yet, so a "Connect" button would just be a dimmed input. The list above is the real state of things.
      </div>
    </div>
  );
}

/* ── Sub-components ─────────────────────────────────────────────── */

function NoBackendNotice() {
  return (
    <div
      role="status"
      style={{
        marginBottom: 20,
        padding: "16px 20px",
        borderRadius: 12,
        background: "var(--color-warn-soft)",
        border: "1px solid #fde68a",
        display: "flex",
        alignItems: "flex-start",
        gap: 12,
      }}
    >
      <div
        style={{
          width: 32,
          height: 32,
          borderRadius: 8,
          background: "#fde68a",
          color: "#7c2d12",
          display: "inline-flex",
          alignItems: "center",
          justifyContent: "center",
          flexShrink: 0,
        }}
      >
        <AlertTriangle size={18} strokeWidth={2} />
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 14, fontWeight: 600, color: "#7c2d12" }}>
          Nothing can be connected from this page yet
        </div>
        <div style={{ fontSize: 13, color: "#7c2d12", marginTop: 4, lineHeight: 1.5 }}>
          The panel has nowhere to store a key and nothing that goes out to check a connection.{" "}
          The Facebook OAuth flow and the antidetect scan live in their own places — a Connect button here would be a dimmed input, not a working action.
        </div>
      </div>
    </div>
  );
}

function DataSourceCard({ value, onChange }: { value: DataSource; onChange: (v: DataSource) => void }) {
  return (
    <div
      style={{
        background: "var(--color-surface)",
        border: "1px solid var(--color-line)",
        borderRadius: 12,
        padding: 20,
        marginBottom: 24,
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 12 }}>
        <div
          style={{
            width: 36,
            height: 36,
            borderRadius: 8,
            background: "var(--color-brand-100)",
            color: "var(--color-brand-700)",
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <Database size={18} strokeWidth={2} />
        </div>
        <div>
          <div style={{ fontSize: 14, fontWeight: 600, color: "var(--color-ink)" }}>
            Profile data source
          </div>
          <div style={{ fontSize: 12, color: "var(--color-ink-muted)" }}>
            Where the panel reads your ad accounts from. This is the only switch that works today.
          </div>
        </div>
      </div>
      <div className="seg" style={{ width: "fit-content" }}>
        <button className={value === "server" ? "active" : ""} onClick={() => onChange("server")}>
          <Link2 size={12} strokeWidth={2} style={{ marginRight: 4 }} />
          Server / OAuth
        </button>
        <button className={value === "snapshot" ? "active" : ""} onClick={() => onChange("snapshot")}>
          <Radar size={12} strokeWidth={2} style={{ marginRight: 4 }} />
          Snapshot
        </button>
      </div>
      <p style={{ fontSize: 12, color: "var(--color-ink-muted)", marginTop: 12, lineHeight: 1.5 }}>
        <b style={{ color: "var(--color-ink)" }}>Server / OAuth</b> reads accounts directly from Meta via the ad account token.{" "}
        <b style={{ color: "var(--color-ink)" }}>Snapshot</b> reads from a file the local antidetect host wrote — useful when the Meta API is rate-limited or the ad account is not yet OAuth-bound. The two are not mutually exclusive; accounts visible from one but not the other are still shown.
      </p>
    </div>
  );
}

function CustomIntegrationCard() {
  return (
    <div
      style={{
        background: "var(--color-surface)",
        border: "1px solid var(--color-line)",
        borderRadius: 12,
        padding: 20,
        marginBottom: 12,
        position: "relative",
      }}
    >
      <div
        style={{
          position: "absolute",
          top: 16,
          right: 16,
        }}
      >
        <StatusPill tone="warn" icon={<AlertTriangle size={11} strokeWidth={2.5} />}>
          backend not wired
        </StatusPill>
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 10 }}>
        <div
          style={{
            width: 40,
            height: 40,
            borderRadius: 8,
            background: "var(--color-surface-sunken)",
            color: "var(--color-ink-muted)",
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            fontSize: 16,
            fontWeight: 700,
          }}
        >
          ?
        </div>
        <div>
          <div style={{ fontSize: 14, fontWeight: 600, color: "var(--color-ink)" }}>Your own tracker</div>
          <div style={{ fontSize: 12, color: "var(--color-ink-muted)" }}>
            Send postbacks to your own endpoint. The panel appends the standard ftd/rd query string.
          </div>
        </div>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginTop: 14, opacity: 0.55 }}>
        <div>
          <label style={{ fontSize: 11, color: "var(--color-ink-muted)", fontWeight: 500, display: "block", marginBottom: 4 }}>
            Endpoint URL
          </label>
          <input
            disabled
            placeholder="https://your-endpoint/postback?subid={subid}&ftd=1"
            style={{
              width: "100%",
              height: 32,
              padding: "0 10px",
              borderRadius: 6,
              border: "1px solid var(--color-line)",
              background: "var(--color-surface-subtle)",
              fontSize: 12,
              color: "var(--color-ink-muted)",
              fontFamily: "var(--font-mono)",
            }}
          />
        </div>
        <div>
          <label style={{ fontSize: 11, color: "var(--color-ink-muted)", fontWeight: 500, display: "block", marginBottom: 4 }}>
            Shared secret
          </label>
          <input
            disabled
            placeholder="optional — appended as ?secret=…"
            style={{
              width: "100%",
              height: 32,
              padding: "0 10px",
              borderRadius: 6,
              border: "1px solid var(--color-line)",
              background: "var(--color-surface-subtle)",
              fontSize: 12,
              color: "var(--color-ink-muted)",
            }}
          />
        </div>
      </div>
      <p style={{ fontSize: 12, color: "var(--color-ink-faint)", marginTop: 10, lineHeight: 1.5 }}>
        Input is here to make the shape clear. The button is missing because the panel has nowhere to store the value yet — once PANEL_BACKEND.store is true, the same fields become a working form.
      </p>
    </div>
  );
}

function VendorCard({ vendor }: { vendor: Vendor }) {
  const ctx = VENDOR_CONN[vendor.id] ?? { configured: false };
  const state = connState(ctx);
  const line = connCheckLine(ctx);
  const missing = missingToConnect(vendor, PANEL_BACKEND);
  return (
    <div
      style={{
        background: "var(--color-surface)",
        border: "1px solid var(--color-line)",
        borderRadius: 12,
        padding: 18,
        position: "relative",
      }}
    >
      {/* Header */}
      <div style={{ display: "flex", alignItems: "flex-start", gap: 12, marginBottom: 12 }}>
        <div
          style={{
            width: 40,
            height: 40,
            borderRadius: 8,
            background: "var(--color-surface-sunken)",
            color: "var(--color-ink-muted)",
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            fontSize: 13,
            fontWeight: 700,
            flexShrink: 0,
          }}
        >
          {vendor.mark || vendor.name.slice(0, 2).toUpperCase()}
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <span style={{ fontSize: 14, fontWeight: 600, color: "var(--color-ink)" }}>
              {vendor.name}
            </span>
            <SupportPill support={vendor.support} />
          </div>
          <div style={{ fontSize: 12, color: "var(--color-ink-muted)", marginTop: 2, lineHeight: 1.4 }}>
            {vendor.summary}
          </div>
        </div>
      </div>

      {/* Conn state */}
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
        <StatusPillForConnState state={state} />
        <span style={{ fontSize: 12, color: "var(--color-ink-muted)" }}>{line}</span>
      </div>

      {/* Fields (preview, never inputs) */}
      {vendor.fields.length > 0 && !vendor.issuesKey && (
        <div
          style={{
            marginTop: 12,
            padding: "10px 12px",
            borderRadius: 8,
            border: "1px dashed var(--color-line)",
            background: "var(--color-surface-subtle)",
          }}
        >
          <div
            style={{
              fontSize: 10,
              fontWeight: 600,
              color: "var(--color-ink-faint)",
              textTransform: "uppercase",
              letterSpacing: 0.4,
              marginBottom: 6,
            }}
          >
            Fields the engine expects
          </div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
            {vendor.fields.map((f) => (
              <span
                key={f.key}
                className="mono"
                style={{
                  fontSize: 11,
                  padding: "2px 6px",
                  borderRadius: 4,
                  background: "var(--color-surface)",
                  border: "1px solid var(--color-line-soft)",
                  color: "var(--color-ink-muted)",
                }}
                title={f.hint}
              >
                {f.key} {f.required ? "" : "(opt)"}
              </span>
            ))}
          </div>
          {vendor.fieldsNote && (
            <p style={{ fontSize: 11, color: "var(--color-ink-faint)", marginTop: 6, lineHeight: 1.4 }}>
              {vendor.fieldsNote}
            </p>
          )}
        </div>
      )}

      {/* Gives */}
      {vendor.gives && vendor.gives.length > 0 && (
        <div style={{ marginTop: 12 }}>
          <div
            style={{
              fontSize: 10,
              fontWeight: 600,
              color: "var(--color-ink-faint)",
              textTransform: "uppercase",
              letterSpacing: 0.4,
              marginBottom: 6,
            }}
          >
            Funnel this source feeds
          </div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
            {vendor.gives.map((g) => (
              <StatusPill key={g} tone="brand" size="sm">
                {g}
              </StatusPill>
            ))}
          </div>
        </div>
      )}

      {/* Missing to connect */}
      {missing.length > 0 && (
        <div
          style={{
            marginTop: 12,
            padding: 12,
            borderRadius: 8,
            background: state === "connected" ? "transparent" : "var(--color-surface-subtle)",
            border: state === "connected" ? "1px dashed var(--color-line)" : "1px solid var(--color-line-soft)",
          }}
        >
          <div
            style={{
              fontSize: 10,
              fontWeight: 600,
              color: "var(--color-ink-faint)",
              textTransform: "uppercase",
              letterSpacing: 0.4,
              marginBottom: 8,
            }}
          >
            {state === "connected" ? "Notes" : "What's missing to connect"}
          </div>
          <ul style={{ listStyle: "none", padding: 0, margin: 0, display: "flex", flexDirection: "column", gap: 6 }}>
            {missing.map((m, i) => (
              <li
                key={i}
                style={{ display: "flex", alignItems: "flex-start", gap: 8, fontSize: 12, color: "var(--color-ink)", lineHeight: 1.4 }}
              >
                <span style={{ color: "var(--color-ink-faint)", marginTop: 2 }}>•</span>
                <span>{m}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

function SupportPill({ support }: { support: Vendor["support"] }) {
  switch (support) {
    case "shipped":
      return (
        <StatusPill tone="ok" size="sm">
          shipped
        </StatusPill>
      );
    case "written":
      return (
        <StatusPill tone="warn" size="sm">
          written, not merged
        </StatusPill>
      );
    case "none":
      return (
        <StatusPill tone="neutral" size="sm">
          not built
        </StatusPill>
      );
  }
}
