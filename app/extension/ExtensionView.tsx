"use client";

/* Лист «Extension ingest» — что прислало браузерное расширение через proxy.
 *
 *  Контракт: GET /api/extension/state → ExtensionState (см. lib/extension-types).
 *  Свич между live obelista_mcp backend и локальным mock-стором — одной env
 *  переменной EXTENSION_STORE_MODE в `lib/extension-store.ts`, и UI о ней не знает:
 *  он спрашивает только `/api/extension/state` и рисует то, что пришло.
 *
 *  Поведение «backend недоступен» определено в сторе: при сбое fetch он отдаёт
 *  дефолт `{ tokens: [], drops: [], health: { uptime_s: 0, last_ingest_at: null,
 *  total_drops: 0 } }`. Здесь это превращается в жёлтую плашку: запрос к серверу
 *  может упасть и по сети, и из-за пустого EXTENSION_BACKEND_URL — обе причины
 *  лечатся в одном месте, и подсказка одна. Если backend живой, но данных нет —
 *  покажем таблицы-пустышки, без плашки: это не авария, это просто ещё никто не
 *  зашёл через расширение.
 *
 *  Опрос раз в 10 с — компромисс: живое обновление для админа, который только
 *  что поставил расширение, и не частая долбёжка для пустого backend. */

import * as React from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { RefreshCw, AlertTriangle } from "lucide-react";
import {
  Button,
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardPanel,
  CardAction,
  Badge,
  Spinner,
  Skeleton,
} from "@/components/coss";
import { PAGE_WIDTH, PAGE_PAD } from "@/components/shell/page";
import { ageWords } from "@/lib/staleness";
import { cn } from "@/lib/utils";
import type { ExtensionState, IngestType } from "@/lib/extension-types";

/** Время в человеческом виде: "2 мин 13 с", "1 ч 4 мин", "3 д 7 ч".
 *  Тот же словарь, что и `lib/period.ts` — секунды, минуты, часы, дни. */
function uptimeText(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds <= 0) return "0 с";
  if (seconds < 60) return `${Math.floor(seconds)} с`;
  const m = Math.floor(seconds / 60);
  if (m < 60) {
    const s = Math.floor(seconds % 60);
    return s > 0 ? `${m} мин ${s} с` : `${m} мин`;
  }
  const h = Math.floor(m / 60);
  if (h < 24) {
    const rm = m % 60;
    return rm > 0 ? `${h} ч ${rm} мин` : `${h} ч`;
  }
  const d = Math.floor(h / 24);
  const rh = h % 24;
  return rh > 0 ? `${d} д ${rh} ч` : `${d} д`;
}

/** Полный размер — лимит 50 указан в требованиях; защищаемся повторно на случай,
 *  если backend пришлёт больше (или меньше). */
const RECENT_LIMIT = 50;

/** Дефолтный health — признак «backend не ответил» (см. `lib/extension-store.ts`,
 *  ветка `forward` при сбое fetch). Данные при этом пустые. */
function isDefaultHealth(h: ExtensionState["health"] | undefined): boolean {
  if (!h) return true;
  return h.uptime_s === 0 && h.last_ingest_at === null && h.total_drops === 0;
}

/** Тип дропа → вариант Badge. Два типа, два цвета; новые придут — добавим. */
function typeVariant(t: IngestType): "info" | "success" {
  return t === "token" ? "info" : "success";
}

/** Тип дропа → подпись для Badge. Маленькая, чтобы бейдж оставался бейджом. */
function typeLabel(t: IngestType): string {
  return t === "token" ? "token" : "adsmanager";
}

/** Запрос состояния через TanStack Query: кэш по `["extension-state"]`,
 *  авто-обновление каждые 10 секунд, ручной refresh через invalidateQueries. */
function useExtensionState() {
  return useQuery<ExtensionState>({
    queryKey: ["extension-state"] as const,
    queryFn: async () => {
      const r = await fetch("/api/extension/state", { cache: "no-store" });
      if (!r.ok) throw new Error(`state: ${r.status}`);
      return (await r.json()) as ExtensionState;
    },
    refetchInterval: 10_000,
    refetchOnWindowFocus: false,
  });
}

/** Тикаем раз в секунду, чтобы «N мин назад» не застывало между refetch. */
function useNowTick(): number {
  const [, setTick] = React.useState(0);
  React.useEffect(() => {
    const id = setInterval(() => setTick((t) => t + 1), 1000);
    return () => clearInterval(id);
  }, []);
  return Date.now();
}

export function ExtensionView() {
  const qc = useQueryClient();
  const query = useExtensionState();
  const now = useNowTick();

  const onRefresh = React.useCallback(() => {
    void qc.invalidateQueries({ queryKey: ["extension-state"] });
  }, [qc]);

  const state = query.data;
  const tokens = state?.tokens ?? [];
  const drops = (state?.drops ?? []).slice(0, RECENT_LIMIT);
  const health = state?.health;

  /* Плашка «нет связи с backend»: или запрос упал, или backend ответил дефолтом.
     Последнее мы не отличаем от «backend живой, но пусто», но жёлтый баннер с
     подсказкой про EXTENSION_BACKEND_URL в обоих случаях ведёт к правильному
     следующему шагу — открыть .env.example. */
  const backendDown = query.isError || (!!state && isDefaultHealth(health) && tokens.length === 0 && drops.length === 0);

  return (
    <div className={cn(PAGE_WIDTH, PAGE_PAD, "py-5")}>
      <div className="mb-3 flex flex-wrap items-center gap-3">
        <h1 className="display text-lg leading-none">Extension ingest</h1>
        <p className="text-xs text-muted-foreground">Что прислало браузерное расширение</p>
        <Button
          variant="outline"
          size="sm"
          onClick={onRefresh}
          loading={query.isFetching}
          className="ml-auto"
          aria-label="Refresh"
        >
          <RefreshCw className="size-3.5" strokeWidth={1.75} />
          Refresh
        </Button>
      </div>

      {backendDown && (
        <div className="mb-3 flex items-start gap-2 rounded-xl border border-warning/40 bg-warning/8 px-3 py-2 text-xs text-warning-foreground">
          <AlertTriangle className="mt-0.5 size-3.5 flex-none text-warning" strokeWidth={1.75} aria-hidden />
          <span>Нет связи с backend. Проверь EXTENSION_BACKEND_URL</span>
        </div>
      )}

      <div className="grid gap-3 xl:grid-cols-2">
        <HealthCard
          health={health}
          loading={query.isLoading}
          now={now}
        />

        <TokensCard tokens={tokens} loading={query.isLoading} now={now} />
      </div>

      <div className="mt-3">
        <RecentActivityCard drops={drops} loading={query.isLoading} now={now} />
      </div>
    </div>
  );
}

function HealthCard({
  health,
  loading,
  now,
}: {
  health: ExtensionState["health"] | undefined;
  loading: boolean;
  now: number;
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Health</CardTitle>
        <CardDescription>Связь с backend и накопленная статистика</CardDescription>
      </CardHeader>
      <CardPanel>
        {loading ? (
          <div className="grid gap-3 sm:grid-cols-3">
            <HealthStat label="Uptime" value={<Skeleton className="h-4 w-20" />} />
            <HealthStat label="Last ingest" value={<Skeleton className="h-4 w-24" />} />
            <HealthStat label="Total drops" value={<Skeleton className="h-4 w-12" />} />
          </div>
        ) : (
          <div className="grid gap-3 sm:grid-cols-3">
            <HealthStat
              label="Uptime"
              value={<span className="tnum">{health ? uptimeText(health.uptime_s) : "—"}</span>}
            />
            <HealthStat
              label="Last ingest"
              value={
                health?.last_ingest_at ? (
                  <span className="tnum">{ageWords(health.last_ingest_at, now)}</span>
                ) : (
                  <span className="text-muted-foreground">never</span>
                )
              }
            />
            <HealthStat
              label="Total drops"
              value={<span className="tnum">{health?.total_drops ?? 0}</span>}
            />
          </div>
        )}
      </CardPanel>
    </Card>
  );
}

function HealthStat({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1">
      <span className="text-2xs uppercase tracking-wide text-muted-foreground">{label}</span>
      <span className="text-sm text-foreground">{value}</span>
    </div>
  );
}

function TokensCard({
  tokens,
  loading,
  now,
}: {
  tokens: ExtensionState["tokens"];
  loading: boolean;
  now: number;
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Tokens</CardTitle>
        <CardDescription>
          {tokens.length > 0
            ? `${tokens.length} подключени${tokens.length === 1 ? "е" : "й"}`
            : "Ждём первого дропа"}
        </CardDescription>
      </CardHeader>
      <CardPanel>
        {loading ? (
          <TokensSkeleton />
        ) : tokens.length === 0 ? (
          <div className="rounded-xl border border-dashed border-border px-4 py-8 text-center">
            <p className="text-sm font-medium">Никто ещё не подключился</p>
            <p className="mt-1 text-xs text-muted-foreground">
              Установи расширение и залогинься в facebook.com
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto rounded-xl border border-border bg-background">
            <table className="w-full min-w-[480px] table-fixed border-collapse text-sm">
              <thead>
                <tr className="border-b border-border bg-elevated/50 text-left">
                  <Th>FB User ID</Th>
                  <Th>Last seen</Th>
                  <Th className="text-right">Drop count</Th>
                </tr>
              </thead>
              <tbody>
                {tokens.map((t) => (
                  <tr key={t.fb_user_id} className="border-b border-border/40 last:border-0">
                    <Td>
                      <span className="font-mono text-xs">{t.fb_user_id}</span>
                    </Td>
                    <Td>
                      <span className="tnum text-xs text-muted-foreground">
                        {ageWords(t.last_seen, now)}
                      </span>
                    </Td>
                    <Td className="text-right">
                      <span className="tnum text-xs">{t.drop_count}</span>
                    </Td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </CardPanel>
    </Card>
  );
}

function TokensSkeleton() {
  return (
    <div className="space-y-2">
      <Skeleton className="h-8 w-full" />
      <Skeleton className="h-8 w-full" />
      <Skeleton className="h-8 w-2/3" />
    </div>
  );
}

function RecentActivityCard({
  drops,
  loading,
  now,
}: {
  drops: ExtensionState["drops"];
  loading: boolean;
  now: number;
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Recent activity</CardTitle>
        <CardDescription>
          {drops.length > 0
            ? `Последние ${drops.length} ${drops.length === 1 ? "дроп" : "дропов"}`
            : "История пуста"}
        </CardDescription>
        <CardAction>
          {loading && <Spinner className="size-3.5 text-muted-foreground" />}
        </CardAction>
      </CardHeader>
      <CardPanel>
        {loading ? (
          <div className="space-y-2">
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="h-8 w-full" />
            ))}
          </div>
        ) : drops.length === 0 ? (
          <div className="rounded-xl border border-dashed border-border px-4 py-8 text-center">
            <p className="text-sm font-medium">Пока тихо</p>
            <p className="mt-1 text-xs text-muted-foreground">
              Здесь появятся последние дропы — токены и снимки Ads Manager
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto rounded-xl border border-border bg-background">
            <table className="w-full min-w-[640px] table-fixed border-collapse text-sm">
              <thead>
                <tr className="border-b border-border bg-elevated/50 text-left">
                  <Th>When</Th>
                  <Th>FB User ID</Th>
                  <Th>Type</Th>
                  <Th>Summary</Th>
                </tr>
              </thead>
              <tbody>
                {drops.map((d, i) => (
                  <tr
                    /* `fb_user_id + captured_at` уникальны в пределах пользователя,
                       но для безопасности добавляем индекс строки. */
                    key={`${d.fb_user_id}-${d.captured_at}-${i}`}
                    className="border-b border-border/40 last:border-0"
                  >
                    <Td>
                      <span className="tnum text-xs text-muted-foreground">
                        {ageWords(d.captured_at, now)}
                      </span>
                    </Td>
                    <Td>
                      <span className="font-mono text-xs">{d.fb_user_id}</span>
                    </Td>
                    <Td>
                      <Badge size="sm" variant={typeVariant(d.type)}>
                        {typeLabel(d.type)}
                      </Badge>
                    </Td>
                    <Td>
                      <span className="truncate text-xs text-foreground" title={d.summary}>
                        {d.summary}
                      </span>
                    </Td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </CardPanel>
    </Card>
  );
}

function Th({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <th
      className={cn("px-3 py-2 text-2xs font-medium uppercase tracking-wide text-muted-foreground", className)}
    >
      {children}
    </th>
  );
}

function Td({ children, className }: { children: React.ReactNode; className?: string }) {
  return <td className={cn("px-3 py-2 align-middle", className)}>{children}</td>;
}
