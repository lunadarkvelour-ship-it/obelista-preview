"use client";

/* Обновление парка кабинетов — одна иконка на листе, который она обновляет.
 *
 *  Раньше это был чип с текстом в шапке, видимый на всех листах. Он обновляет
 *  ровно один — «Кабинеты»: на аналитике свой конвейер и своя отметка
 *  свежести, и общая надпись заставляла гадать, к чему относится «1 мин».
 *
 *  Текста нет намеренно: возраст данных, источник и список несобравшихся
 *  соцев — это подробности, за которыми тянутся раз в день, а место в строке
 *  фильтров они занимают всегда. Всё это в подсказке; наружу вынесен только
 *  цвет точки, потому что «свежо или нет» читают боковым зрением.
 *
 *  Нажатие ждёт СТОЛЬКО, СКОЛЬКО НУЖНО (`loadSnapshot(force)` → десять минут):
 *  полный круг по соцам идёт минуты и растёт с каждым подключённым. Оборванная
 *  кнопка хуже долгой — она оставляет старые данные и врёт, что это всё.
 */

import * as React from "react";
import { RotateCw } from "lucide-react";
import { useStore } from "@/lib/store";
import { Tip } from "@/components/ui/tooltip";
import { staleSocials } from "@/lib/staleness";
import { cn } from "@/lib/utils";

/** Возраст словами — коротко, это подпись под иконкой в подсказке. */
function ago(ts?: string | null): { text: string; ms: number } {
  const t = ts ? Date.parse(ts) : NaN;
  if (!Number.isFinite(t)) return { text: "no data", ms: Infinity };
  const ms = Date.now() - t;
  const m = Math.max(0, Math.round(ms / 60000));
  if (m < 1) return { text: "just now", ms };
  if (m < 60) return { text: `${m} min ago`, ms };
  const h = Math.floor(m / 60);
  return { text: h < 24 ? `${h} h ago` : `${Math.floor(h / 24)} d ago`, ms };
}

export function RefreshButton({ className }: { className?: string }) {
  const sync = useStore((s) => s.sync);
  const snapshot = useStore((s) => s.snapshot);
  const requestRefresh = useStore((s) => s.requestRefresh);

  // Тикаем раз в секунду, чтобы возраст в подсказке не застывал; запросов
  // тикер не делает — сбором заведует оболочка.
  const [, tick] = React.useReducer((x: number) => x + 1, 0);
  React.useEffect(() => {
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, []);

  const stale = React.useMemo(() => staleSocials(snapshot), [snapshot]);
  const age = ago(snapshot?.generated_at);
  const failed = !!sync.error && !sync.pulling;
  const partial = !failed && stale.length > 0;
  // Полчаса без обновления при пятиминутном опросе — что-то мешает.
  const old = !failed && !partial && age.ms > 30 * 60 * 1000;

  const cov = sync.coverage;
  const собралось = Object.keys(snapshot?.profiles || {}).length;

  const tone = failed
    ? "bg-destructive"
    : sync.pulling
      ? "bg-muted-foreground/50"
      : partial || old
        ? "bg-warning"
        : "bg-success";

  const подсказка = [
    sync.pulling ? "Collecting the accounts again — this takes minutes" : "",
    failed ? `Last attempt failed: ${sync.error}` : "",
    partial ? `Sync failed: ${stale.map((s) => s.profile).join(", ")}` : "",
    cov ? `Profiles with OAuth: ${собралось} of ${cov.connected} (${cov.in_antik} confirmed present)`
        : `Profiles in the snapshot: ${собралось}`,
    `Data: ${age.text}`,
    sync.source ? `Source: ${sync.source}` : "",
    "Refreshes this page only. Runs to the end — the sync takes minutes.",
  ]
    .filter(Boolean)
    .join("\n");

  return (
    <Tip content={подсказка} placement="bottom">
      <button
        type="button"
        onClick={() => requestRefresh()}
        disabled={sync.pulling}
        aria-label="Refresh ad accounts"
        aria-busy={sync.pulling}
        className={cn(
          "focus-ring relative grid size-9 flex-none place-items-center rounded-lg border",
          "border-border bg-background text-muted-foreground transition-colors duration-150",
          "hover:border-border-strong hover:bg-hover hover:text-foreground",
          "disabled:pointer-events-none disabled:opacity-60",
          className,
        )}
      >
        <RotateCw
          className={cn("size-4", sync.pulling && "motion-safe:animate-spin")}
          strokeWidth={1.6}
          aria-hidden
        />
        {/* Точка состояния поверх иконки: цвет — единственное, что читается
            без наведения, и ради него чип в шапке и держали. */}
        <span
          className={cn(
            "absolute right-1 top-1 size-1.5 rounded-full ring-2 ring-background",
            tone,
          )}
          aria-hidden
        />
      </button>
    </Tip>
  );
}
