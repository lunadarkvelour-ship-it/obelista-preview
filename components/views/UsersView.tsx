"use client";

import { useState } from "react";
import {
  User as UserIcon,
  Mail,
  Calendar,
  Globe,
  Bell,
  CreditCard,
  CheckCircle2,
  CircleDot,
  Tag,
  Database,
  KeyRound,
  Settings,
  Copy,
  Check,
  X,
  Info,
} from "lucide-react";
import { connState, connCheckLine, VENDOR_CONN, PANEL_BACKEND, whenShort } from "@/lib/mock";
import { StatusPill, StatusPillForConnState, Dot } from "@/components/StatusPill";

/* ─────────────────────────────────────────────────────────────────────
 * UsersView — profile (current operator) + their integrations
 *
 * Production layout: avatar + admin badge + session expiry, then
 * "Integrations" section (per-vendor status dots), "About you"
 * (form with draft notice), "Elsewhere" doors. Kept simple — the
 * user said this view is fine, only minor polish.
 * ───────────────────────────────────────────────────────────────────── */

const FIELDS = [
  { key: "name",     label: "Name",     value: "Dawood Bloss", required: true },
  { key: "email",    label: "Email",    value: "dawood@obelista.com", required: true },
  { key: "tg",       label: "Telegram", value: "@dawood", required: false },
  { key: "ws",       label: "WhatsApp", value: "", required: false },
] as const;

const DATA_SOURCES = [
  { key: "server",   label: "Server / OAuth" },
  { key: "snapshot", label: "Snapshot" },
] as const;

const DOORS = [
  { key: "billing",    label: "Billing",     href: "/billing",    built: true },
  { key: "settings",   label: "Settings",    href: "/settings",   built: false },
  { key: "invites",    label: "Team invites", href: "/users",      built: false },
] as const;

export function UsersView() {
  const [dataSource, setDataSource] = useState<typeof DATA_SOURCES[number]["key"]>("server");
  const [draft, setDraft] = useState<Record<string, string>>(
    Object.fromEntries(FIELDS.map((f) => [f.key, f.value]))
  );

  const connectedVendors = Object.values(VENDOR_CONN).filter((c) => c.configured).length;
  const totalVendors = Object.values(VENDOR_CONN).length;

  return (
    <div style={{ padding: "24px 32px 80px", maxWidth: 900, margin: "0 auto" }}>
      {/* Header */}
      <header style={{ display: "flex", alignItems: "center", gap: 16, marginBottom: 24 }}>
        <div
          style={{
            width: 64,
            height: 64,
            borderRadius: 16,
            background: "linear-gradient(135deg, var(--color-brand-500), var(--color-brand-700))",
            color: "#fff",
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            fontSize: 24,
            fontWeight: 700,
            flexShrink: 0,
          }}
        >
          DB
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
            <h1 style={{ fontSize: 22, fontWeight: 700, color: "var(--color-ink)", letterSpacing: -0.2 }}>
              {draft.name || "Unnamed"}
            </h1>
            <StatusPill tone="brand" size="sm" icon={<Tag size={11} strokeWidth={2.5} />}>
              admin
            </StatusPill>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 12, marginTop: 4, fontSize: 12, color: "var(--color-ink-muted)" }}>
            <span style={{ display: "inline-flex", alignItems: "center", gap: 4 }}>
              <Mail size={12} strokeWidth={2} />
              {draft.email || "—"}
            </span>
            <span style={{ display: "inline-flex", alignItems: "center", gap: 4 }}>
              <Calendar size={12} strokeWidth={2} />
              signed in 18 Aug, 14:21
            </span>
            <span style={{ display: "inline-flex", alignItems: "center", gap: 4 }}>
              <Globe size={12} strokeWidth={2} />
              Europe/Berlin
            </span>
          </div>
        </div>
      </header>

      {/* Integrations — same ConnStateKind model */}
      <Section
        title="Integrations"
        right={
          <span style={{ fontSize: 12, color: "var(--color-ink-muted)" }}>
            <span className="num">{connectedVendors}</span> of <span className="num">{totalVendors}</span> wired
          </span>
        }
      >
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
          {Object.entries(VENDOR_CONN).map(([id, ctx]) => {
            const state = connState(ctx);
            return (
              <div
                key={id}
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  padding: "10px 12px",
                  borderRadius: 8,
                  border: "1px solid var(--color-line-soft)",
                  background: "var(--color-surface)",
                }}
              >
                <div style={{ minWidth: 0 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                    <span className="mono" style={{ fontSize: 12, fontWeight: 600 }}>{id}</span>
                    <StatusPillForConnState state={state} />
                  </div>
                  <div style={{ fontSize: 11, color: "var(--color-ink-muted)", marginTop: 2, lineHeight: 1.4 }}>
                    {connCheckLine(ctx)}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </Section>

      {/* Profile data source */}
      <Section title="Profile data source">
        <div className="seg" style={{ width: "fit-content" }}>
          {DATA_SOURCES.map((s) => (
            <button key={s.key} className={dataSource === s.key ? "active" : ""} onClick={() => setDataSource(s.key)}>
              {s.label}
            </button>
          ))}
        </div>
        <p style={{ fontSize: 12, color: "var(--color-ink-muted)", marginTop: 8, lineHeight: 1.5 }}>
          Where the panel reads your ad accounts from. Change it in the top bar.
        </p>
      </Section>

      {/* About you */}
      <Section
        title="About you"
        right={
          <span style={{ fontSize: 11, color: "var(--color-ink-faint)" }}>
            {Object.values(draft).filter((v) => v.trim()).length} of {FIELDS.length} filled
          </span>
        }
      >
        <div
          style={{
            marginBottom: 12,
            padding: "8px 12px",
            borderRadius: 8,
            background: "var(--color-warn-soft)",
            border: "1px solid #fde68a",
            fontSize: 12,
            color: "#7c2d12",
            display: "flex",
            alignItems: "center",
            gap: 8,
          }}
        >
          <Info size={14} strokeWidth={2} />
          Kept in this browser. Save draft before navigating away.
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
          {FIELDS.map((f) => (
            <div key={f.key}>
              <label style={{ fontSize: 11, fontWeight: 600, color: "var(--color-ink-faint)", display: "block", marginBottom: 4, letterSpacing: 0.3 }}>
                {f.label}
                {f.required && <span style={{ color: "var(--color-bad)" }}> *</span>}
              </label>
              <input
                value={draft[f.key]}
                onChange={(e) => setDraft((d) => ({ ...d, [f.key]: e.target.value }))}
                style={{
                  width: "100%",
                  height: 36,
                  padding: "0 12px",
                  borderRadius: 8,
                  border: "1px solid var(--color-line)",
                  background: "var(--color-surface)",
                  color: "var(--color-ink)",
                  fontSize: 14,
                  outline: "none",
                }}
              />
            </div>
          ))}
        </div>
        <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
          <button className="toolbar-btn primary">Save draft</button>
          <button
            className="toolbar-btn"
            onClick={() => setDraft(Object.fromEntries(FIELDS.map((f) => [f.key, f.value])))}
          >
            Reset
          </button>
        </div>
      </Section>

      {/* Elsewhere doors */}
      <Section title="Elsewhere">
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12 }}>
          {DOORS.map((d) =>
            d.built ? (
              <a
                key={d.key}
                href={d.href}
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  padding: 16,
                  borderRadius: 10,
                  border: "1px solid var(--color-line)",
                  background: "var(--color-surface)",
                  textDecoration: "none",
                  color: "var(--color-ink)",
                  transition: "background-color 200ms ease, border-color 200ms ease",
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = "var(--color-surface-subtle)";
                  e.currentTarget.style.borderColor = "var(--color-ink-faint)";
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = "var(--color-surface)";
                  e.currentTarget.style.borderColor = "var(--color-line)";
                }}
              >
                <span style={{ fontSize: 13, fontWeight: 600 }}>{d.label}</span>
                <span style={{ fontSize: 11, color: "var(--color-ink-muted)" }}>→</span>
              </a>
            ) : (
              <div
                key={d.key}
                style={{
                  padding: 16,
                  borderRadius: 10,
                  border: "1px dashed var(--color-line)",
                  background: "var(--color-surface-subtle)",
                  color: "var(--color-ink-faint)",
                }}
              >
                <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 4 }}>{d.label}</div>
                <div style={{ fontSize: 11 }}>not built yet</div>
              </div>
            )
          )}
        </div>
      </Section>
    </div>
  );
}

function Section({
  title,
  right,
  children,
}: {
  title: string;
  right?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section style={{ marginBottom: 28 }}>
      <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", marginBottom: 10 }}>
        <h2 style={{ fontSize: 13, fontWeight: 600, color: "var(--color-ink)", letterSpacing: 0.2 }}>
          {title}
        </h2>
        {right}
      </div>
      {children}
    </section>
  );
}
