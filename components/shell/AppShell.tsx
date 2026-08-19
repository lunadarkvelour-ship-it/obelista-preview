"use client";

/* Оболочка панели: шапка, сайдбар, мобильный бар, диалоги и синхронизация снапшота.
 *
 * Рендерится из app/layout.tsx, поэтому при переходе между листами (/launch,
 * /preview, /import) НЕ размонтируется: поллинг не перезапускается, стор и
 * позиция скролла целы. Раньше всё это жило в Studio вместе с самой формой.
 */

import * as React from "react";
import { I18nProvider } from "react-aria-components";
import { usePathname } from "next/navigation";
import { useStore } from "@/lib/store";
import { loadSnapshot, shouldApplySnapshot, snapshotIdentity } from "@/lib/snapshot";
import { createBridge, EMPTY_BRIDGE } from "@/lib/snapshot-bridge";
import type { Snapshot } from "@/lib/types";
import { Topbar } from "@/components/studio/Topbar";
import { Sidebar } from "./Sidebar";
import { MobileBar } from "@/components/studio/MobileBar";
import { PresetCommand } from "@/components/presets/PresetCommand";
import { PresetManager } from "@/components/presets/PresetManager";
import { Skeleton } from "@/components/ui/skeleton";

/** Пульс панели. С мостом проверяем раз в минуту (файл на диске рядом),
 *  без него — раз в 5 минут: снапшот теперь собирает демон через приложение,
 *  и десять минут были слишком долго — забаненный каб столько не ждёт. */
const HEARTBEAT_MS = 60 * 1000;
const API_POLL_MS = 5 * 60 * 1000;
/** Сколько ждём ответа расширения, прежде чем считать, что моста больше нет. */
const BRIDGE_TIMEOUT_MS = 4000;

/* С какого возраста снапшот моста считается несвежим и мы идём к демону.
   Десять минут: расширение переписывает файл заметно чаще, и если не переписало
   — значит оно встало, а не «просто ещё не успело». */
const STALE_BRIDGE_MS = 10 * 60 * 1000;

/** Страницы, которые обязаны открываться БЕЗ оболочки панели.
 *
 *  Их читает ревьюер Меты: ему нужен текст, а не сайдбар, пресеты и поллинг
 *  снапшота. Плюс оболочка до гидрации показывает скелетоны — на статической
 *  странице это выглядит как сломанный сайт.
 *
 *  `/data-request` сюда попадает по той же причине, что и политика: этот адрес
 *  указывается в настройках приложения как инструкция по удалению данных, и
 *  открывать его будут люди БЕЗ доступа к панели — в том числе те, кто аккаунт
 *  уже потерял. Навигация по листам им не просто бесполезна, она вводит в
 *  заблуждение: страница выглядит как часть приложения, куда надо сперва войти. */
/* `/login` и `/invite` — сюда же, и причина острее прочих: на них попадает
 *  человек, у которого сессии НЕТ. Оболочка вокруг них опросила бы демона,
 *  получила 401 и увела бы его на вход — то есть на страницу, где он уже стоит.
 *  Это не косметика, а бесконечный круг: страницу входа нельзя строить внутри
 *  того, что требует входа. */
const BARE = ["/privacy", "/data-request", "/terms", "/login", "/invite"];

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const theme = useStore((s) => s.theme);
  const setSnapshot = useStore((s) => s.setSnapshot);
  const setSync = useStore((s) => s.setSync);
  const setBridge = useStore((s) => s.setBridge);
  const [presetsOpen, setPresetsOpen] = React.useState(false);
  const [managerOpen, setManagerOpen] = React.useState(false);
  const [mounted, setMounted] = React.useState(false);

  React.useEffect(() => setMounted(true), []);

  // Атрибуты уже проставлены no-flash скриптом из layout; здесь мы только
  // догоняем их при переключении.
  React.useEffect(() => {
    if (!mounted) return;
    const el = document.documentElement;
    el.dataset.theme = theme;
    el.classList.toggle("dark", theme === "dark");
  }, [theme, mounted]);

  /* ── синхронизация снапшота ───────────────────────────────────────────── */
  const refreshRef = React.useRef<() => void>(() => {});
  React.useEffect(() => {
    let alive = true;
    const current = { snapshot: useStore.getState().snapshot as Snapshot | null };
    const healthy = { current: false };      // мост есть и реально читает файл
    const lastApiAt = { current: 0 };
    let waiting: ReturnType<typeof setTimeout> | null = null;

    /* Канонический Snapshot base определяется provider+revision. После него
       OAuth/composite, старый файл расширения и другой provider не могут
       победить только потому, что у них новее часы. */
    const apply = (snap: Snapshot | null) => {
      if (!snap) return;
      if (!shouldApplySnapshot(current.snapshot, snap)) return;
      current.snapshot = snap;
      setSnapshot(snap);
    };

    /** Насколько устарел снапшот, который принёс мост. */
    const ageMs = (snap: Snapshot | null) => {
      const t = Date.parse(snap?.generated_at || "");
      return Number.isFinite(t) ? Date.now() - t : Infinity;
    };

    const bridge = createBridge((st, snap) => {
      if (!alive) return;
      if (waiting) { clearTimeout(waiting); waiting = null; }
      setBridge(st);
      healthy.current = st.ok;
      if (st.ok) {
        apply(snap);
        const identity = snapshotIdentity(snap);
        setSync({
          lastPullAt: Date.now(),
          source: identity
            ? `plugin · ${identity.provider} · ${identity.revision.slice(0, 8)}`
            : "plugin fallback",
          pulling: false,
          pollMs: HEARTBEAT_MS,
        });
        /* Мост ответил, но принёс старьё — значит расширение давно не
           переписывало файл. Спрашиваем демона: у него свой сбор через Мету, и
           он почти наверняка свежее. Без этого панель честно показывала
           четырёхчасовой возраст и ничего с ним не делала. */
        if (ageMs(snap) > STALE_BRIDGE_MS && Date.now() - lastApiAt.current >= API_POLL_MS) {
          void apiPull();
        }
      } else {
        // Расширение стоит, но файл не читается — не притворяемся, что данные свежие.
        setSync({ pulling: false, pollMs: API_POLL_MS });
        void apiPull();
      }
    });

    /* `force` — нажали кнопку руками. Тогда демон обязан переспросить Мету, а
       не отдать копию из памяти: именно на этом «обновить» рапортовало успех,
       пока свежепошаренный каб в панель не приезжал. Фоновый опрос ходит без
       force и довольствуется кэшем — иначе каждые пять минут полный обход всех
       соцев на ровном месте. */
    const apiPull = async (force = false) => {
      lastApiAt.current = Date.now();
      setSync({ pulling: true, error: "" });
      const r = await loadSnapshot(force);
      if (!alive) return;
      /* Мост читает файл на диске и в обычной жизни свежее — но не тогда,
         когда ты сам нажал «обновить». Там мы только что спросили Мету, и это
         самое свежее, что вообще бывает; выбросить такой ответ ради файла,
         который расширение перепишет когда-нибудь потом, значит показать
         старое сразу после явного запроса. */
      if (!healthy.current || force) apply(r.snapshot);
      /* Успех — это приехавшие данные, а не «запрос не бросил исключение».
         `cache` и `none` означают, что живого источника нет: в первом случае
         на экране лежит прошлый снапшот из localStorage, во втором пусто. */
      const ok = !!r.snapshot && r.source !== "none" && r.source !== "cache";
      setSync({
        lastPullAt: Date.now(),
        source: force && ok ? r.source : healthy.current ? "plugin" : r.source,
        pulling: false,
        pollMs: healthy.current ? HEARTBEAT_MS : API_POLL_MS,
        ...(r.coverage ? { coverage: r.coverage } : {}),
        ...(ok || healthy.current
          ? { lastOkAt: Date.now(), error: "" }
          : { error: r.source === "cache"
                ? "Source is not responding — showing the previous snapshot"
                : r.error || "Source is not responding" }),
      });
    };

    const pollBridge = () => {
      setSync({ pulling: true });
      bridge.poll();
      if (waiting) clearTimeout(waiting);
      // Расширение снесли или воркер умер — молча висеть «проверяю…» нельзя.
      waiting = setTimeout(() => {
        if (!alive) return;
        healthy.current = false;
        setBridge(EMPTY_BRIDGE);
        void apiPull();
      }, BRIDGE_TIMEOUT_MS);
    };

    const tick = () => {
      if (healthy.current) pollBridge();
      else if (Date.now() - lastApiAt.current >= API_POLL_MS) void apiPull();
    };

    /* Кнопка в шапке всегда идёт к Мете напрямую, даже когда жив мост
       расширения: мост читает файл на диске, а файл пишет расширение по своему
       расписанию — «обновить» на нём означало бы «перечитай то же самое». */
    refreshRef.current = () => void apiPull(true);
    void apiPull();
    const id = setInterval(tick, HEARTBEAT_MS);
    return () => {
      alive = false;
      if (waiting) clearTimeout(waiting);
      clearInterval(id);
      bridge.dispose();
    };
  }, [setSnapshot, setSync, setBridge]);

  /* Кнопка обновления живёт на листе кабинетов — только его данные она и
     трогает. Оболочка слушает счётчик запросов: сам сбор идёт здесь, потому
     что здесь поллинг, мост и разбор источников. Первый рендер пропускаем —
     иначе тик нуля дал бы лишний полный обход при каждом открытии панели. */
  const refreshRequest = useStore((s) => s.refreshRequest);
  const firstRun = React.useRef(true);
  React.useEffect(() => {
    if (firstRun.current) {
      firstRun.current = false;
      return;
    }
    refreshRef.current();
  }, [refreshRequest]);

  React.useEffect(() => {
    const h = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setPresetsOpen((o) => !o);
      }
    };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, []);

  /* Проверка идёт ДО скелетонов: статическая страница не должна ждать
     гидрации стора, а ревьюер Меты — видеть мигающие плашки вместо текста. */
  /* Корень — публичная страница сайта, а не экран панели: ни сайдбара, ни
     опроса демона. Точным сравнением, а не startsWith: «/» — префикс всего. */
  if (pathname === "/" || BARE.some((p) => pathname?.startsWith(p))) {
    return <div className="min-h-dvh bg-background">{children}</div>;
  }

  if (!mounted) {
    return (
      <div className="min-h-dvh bg-background">
        <div className="h-14 border-b border-border" />
        <div className="mx-auto flex max-w-3xl flex-col gap-3 p-6">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-24 w-full rounded-lg" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <I18nProvider locale="en-US">
      <div className="min-h-dvh bg-background">
        <Topbar />
        {/* Полосы выбора источника данных здесь больше нет. Она стояла во всю
            ширину под шапкой, на каждой странице, и была срочной мерой, пока
            подводил OAuth. Выбор источника меняет «Кабинеты», «Профили» и
            «Кампании» разом — то есть это настройка установки, а не вид листа,
            и 17.08 решением владельца она уехала в «Интеграции»
            (`sections/integrations/DataSourceCard`).

            ВЫСОТЫ НИЖЕ ВЕРНУЛИСЬ К `3.5rem` ТЕМ ЖЕ ДВИЖЕНИЕМ. Полоса занимала
            2.75rem, и обе колонки вычитали из `100dvh` сумму `6.25rem`. Снять
            полосу и оставить вычитание значит получить на КАЖДОМ листе канвас,
            уехавший за нижний край экрана, и второй скролл поверх страницы. */}
        {/* Высота задана обеим колонкам явно, а не через h-full: строка грида
            авто-высоты растягивалась по длинному сайдбару, и вместо канваса
            скроллилась вся страница вместе с навигацией. */}
        <div className="lg:grid lg:h-[calc(100dvh-3.5rem)] lg:grid-cols-[auto_minmax(0,1fr)]">
          <Sidebar className="hidden lg:flex lg:h-[calc(100dvh-3.5rem)]" />
          {/* id="canvas" — корень скролла для scroll-spy сайдбара. */}
          <div id="canvas" className="min-w-0 lg:h-[calc(100dvh-3.5rem)] lg:overflow-y-auto">
            {children}
          </div>
        </div>

        <MobileBar />
        <PresetCommand
          open={presetsOpen}
          onOpenChange={setPresetsOpen}
          onManage={() => setManagerOpen(true)}
        />
        <PresetManager open={managerOpen} onOpenChange={setManagerOpen} />
      </div>
    </I18nProvider>
  );
}
