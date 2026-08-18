"use client";

import {
  CheckCircle2,
  XCircle,
  AlertTriangle,
  CreditCard,
  HelpCircle,
  Clock,
  Eye,
  EyeOff,
  Loader2,
  ShieldAlert,
  KeyRound,
  ShieldCheck,
  Wifi,
  WifiOff,
  Upload,
  UploadCloud,
  Ban,
  CircleDot,
  Sparkles,
  Eye as EyeIcon,
  Hourglass,
  Tag,
} from "lucide-react";
import type { CSSProperties, ReactNode } from "react";

/* ─────────────────────────────────────────────────────────────────────
 * StatusPill — {icon} {text} примитив.
 * Идея из Behance Rentier: pill-бейдж + цветная иконка слева. Иконка
 * несёт тот же смысл, что цвет — но читается с первого взгляда.
 *
 * Три тонa: ok / warn / bad. + neutral для "не знаем / не приехало".
 * Каждый тон — два варианта: soft (фон+бук+иконка) и solid (заливка
 * цветом, белый текст — для sticky-строк и активных фильтров).
 * ───────────────────────────────────────────────────────────────────── */

type Tone = "ok" | "warn" | "bad" | "neutral" | "brand";
type Variant = "soft" | "solid" | "outline";

export interface StatusPillProps {
  tone?: Tone;
  variant?: Variant;
  icon?: ReactNode;
  children: ReactNode;
  size?: "sm" | "md";
  className?: string;
  style?: CSSProperties;
  pulse?: boolean;
}

const SIZES = {
  sm: { h: 20, px: 8, font: 11, gap: 4, iconSize: 11 },
  md: { h: 24, px: 10, font: 12, gap: 5, iconSize: 13 },
} as const;

const TONES: Record<
  Tone,
  { softBg: string; softFg: string; solidBg: string; solidFg: string; outlineBorder: string; outlineFg: string; dot: string }
> = {
  ok: {
    softBg: "var(--color-ok-soft)",
    softFg: "#047857",
    solidBg: "var(--color-ok)",
    solidFg: "#fff",
    outlineBorder: "var(--color-ok)",
    outlineFg: "#047857",
    dot: "var(--color-ok)",
  },
  warn: {
    softBg: "var(--color-warn-soft)",
    softFg: "#92400e",
    solidBg: "var(--color-warn)",
    solidFg: "#fff",
    outlineBorder: "var(--color-warn)",
    outlineFg: "#92400e",
    dot: "var(--color-warn)",
  },
  bad: {
    softBg: "var(--color-bad-soft)",
    softFg: "#b91c1c",
    solidBg: "var(--color-bad)",
    solidFg: "#fff",
    outlineBorder: "var(--color-bad)",
    outlineFg: "#b91c1c",
    dot: "var(--color-bad)",
  },
  neutral: {
    softBg: "var(--color-surface-sunken)",
    softFg: "var(--color-ink-muted)",
    solidBg: "var(--color-ink-muted)",
    solidFg: "#fff",
    outlineBorder: "var(--color-line)",
    outlineFg: "var(--color-ink-muted)",
    dot: "var(--color-ink-faint)",
  },
  brand: {
    softBg: "var(--color-brand-100)",
    softFg: "var(--color-brand-900)",
    solidBg: "var(--color-brand-700)",
    solidFg: "#fff",
    outlineBorder: "var(--color-brand-300)",
    outlineFg: "var(--color-brand-900)",
    dot: "var(--color-brand-700)",
  },
};

export function StatusPill({
  tone = "neutral",
  variant = "soft",
  icon,
  children,
  size = "sm",
  className,
  style,
  pulse = false,
}: StatusPillProps) {
  const t = TONES[tone];
  const s = SIZES[size];

  const palette =
    variant === "solid"
      ? { bg: t.solidBg, fg: t.solidFg, border: t.solidBg }
      : variant === "outline"
      ? { bg: "transparent", fg: t.outlineFg, border: t.outlineBorder }
      : { bg: t.softBg, fg: t.softFg, border: "transparent" };

  return (
    <span
      className={className}
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: s.gap,
        height: s.h,
        padding: `0 ${s.px}px`,
        borderRadius: 999,
        background: palette.bg,
        color: palette.fg,
        border: `1px solid ${palette.border}`,
        fontSize: s.font,
        fontWeight: 600,
        lineHeight: 1,
        whiteSpace: "nowrap",
        letterSpacing: 0.1,
        ...style,
      }}
    >
      {icon ? (
        <span
          style={{
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            width: s.iconSize,
            height: s.iconSize,
            animation: pulse ? "pillPulse 1.4s ease-in-out infinite" : undefined,
          }}
        >
          {icon}
        </span>
      ) : (
        <span
          aria-hidden
          style={{
            width: 6,
            height: 6,
            borderRadius: 999,
            background: t.dot,
            flexShrink: 0,
          }}
        />
      )}
      {children}
      <style>{`@keyframes pillPulse { 0%,100%{opacity:1} 50%{opacity:0.45} }`}</style>
    </span>
  );
}

/* ── Готовые пресеты под доменные состояния ──────────────────────── */

import type { StatusLabel, ConnStateKind, CreativeStatus, MetaStatus, NoUploadReason, VendorState } from "@/lib/types";

export function StatusPillForStatusLabel({ s }: { s: StatusLabel }) {
  switch (s) {
    case "active":
      return (
        <StatusPill tone="ok" icon={<CheckCircle2 size={11} strokeWidth={2.5} />}>
          Active
        </StatusPill>
      );
    case "disabled":
      return (
        <StatusPill tone="bad" icon={<Ban size={11} strokeWidth={2.5} />}>
          Banned
        </StatusPill>
      );
    case "billing":
      return (
        <StatusPill tone="warn" icon={<CreditCard size={11} strokeWidth={2.5} />}>
          Billing
        </StatusPill>
      );
    case "review":
      return (
        <StatusPill tone="warn" icon={<AlertTriangle size={11} strokeWidth={2.5} />}>
          Review
        </StatusPill>
      );
    case "unknown":
      return (
        <StatusPill tone="neutral" icon={<HelpCircle size={11} strokeWidth={2.5} />}>
          Unknown
        </StatusPill>
      );
  }
}

export function StatusPillForNoUpload({ reason }: { reason: NoUploadReason }) {
  switch (reason) {
    case "account-dead":
      return (
        <StatusPill tone="bad" icon={<Ban size={11} strokeWidth={2.5} />}>
          Banned by Meta — an upload here would be refused
        </StatusPill>
      );
    case "owners-unknown":
      return (
        <StatusPill tone="neutral" icon={<HelpCircle size={11} strokeWidth={2.5} />}>
          We do not know yet which profile sees this account
        </StatusPill>
      );
    case "no-live-window":
      return (
        <StatusPill tone="warn" icon={<EyeOff size={11} strokeWidth={2.5} />}>
          Profile has a token but no window in the antidetect
        </StatusPill>
      );
    case "no-connected-profile":
      return (
        <StatusPill tone="warn" icon={<KeyRound size={11} strokeWidth={2.5} />}>
          No profile that sees this account is connected
        </StatusPill>
      );
    case "vendor-gone":
      return (
        <StatusPill tone="bad" icon={<ShieldAlert size={11} strokeWidth={2.5} />}>
          Only visible from profiles of an antidetect we dropped
        </StatusPill>
      );
  }
}

export function StatusPillForConnState({ state }: { state: ConnStateKind }) {
  switch (state) {
    case "not_configured":
      return (
        <StatusPill tone="neutral" icon={<CircleDot size={11} strokeWidth={2.5} />}>
          Not connected
        </StatusPill>
      );
    case "connected":
      return (
        <StatusPill tone="ok" icon={<ShieldCheck size={11} strokeWidth={2.5} />}>
          Connected
        </StatusPill>
      );
    case "unreachable":
      return (
        <StatusPill tone="warn" icon={<WifiOff size={11} strokeWidth={2.5} />}>
          Connected, not responding
        </StatusPill>
      );
  }
}

export function StatusPillForCreative({ status, progress }: { status: CreativeStatus; progress?: number }) {
  switch (status) {
    case "cached":
      return (
        <StatusPill tone="ok" icon={<CheckCircle2 size={11} strokeWidth={2.5} />}>
          cached
        </StatusPill>
      );
    case "new":
      return (
        <StatusPill tone="brand" icon={<Sparkles size={11} strokeWidth={2.5} />}>
          new
        </StatusPill>
      );
    case "pending":
      return (
        <StatusPill tone="warn" icon={<Loader2 size={11} strokeWidth={2.5} />} pulse>
          uploading {progress != null ? `${progress}%` : ""}
        </StatusPill>
      );
    case "rejected":
      return (
        <StatusPill tone="bad" icon={<Ban size={11} strokeWidth={2.5} />}>
          rejected
        </StatusPill>
      );
    case "available_on_cab":
      return (
        <StatusPill tone="neutral" icon={<UploadCloud size={11} strokeWidth={2.5} />}>
          on cab
        </StatusPill>
      );
    case "personal":
      return (
        <StatusPill tone="neutral" icon={<Tag size={11} strokeWidth={2.5} />}>
          personal
        </StatusPill>
      );
  }
}

/* tiny chip, just dot + text */
export function Dot({ tone = "neutral" }: { tone?: Tone }) {
  return (
    <span
      aria-hidden
      style={{
        display: "inline-block",
        width: 6,
        height: 6,
        borderRadius: 999,
        background: TONES[tone].dot,
      }}
    />
  );
}

export { CheckCircle2, XCircle, AlertTriangle, CreditCard, HelpCircle, Clock, Wifi, Upload, Hourglass };
