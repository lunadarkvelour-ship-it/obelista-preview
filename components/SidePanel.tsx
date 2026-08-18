"use client";

import { X } from "lucide-react";
import { useEffect, useRef } from "react";

/* ─────────────────────────────────────────────────────────────────────
 * SidePanel — slide-in 480px справа.
 * Идея из Behance Rentier: детали не в модалке и не на отдельной
 * странице — открываются сбоку, основной контент сжимается но
 * остаётся видимым. Это даёт "compare two objects" workflow: открыл
 * каб A, посмотрел, открыл каб B, сравнил.
 *
 * Закрытие: Esc, клик по backdrop, кнопка X. Блокирует scroll основной
 * страницы. Содержимое скроллится независимо.
 * ───────────────────────────────────────────────────────────────────── */

export interface SidePanelProps {
  open: boolean;
  onClose: () => void;
  title?: React.ReactNode;
  subtitle?: React.ReactNode;
  children: React.ReactNode;
  width?: number;
  side?: "right" | "left";
}

export function SidePanel({
  open,
  onClose,
  title,
  subtitle,
  children,
  width = 480,
  side = "right",
}: SidePanelProps) {
  // Esc to close + body scroll lock
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prevOverflow;
    };
  }, [open, onClose]);

  const panelRef = useRef<HTMLDivElement>(null);

  return (
    <div
      aria-hidden={!open}
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 60,
        pointerEvents: open ? "auto" : "none",
      }}
    >
      {/* Backdrop */}
      <div
        onClick={onClose}
        style={{
          position: "absolute",
          inset: 0,
          background: "rgba(17, 24, 39, 0.32)",
          opacity: open ? 1 : 0,
          transition: "opacity 220ms cubic-bezier(.2,.7,.2,1)",
        }}
      />
      {/* Panel */}
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        style={{
          position: "absolute",
          top: 0,
          bottom: 0,
          [side]: 0,
          width,
          maxWidth: "92vw",
          background: "var(--color-surface)",
          borderLeft: side === "right" ? "1px solid var(--color-line)" : undefined,
          borderRight: side === "left" ? "1px solid var(--color-line)" : undefined,
          boxShadow: "0 0 40px rgba(17, 24, 39, 0.16)",
          transform: open
            ? "translateX(0)"
            : `translateX(${side === "right" ? "100%" : "-100%"})`,
          transition: "transform 280ms cubic-bezier(.2,.7,.2,1)",
          display: "flex",
          flexDirection: "column",
        }}
      >
        {(title || subtitle) && (
          <header
            style={{
              padding: "20px 24px 16px",
              borderBottom: "1px solid var(--color-line)",
              display: "flex",
              alignItems: "flex-start",
              gap: 12,
            }}
          >
            <div style={{ flex: 1, minWidth: 0 }}>
              {title && (
                <div
                  style={{
                    fontSize: 18,
                    fontWeight: 700,
                    color: "var(--color-ink)",
                    lineHeight: 1.2,
                    marginBottom: subtitle ? 4 : 0,
                  }}
                >
                  {title}
                </div>
              )}
              {subtitle && (
                <div
                  style={{
                    fontSize: 13,
                    color: "var(--color-ink-muted)",
                    lineHeight: 1.3,
                  }}
                >
                  {subtitle}
                </div>
              )}
            </div>
            <button
              onClick={onClose}
              aria-label="Close panel"
              style={{
                width: 32,
                height: 32,
                borderRadius: 8,
                border: "1px solid var(--color-line)",
                background: "var(--color-surface)",
                color: "var(--color-ink-muted)",
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
                cursor: "pointer",
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
              <X size={16} strokeWidth={2} />
            </button>
          </header>
        )}
        <div
          style={{
            flex: 1,
            overflowY: "auto",
            padding: 24,
          }}
        >
          {children}
        </div>
      </div>
    </div>
  );
}
