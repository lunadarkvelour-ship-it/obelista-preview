"use client";

/** Общие примитивы здоровья кабов: статус, метрика, чип, пустое место.
 *  Заведены отдельно, чтобы AccountHealth / AccountPicker / ProfileBrief
 *  показывали статус ОДИНАКОВО — раньше каждый рисовал свой смайлик. */
import * as React from "react";
import { Ban, Check, CreditCard, HelpCircle, Pause } from "lucide-react";
import { cn } from "@/lib/utils";
import { statusLabel, type StatusLabel } from "@/lib/account-status";
import type { MembersByStatus } from "@/lib/groups";

type Tone = "ok" | "warn" | "bad" | "mute";

const TONE: Record<Tone, { text: string; bg: string; ring: string; bar: string }> = {
  ok: { text: "text-success", bg: "bg-success-soft", ring: "border-success/30", bar: "bg-success" },
  warn: { text: "text-warning", bg: "bg-warning-soft", ring: "border-warning/30", bar: "bg-warning" },
  bad: { text: "text-destructive", bg: "bg-destructive-soft", ring: "border-destructive/30", bar: "bg-destructive" },
  mute: { text: "text-muted-foreground", bg: "bg-subtle/50", ring: "border-border", bar: "bg-muted-foreground" },
};

/** Статус каба → тон + подпись + иконка.
 *
 *  САМА КЛАССИФИКАЦИЯ живёт теперь в `lib/account-status.ts` — её спрашивает не
 *  только разметка, но и сборка спеки залива (`groups.ts`), а тащить туда
 *  клиентский компонент с иконками нельзя. Здесь остаётся только вид: тон и
 *  иконка на готовую подпись. Имя и сигнатура функции НЕ менялись — на неё есть
 *  внешние импорты (`lib/business-rows.ts`).
 *
 *  Держать здесь второй `switch` по статусам запрещено: разойдясь с lib, он даст
 *  ровно то, за что уже платили — шапка группы считает каб забаненным, а точка
 *  под ней красит его биллингом. */
const TONE_BY_LABEL: Record<StatusLabel, { tone: Tone; Icon: typeof Check }> = {
  active: { tone: "ok", Icon: Check },
  disabled: { tone: "bad", Icon: Ban },
  billing: { tone: "warn", Icon: CreditCard },
  review: { tone: "warn", Icon: Pause },
  unknown: { tone: "mute", Icon: HelpCircle },
};

export function statusMeta(status?: string): { tone: Tone; label: string; Icon: typeof Check } {
  const label = statusLabel(status);
  const { tone, Icon } = TONE_BY_LABEL[label];
  /* Неопознанный статус показываем КАК ЕСТЬ, а не словом «unknown»: увидев
     настоящее значение от Меты, человек хотя бы загуглит его. */
  return { tone, Icon, label: label === "unknown" && status ? status.toLowerCase() : label };
}

export function StatusPill({ status, className }: { status?: string; className?: string }) {
  const { tone, label, Icon } = statusMeta(status);
  const t = TONE[tone];
  return (
    <span
      className={cn(
        "inline-flex flex-none items-center gap-1 rounded-md border px-1.5 py-0.5 text-2xs font-medium tracking-wide",
        t.bg, t.ring, t.text, className
      )}
    >
      <Icon className="size-3" strokeWidth={2.5} />
      {label}
    </span>
  );
}

/** Точка статуса — для плотных списков, где пилюля не влезает.
 *  Только заливка, без обводки: inset-кольцо съедало почти весь кружок и цвет
 *  переставал читаться. Размер 10px — минимум, который виден на телефоне. */
export function StatusDot({ status, className }: { status?: string; className?: string }) {
  const { tone, label } = statusMeta(status);
  return (
    <span
      title={label}
      aria-label={label}
      className={cn("size-2.5 flex-none rounded-full", TONE[tone].bar, className)}
    />
  );
}

/** Метрика: подпись сверху мелким, значение снизу — читается колонкой, а не строкой через «·». */
export function Metric({ label, value, tone = "mute", mono }: {
  label: string; value: React.ReactNode; tone?: Tone; mono?: boolean;
}) {
  return (
    <div className="min-w-0">
      <div className="microlabel text-2xs text-faint">{label}</div>
      <div className={cn("truncate text-xs", mono && "font-mono", tone === "mute" ? "text-foreground" : TONE[tone].text)}>
        {value}
      </div>
    </div>
  );
}

export function Chip({ children, tone = "mute", title }: { children: React.ReactNode; tone?: Tone; title?: string }) {
  const t = TONE[tone];
  return (
    <span title={title} className={cn("inline-flex max-w-full items-center gap-1 truncate rounded-md border px-1.5 py-0.5 text-xs", t.bg, t.ring, t.text)}>
      {children}
    </span>
  );
}

/** Три корзины `membersByStatus`, которые НЕ держат залив: `review`, `unclear`,
 *  `missing`. Текст, тон и подсказка — в одном месте, чтобы три листа (Upload,
 *  Preview, Accounts), где эти корзины показываются, не разъезжались в
 *  формулировках так же, как когда-то разъехались две классификации статуса. */
const ATTENTION: Record<
  "review" | "unclear" | "missing",
  { tone: Tone; label: (n: number) => string; hint: string }
> = {
  review: {
    tone: "warn",
    label: (n) => `${n} on Meta review`,
    hint: "Meta is checking these ad accounts itself; the outcome is unknown yet — upload is not blocked.",
  },
  unclear: {
    tone: "mute",
    label: (n) => `${n} status unclear`,
    hint: "The ad account is in the snapshot, but its status is not one the panel recognizes — Meta adds new values without notice.",
  },
  missing: {
    tone: "mute",
    label: (n) => `${n} not in snapshot`,
    hint: "The ad account is not present in the latest snapshot. The data may simply be stale, not necessarily a problem.",
  },
};

/** Бейджи «к сведению, не ошибка» — то, что несут корзины `review`/`unclear`/
 *  `missing` из `lib/groups.ts:membersByStatus`, но нигде не показывали: панель
 *  их считала и хранила только в тестах, а человек на экране видел лишь
 *  «missing: …» из `missingOf` (то, что реально держит залив).
 *
 *  Тон намеренно `warn`/`mute`, НИКОГДА `bad`: смешать их со списком того, что
 *  держит залив, значит соврать про степень проблемы. Пустая корзина бейджа не
 *  получает — три чипа «0» на каждой чистой группе были бы шумом, на который
 *  человек быстро научится не смотреть вместе с настоящим предупреждением
 *  рядом. */
export function AttentionChips({ st, className }: { st: MembersByStatus; className?: string }) {
  const keys = (["review", "unclear", "missing"] as const).filter((k) => st[k].length);
  if (!keys.length) return null;
  return (
    <div className={cn("flex flex-wrap items-center gap-1", className)}>
      {keys.map((k) => {
        const a = ATTENTION[k];
        return (
          <Chip key={k} tone={a.tone} title={a.hint}>
            {a.label(st[k].length)}
          </Chip>
        );
      })}
    </div>
  );
}

export function Empty({ children }: { children: React.ReactNode }) {
  return <span className="text-xs text-ghost">{children}</span>;
}

/** Полоса «сколько накопилось до порога биллинга». Число рядом всё равно есть —
 *  полоса нужна, чтобы взглядом ловить «вот-вот спишется», не читая цифры. */
export function BillingBar({ balance, limit }: { balance: number; limit: number }) {
  const pct = Math.min(100, Math.max(0, (balance / limit) * 100));
  const tone: Tone = pct >= 85 ? "warn" : "ok";
  return (
    <div className="h-1 w-full overflow-hidden rounded-full bg-subtle">
      <div className={cn("h-full rounded-full transition-[width] duration-300", TONE[tone].bar)} style={{ width: `${pct}%` }} />
    </div>
  );
}
