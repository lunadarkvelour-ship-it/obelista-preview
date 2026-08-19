"use client";

import { guardSession } from "./session";
import type { Snapshot } from "./types";

/** Сколько соцев подключено к приложению и сколько профилей вообще в антике.
 *  Без этой пары лист кабинетов выглядит полным, показывая часть парка. */
export interface Coverage {
  connected: number;
  in_antik: number;
}

const LAST_GOOD_KEY = "zaliv-panel-snapshot";

type ProvenancedSnapshot = Snapshot & {
  source?: string;
  provider?: string;
  snapshot_revision?: string;
  run_id?: string;
};

export interface SnapshotIdentity {
  provider: string;
  revision: string;
}

/** Каноническая identity Snapshot-mode — провайдер + ревизия, не часы. */
export function snapshotIdentity(snapshot: Snapshot | null): SnapshotIdentity | null {
  const value = snapshot as ProvenancedSnapshot | null;
  if (value?.source !== "local_antidetect_scan") return null;
  const provider = String(value.provider || "").trim().toLowerCase();
  const revision = String(value.snapshot_revision || value.run_id || "").trim();
  return provider && revision ? { provider, revision } : null;
}

/** OAuth/composite и другой парк не вытесняют уже выбранный Snapshot base. */
export function shouldApplySnapshot(
  current: Snapshot | null,
  incoming: Snapshot | null,
): boolean {
  if (!incoming) return false;
  const have = snapshotIdentity(current);
  const next = snapshotIdentity(incoming);
  if (have) {
    if (!next || next.provider !== have.provider) return false;
    if (next.revision === have.revision) return false;
    return true;
  } else if (next) {
    return true;
  }
  const currentAt = Date.parse(current?.generated_at || "");
  const incomingAt = Date.parse(incoming.generated_at || "");
  return !(Number.isFinite(currentAt) && Number.isFinite(incomingAt) && incomingAt < currentAt);
}

function sourceLabel(source: string, snapshot: Snapshot): string {
  const id = snapshotIdentity(snapshot);
  return id ? `${source} · ${id.provider} · ${id.revision.slice(0, 8)}` : source;
}

/* Демон отдаёт тот же снапшот, но с пикселями, доложенными из приложения.
   Расширение обходит Ads Manager глазами и видит пиксель только там, где
   успело побывать — отсюда «нет пикселя» на кабах, где он есть. Приложение
   спрашивает Мету и знает точно.

   Спрашиваем демона ПЕРВЫМ и с коротким сроком: если его нет (панель открыта
   не на рабочей машине или он не поднят), молча уходим на прежний путь и
   ничего не ломаем. Список профилей и кабов в обоих случаях один и тот же —
   демон берёт его из того же файла. */
const DAEMON =
  process.env.NEXT_PUBLIC_ANALYTICS_API ?? "http://127.0.0.1:8791";

/* Демон держит собранный снапшот в памяти пять минут: обход всех соцев через
   Мету занимает секунды, и дёргать его на каждый рендер незачем. Но НАЖАТИЕ
   «обновить» — это не рендер, а прямой вопрос «что там сейчас». Раньше кнопка
   получала ту же пятиминутную копию и рапортовала «снапшот обновлён»: каб,
   пошаренный минуту назад, в панели не появлялся, сколько ни жми. `fresh=1`
   идёт мимо кэша. */
async function fromDaemon(
  force: boolean,
): Promise<{ snap: Snapshot; cached: boolean; coverage?: Coverage } | null> {
  try {
    const r = await fetch(`${DAEMON}/snapshot${force ? "?fresh=1" : ""}`, {
      cache: "no-store",
      /* Ручное обновление ждёт СТОЛЬКО, СКОЛЬКО НУЖНО.
         Полный круг по соцам — это десятки запросов к Мете, и он растёт с
         каждым подключённым соцем: на пяти было полторы минуты, и прежние 90
         секунд обрывали сбор почти на финише. Оборванная кнопка хуже долгой:
         человек видит старые данные и считает, что кабинетов нет. Десять
         минут — это «пока не сдастся», а не расчёт на такую длительность.
         Фоновый опрос остаётся быстрым: демон отдаёт ему готовое. */
      signal: AbortSignal.timeout(force ? 600_000 : 20_000),
    });
    if (r.status === 401) guardSession(r);
    if (!r.ok) return null;
    const d = (await r.json()) as {
      ok?: boolean; snapshot?: Snapshot | null; cached?: boolean; coverage?: Coverage;
    };
    return d?.ok && d.snapshot?.profiles
      ? { snap: d.snapshot, cached: !!d.cached, coverage: d.coverage }
      : null;
  } catch {
    return null;
  }
}

/** Load the ui snapshot from the panel's API (with local-file/env/push fallbacks server-side).
 * On failure, falls back to the last good snapshot cached in localStorage.
 *
 * `force` — пересобрать у Меты, не отдавая копию из памяти демона. Ставится
 * на кнопки, которые юзер нажимает руками; фоновый опрос ходит без него. */
export async function loadSnapshot(force = false): Promise<{
  snapshot: Snapshot | null; source: string; cached?: boolean; error?: string;
  coverage?: Coverage;
}> {
  let apiFallback: { snapshot: Snapshot; source: string } | null = null;
  try {
    const r = await fetch("/api/snapshot?_=" + Date.now(), { cache: "no-store" });
    /* Свой роут панели, а не демон, — но гейт закрывает и его, и 401 здесь значит
       ровно то же. Молчаливый возврат «снапшота нет» отправил бы человека искать
       мак, который ни при чём. Обёрнуто в try/catch выше: страж бросает намеренно,
       и здесь это НЕ проглатывается тихо — переход уже начат до броска. */
    guardSession(r);
    if (r.ok) {
      const data = (await r.json()) as { snapshot: Snapshot | null; source: string };
      if (data.snapshot) {
        try {
          localStorage.setItem(LAST_GOOD_KEY, JSON.stringify(data.snapshot));
        } catch {}
        const source = sourceLabel(data.source || "api", data.snapshot);
        if (snapshotIdentity(data.snapshot)) return { snapshot: data.snapshot, source };
        apiFallback = { snapshot: data.snapshot, source };
      }
    }
  } catch {}
  const viaDaemon = await fromDaemon(force);
  if (viaDaemon) {
    try {
      localStorage.setItem(LAST_GOOD_KEY, JSON.stringify(viaDaemon.snap));
    } catch {}
    return {
      snapshot: viaDaemon.snap, source: "OAuth/composite",
      cached: viaDaemon.cached, coverage: viaDaemon.coverage,
    };
  }
  if (apiFallback) return apiFallback;
  const cached = readCached();
  if (cached) return { snapshot: cached, source: "cache" };
  return { snapshot: null, source: "none", error: "no snapshot" };
}

export function readCached(): Snapshot | null {
  try {
    const raw = localStorage.getItem(LAST_GOOD_KEY);
    return raw ? (JSON.parse(raw) as Snapshot) : null;
  } catch {
    return null;
  }
}

/** Manual paste/upload path — validate + cache a snapshot JSON string. */
export function parseSnapshot(text: string): Snapshot {
  const data = JSON.parse(text) as Snapshot;
  if (!data || typeof data !== "object" || !("profiles" in data)) {
    throw new Error("не похоже на снапшот (нет profiles)");
  }
  try {
    localStorage.setItem(LAST_GOOD_KEY, JSON.stringify(data));
  } catch {}
  return data;
}
