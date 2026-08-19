"use client";

/** Справка профиля: ФП, БМ, пиксели, биллинг, заметки.
 *  Раньше это был один абзац из join(", ") — данные есть, прочитать нельзя.
 *  Здесь каждая сущность живёт в своём блоке со своим статусом. */
import * as React from "react";
import { AlertTriangle, CreditCard, Info } from "lucide-react";
import { useStore } from "@/lib/store";
import { Chip, Empty } from "./health-bits";

function Block({ title, count, children }: { title: string; count?: number; children: React.ReactNode }) {
  return (
    <section className="flex flex-col gap-1.5">
      <div className="flex items-baseline gap-1.5">
        <span className="microlabel text-2xs text-faint">{title}</span>
        {count != null && <span className="font-mono text-2xs text-ghost">{count}</span>}
      </div>
      {children}
    </section>
  );
}

/** Заметка сборщика → тон. Эмодзи из бэкенда режем: иконка ставится здесь. */
function noteTone(s: string): { tone: "warn" | "bad" | "mute"; Icon: typeof Info } {
  if (/^❌|DISABLED|бан/i.test(s)) return { tone: "bad", Icon: AlertTriangle };
  if (/^⚠️?|^💳/.test(s)) return { tone: "warn", Icon: AlertTriangle };
  return { tone: "mute", Icon: Info };
}
const strip = (s: string) => s.replace(/^[^\p{L}\p{N}]+/u, "").trim();

const TONE_TEXT = { warn: "text-warning", bad: "text-destructive", mute: "text-muted-foreground" } as const;

export function ProfileBrief() {
  const profile = useStore((s) => s.form.profile);
  const snapshot = useStore((s) => s.snapshot);
  const sp = snapshot?.profiles?.[profile];

  const pages = sp?.pages || [];
  const businesses = sp?.businesses || [];
  const billing = sp?.billing_issues || [];
  const notes = sp?.notes || [];

  const pixels: { id: string; name: string }[] = [];
  const seen = new Set<string>();
  (sp?.accounts || []).forEach((a) =>
    (a.pixels || []).forEach((x) => {
      if (!seen.has(x.id)) {
        seen.add(x.id);
        pixels.push({ id: x.id, name: x.name || x.id });
      }
    })
  );

  if (!sp) return <Empty>No snapshot for this profile</Empty>;

  return (
    <div className="flex flex-col gap-4">
      {billing.length > 0 && (
        <div className="flex flex-col gap-1 rounded-lg border border-warning/30 bg-warning-soft px-3 py-2.5">
          {billing.map((b, i) => (
            <div key={i} className="flex items-start gap-2 text-xs text-warning">
              <CreditCard className="mt-0.5 size-3.5 flex-none" />
              <span className="min-w-0">{strip(b)}</span>
            </div>
          ))}
        </div>
      )}

      <Block title="facebook pages" count={pages.length}>
        {pages.length ? (
          <div className="grid gap-1.5 sm:grid-cols-2">
            {pages.map((p, i) => (
              <div key={i} className="flex items-center gap-2 rounded-md border border-border bg-elevated/60 px-2.5 py-1.5">
                <span className="min-w-0 flex-1 truncate text-xs">{p.name}</span>
                {p.published === false && <Chip tone="warn">unpublished</Chip>}
                {p.instagram ? (
                  <Chip tone="ok" title="linked Instagram account">@{p.instagram}</Chip>
                ) : (
                  <Chip tone="warn" title="without Instagram an Instagram ad cannot be built">no IG</Chip>
                )}
              </div>
            ))}
          </div>
        ) : (
          <Empty>no pages</Empty>
        )}
      </Block>

      <Block title="business managers" count={businesses.length}>
        {businesses.length ? (
          <div className="flex flex-wrap gap-1.5">
            {businesses.map((b) => (
              <Chip key={b.id} tone={b.verification === "verified" ? "ok" : "mute"} title={b.id}>
                <span className="truncate">{b.name || b.id}</span>
                {b.verification && b.verification !== "verified" && (
                  <span className="text-2xs text-faint">unverified</span>
                )}
              </Chip>
            ))}
          </div>
        ) : (
          <Empty>no business managers available</Empty>
        )}
      </Block>

      <Block title="pixels" count={pixels.length}>
        {pixels.length ? (
          <div className="flex flex-wrap gap-1.5">
            {pixels.map((p) => (
              <Chip key={p.id} title={p.id}>
                <span className="truncate">{p.name}</span>
                <span className="font-mono text-2xs text-faint">{p.id.slice(-6)}</span>
              </Chip>
            ))}
          </div>
        ) : (
          <Empty>no pixels</Empty>
        )}
      </Block>

      {notes.length > 0 && (
        <Block title="collector notes" count={notes.length}>
          <ul className="flex flex-col gap-1">
            {notes.map((n, i) => {
              const { tone, Icon } = noteTone(n);
              return (
                <li key={i} className={`flex items-start gap-2 text-xs ${TONE_TEXT[tone]}`}>
                  <Icon className="mt-0.5 size-3.5 flex-none opacity-80" />
                  <span className="min-w-0">{strip(n)}</span>
                </li>
              );
            })}
          </ul>
        </Block>
      )}
    </div>
  );
}
