"use client";

/* Таблица лидерборда: строка на крео, разворот в кабы → кампании → объявления.
 *
 * Дерево разворачиваем сами, а не средствами таблицы: узлов четыре уровня,
 * часть подгружается по клику, и держать это состояние снаружи проще, чем
 * спорить с чужой моделью строк. От react-aria берём то, ради чего его и
 * выбрали — ощущение: выделение, сортировку, тягу колонок и липкую шапку.
 */

import * as React from "react";
import {
  Cell,
  Column,
  ColumnResizer,
  Group,
  ResizableTableContainer,
  Row,
  Table,
  TableBody,
  TableFooter,
  TableHeader,
  Button as AriaButton,
} from "react-aria-components";
import { ArrowUp, ChevronRight, GripVertical } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  hasMismatch, money, num, pct, staleLevel, staleWhy, statusTone, whenShort,
  STATUS_LABEL, type Maybe,
} from "@/lib/analytics";
import { BY_KEY, moveColumn, type ColKey } from "@/lib/analytics-columns";
import { geoHint, geoShort } from "@/lib/analytics-geo";
import { totalCell, totalsOf } from "@/lib/analytics-total";
import { derive, type Node } from "@/lib/analytics-tree";
import { колонкаЧитаетВоронку, ячейкаНеСобрана } from "@/lib/silence";
import { нижняяГраница } from "@/lib/analytics-final";
import { nodeState } from "@/lib/selection";
import {
  profileDisplay, profileHint, stateHint, type AccountFact,
} from "@/lib/analytics-accounts";
import { StatusDot } from "@/components/sections/health-bits";
import { heatTone, makeHeatScale, type HeatScale } from "@/lib/heat";
import { VB_H, VB_W, type Spark } from "@/lib/spark";

const INDENT = 15;

/** Подневный спенд — подложкой в ячейке спенда, под самой цифрой.
 *
 *  Почему подложкой, а не своей колонкой: колонка съела бы ширину у цифр, а
 *  таблица и так живёт с горизонтальной прокруткой на узком экране. Ячейка
 *  спенда для этого свободна — тепло красит только колонки ЦЕНЫ, потому что
 *  «дорого» это вывод, а «спенд 400» вывода не содержит (см. `heat` ниже).
 *  Значит слой под цифрой здесь никем не занят и ни с чем не дерётся.
 *
 *  Ширины у картинки нет: `preserveAspectRatio="none"` растягивает её по
 *  ячейке, какой бы та ни стала после ползунка или на 390 пикселях экрана.
 *  Отсюда же `vector-effect` — иначе растяжение размазало бы саму линию вширь.
 */
/* Цвет несёт направление, а не бренд. Пока все линии были акцентными, столбец
   читался как ряд одинаковых загогулин: чтобы понять, разгоняется крео или
   гаснет, приходилось вчитываться в форму каждой. Палитра та же, что у цены
   рядом, — янтарный значит «набирает» в обоих местах, и два сигнала
   складываются вместо того, чтобы спорить. */
const TREND_WORD: Record<Spark["trend"], string> = {
  up: "rising",
  down: "falling",
  flat: "flat",
};

function SparkLine({ spark }: { spark: Spark }) {
  return (
    /* Обёртка держит рамку, картинка внутри — на всю обёртку. Инсеты прямо на
       <svg> не годятся: это замещаемый элемент, и при `width/height: auto`
       браузер вправе взять размер из viewBox, а не из инсетов.
       Рамка та же, что у тепловой подложки: слой не касается линий сетки,
       иначе колонка выглядит залитой, а не подрисованной. */
    <span
      aria-hidden
      className="pointer-events-none absolute inset-x-[3px] inset-y-[2px]"
    >
      <svg
        viewBox={`0 0 ${VB_W} ${VB_H}`}
        preserveAspectRatio="none"
        className="block h-full w-full"
      >
        {/* База нуля. Рисуется ПЕРВОЙ, под заливкой: это опора, а не элемент
            графика, и перекрывать ею линию нельзя. Без неё горка висит в
            воздухе — «упало до нуля» и «упало вдвое» выглядят одинаково. */}
        <line
          x1={0}
          x2={VB_W}
          y1={spark.base}
          y2={spark.base}
          stroke="var(--spark-base)"
          strokeWidth={1}
          vectorEffect="non-scaling-stroke"
        />
        <path d={spark.area} fill={`var(--spark-fill-${spark.trend})`} />
        <polyline
          points={spark.line}
          fill="none"
          stroke={`var(--spark-${spark.trend})`}
          strokeWidth={1.25}
          strokeLinejoin="round"
          strokeLinecap="round"
          /* Без этого растяжение по ячейке размазало бы саму линию вширь:
             колонка шире картинки в разы, и волосок стал бы полосой. */
          vectorEffect="non-scaling-stroke"
        />
      </svg>
    </span>
  );
}

export interface Flat {
  node: Node;
  depth: number;
  hasKids: boolean;
  open: boolean;
  /** id крео, под которым лежит строка. У самого крео — свой id.
   *  Нужен тепловой шкале ветки: цвет внутри разворота считается по кабинетам
   *  ЭТОГО крео, а не по всему срезу. */
  root: string;
}

function value(n: Node, key: ColKey): React.ReactNode {
  if (key === "geos") {
    return n.geos.length ? (
      /* Корзина без гео названа и здесь: крео, у которого половина денег в
         «n/a», обязан выглядеть иначе, чем крео, у которого всё в своей
         стране (#150). Пропусти её — и строка читается как чистая. */
      <span className="text-[11.5px] text-muted-foreground"
            title={n.geos.map(geoHint).filter(Boolean).join(" ")}>
        {n.geos.map(geoShort).join(" ")}
      </span>
    ) : (
      <span className="text-ghost">—</span>
    );
  }
  const def = BY_KEY[key];
  const v = derive(n, key);
  /* ЦИФРЫ, КОТОРОЙ НЕ БЫЛО, НЕ БЫВАЕТ НУЛЁМ (#122). Воронка этой строки не
     приезжала ни разу — значит стоящий здесь ноль означает «не знаем», а не
     «депов не было». Это два разных вывода и два разных действия, а на экране
     они выглядели одинаково; по этим же цифрам тушат автоправила.

     Какие колонки затронуты, решает `ячейкаНеСобрана`, и решает ОПЫТОМ: она
     стирает у строки цифры воронки и смотрит, изменилось ли значение. Список
     руками сюда не переписан намеренно — он отстал бы от `derive` на первой же
     новой производной колонке, и её нули снова стали бы неотличимы. */
  if (ячейкаНеСобрана(n, key)) {
    return (
      <span
        className="tnum cursor-help text-ghost underline decoration-dotted underline-offset-2"
        title={
          "No funnel data has ever arrived for this row, so this is not a zero — " +
          "it is a gap. Treat it as unknown, not as «nothing happened»."
        }
      >
        n/c
      </span>
    );
  }
  const text = def.kind === "money" ? money(v) : def.kind === "pct" ? pct(v) : num(v);
  return (
    /* Ноль и прочерк приглушены, но ЧИТАЕМЫ. Стояло /40 — замерено 1.74 в
       светлой теме и 2.10 в тёмной при норме 4.5. Это не «приглушено», это
       невидимо: ноль депов — такой же факт, как двадцать, и решение по нему
       принимают ровно так же. /70 даёт около 4.6 и всё ещё уводит нули на
       второй план. */
    <span className={cn("tnum", v == null || v === 0 ? "text-muted-foreground" : "")}>
      {text}
    </span>
  );
}

/** Имя с приглушённым общим префиксом: одинаковое у соседей уходит назад,
 *  отличающееся остаётся читаемым. Ради этого нейминги и режутся по `--`.
 *
 *  @param hint приписка к подсказке. На кабинете — когда снимали его спенд:
 *  возраст обязан быть доступен у КАЖДОГО каба, а не только у застывших, но
 *  выносить его на экран поголовно значит утопить те девять, ради которых всё
 *  и затевалось (#20). Видимая метка — только на проблемных, точный момент —
 *  на всех. */
function DiffName({ node, hint }: { node: Node; hint?: string }) {
  const pre = node.prefix && node.label.startsWith(node.prefix) ? node.prefix : "";
  return (
    <span
      className="naming min-w-0 flex-1 truncate text-[12.5px]"
      title={hint ? `${node.label}\n${hint}` : node.label}
    >
      {pre ? <span className="text-ghost">{pre}</span> : null}
      <span className="text-foreground">{node.label.slice(pre.length)}</span>
    </span>
  );
}

function StatusMark({ status }: { status?: string | null }) {
  if (!status) return null;
  return (
    <span
      className={cn("label flex-none", statusTone(status))}
      title={"Facebook delivery status: " + status}
    >
      {STATUS_LABEL[status] || status.toLowerCase()}
    </span>
  );
}

/** Возраст спенда кабинета — и только когда он делает цифру рядом неправдой.
 *
 *  Иссус #20: панель за 9 августа показывала $944 при реальных $1516. Цифры не
 *  пропали и не обрезались — они застыли: девять кабов соца с умершим токеном
 *  сняли в первые минуты суток и больше не трогали. $9.13 на месте $192.07
 *  выглядели как свежая правда, и это хуже пустой ячейки.
 *
 *  Показываем МОМЕНТ ЗАМЕРА, а не «14 ч назад»: сравнивать его надо с концом
 *  тех суток, за которые записан спенд, а не с текущей минутой. Спенд за 8-е,
 *  снятый 8-го в 21:57, стар по часам и почти полон; спенд за 9-е, снятый 8-го
 *  в 23:08, — пустая строка, выданная за итог.
 *
 *  Метка появляется ТОЛЬКО когда есть что сказать. Постоянный значок на каждой
 *  строке ничего не сообщает: на живой базе три четверти кабов сняты нормально,
 *  и значок у всех превратил бы таблицу в шум, в котором как раз девять
 *  застывших и потерялись бы. Точный момент замера при этом есть у каждого
 *  кабинета — в подсказке строки. */
function StaleMark({ node }: { node: Node }) {
  const level = staleLevel(node.stale_gap_s ?? null);
  if (level === "ok") return null;
  return (
    <span
      className={cn(
        "label flex-none whitespace-nowrap rounded-[3px] px-1 py-px",
        level === "frozen"
          ? "bg-destructive-soft text-destructive"
          : "bg-warning-soft text-warning",
      )}
      title={staleWhy(
        node.kind === "account" ? "this ad account" : "this row",
        node.spend_at,
        node.stale_gap_s ?? null,
        node.stale_spend ?? null,
      )}
    >
      collected {whenShort(node.spend_at)}
    </span>
  );
}

/** Метка сторожа: сумма по объявлениям не сошлась с тем, что Мета говорит по
 *  кабинету целиком.
 *
 *  Пишет расхождение движковая половина #20, и доехать она может позже этой.
 *  Поэтому здесь нет ни колонки, ни прочерка, ни «нет данных»: нет записи —
 *  нет метки, лист выглядит ровно как выглядел. */
function CheckMark({ node }: { node: Node }) {
  const c = node.check;
  if (!c || !hasMismatch(c)) return null;
  const diff = c.diff ?? null;
  const parts = [
    c.meta != null ? `Meta for the ad account: ${money(c.meta)}` : "",
    c.ours != null ? `ours across ads: ${money(c.ours)}` : "",
    c.at ? `checked ${whenShort(c.at)}` : "",
  ].filter(Boolean);
  return (
    <span
      className="label flex-none whitespace-nowrap rounded-[3px] bg-destructive-soft px-1 py-px text-destructive"
      title={
        "The sum across ads does not match Meta's total for the ad account. " +
        (parts.length ? parts.join(", ") + "." : "No details available.")
      }
    >
      mismatch{diff != null ? ` ${money(Math.abs(diff))}` : ""}
    </span>
  );
}

function MethodMark({ method }: { method?: string | null }) {
  if (!method || method === "exact_asset" || method === "exact_job") return null;
  if (method === "manual") return <span className="label flex-none text-primary-ink">manual</span>;
  return (
    <span
      className="label flex-none rounded-[3px] bg-warning-soft px-1 py-px text-warning"
      title="Creative inferred from upload order, not from a recorded fact"
    >
      estimate
    </span>
  );
}

/** Перетаскивание колонок за заголовок.
 *
 *  Почему на pointer-событиях, а не на HTML5 drag-and-drop: тот рисует
 *  полупрозрачный дубль элемента и на заголовке таблицы дерётся с ползунком
 *  ширины.
 *
 *  Порядок меняется НА ХОДУ: колонка едет за курсором, а не прыгает на место по
 *  отпусканию. Раньше было наоборот, потому что заголовки переставлялись, а
 *  ячейки оставались на старых местах — под «FTD» вставала цена подписчика, — и
 *  единственным известным лекарством был ремаунт таблицы через key. Он на
 *  каждый пиксель пересоздаёт все строки: с одним развёрнутым крео (49 строк)
 *  страница переставала отвечать, поэтому перестановку и отложили на отпускание.
 *
 *  Настоящая причина оказалась другой: react-aria кэширует строки динамической
 *  коллекции по идентичности item и не зовёт рендер-функцию повторно. Лечится
 *  штатным пропом `dependencies` на TableBody (см. там), а не ремаунтом. Раз
 *  ремаунта нет — перестановка бесплатна на каждый пиксель, и метка «сюда
 *  встанет» стала не нужна: видно саму колонку.
 *
 *  Порог в 4 пикселя отделяет перетаскивание от клика — иначе каждая сортировка
 *  съезжала бы на соседнюю колонку.
 */
function useColumnDrag(visible: ColKey[], onReorder: (next: ColKey[]) => void) {
  const [active, setActive] = React.useState<ColKey | null>(null);
  const st = React.useRef<{ key: ColKey; x: number; moved: boolean } | null>(null);
  /* Живой порядок. Слушатели вешаются один раз, а visible приходит пропом —
     замыкание застревало бы на старом порядке. Плюс за один кадр pointermove
     может прилететь несколько раз: если читать порядок только из пропа, второе
     событие посчитает позицию по ещё не отрисованному состоянию и колонка
     перескочит через соседа. Поэтому применённый порядок пишем сюда сразу. */
  const order = React.useRef(visible);
  order.current = visible;

  const cb = React.useRef(onReorder);
  cb.current = onReorder;

  React.useEffect(() => {
    const move = (e: PointerEvent) => {
      const s = st.current;
      if (!s) return;
      if (!s.moved) {
        if (Math.abs(e.clientX - s.x) < 4) return;
        s.moved = true;
        setActive(s.key);
        document.body.style.cursor = "grabbing";
        document.body.style.userSelect = "none";
      }
      const from = order.current.indexOf(s.key);
      if (from < 0) return;
      /* Считаем всех соседей, чью середину курсор миновал, а не ближайшего: за
         одно событие мышь может пролететь половину таблицы, и по одному шагу
         колонка отставала бы от курсора. */
      let to = from;
      for (const el of document.querySelectorAll<HTMLElement>("[data-colkey]")) {
        const k = el.dataset.colkey as ColKey;
        if (k === s.key) continue;
        const i = order.current.indexOf(k);
        if (i < 0) continue;
        const r = el.getBoundingClientRect();
        const mid = r.left + r.width / 2;
        if (i > from && e.clientX > mid) to = Math.max(to, i);
        if (i < from && e.clientX < mid) to = Math.min(to, i);
      }
      if (to === from) return;
      const next = moveColumn(order.current, s.key, to);
      if (next === order.current) return;
      order.current = next;
      cb.current(next);
    };
    const up = () => {
      st.current = null;
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
      setActive(null);
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
    window.addEventListener("pointercancel", up);
    return () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
      window.removeEventListener("pointercancel", up);
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
    };
  }, []);

  return {
    active,
    start: (key: ColKey) => (e: React.PointerEvent) => {
      if (e.button !== 0) return;
      st.current = { key, x: e.clientX, moved: false };
    },
    /** Клик после перетаскивания сортировкой не считается. */
    suppressClick: (e: React.MouseEvent) => {
      if (st.current?.moved || active) {
        e.preventDefault();
        e.stopPropagation();
      }
    },
  };
}

export function CreativeTable({
  rows,
  accounts,
  visible,
  sortKey,
  sortDesc,
  onSort,
  selected,
  onRowClick,
  onToggle,
  onReorder,
  widths,
  onWidths,
  specialLabels,
  profileLabels,
  hiddenCount = 0,
}: {
  rows: Flat[];
  /** Имя, агентство и состояние кабинета по `act_id` — сведённые из леса, базы
   *  и снапшота ЗА пределами таблицы (`lib/analytics-accounts`). Таблица их
   *  только рисует: собирая индекс сама, она умела знать про кабинет не то же
   *  самое, что сортировка листа, — и в облаке они оба знали ровно ничего. */
  accounts: Map<string, AccountFact>;
  visible: ColKey[];
  sortKey: ColKey;
  sortDesc: boolean;
  onSort: (key: ColKey, desc: boolean) => void;
  selected: Set<string>;
  /** Клик по строке. `shift` — диапазон от прошлой, `add` — Cmd/Ctrl,
   *  добавить к выбору вместо замены. */
  onRowClick: (id: string, mods: { shift: boolean; add: boolean }) => void;
  /** @param deep раскрыть/свернуть всю ветку целиком (Alt по шеврону). */
  onToggle: (node: Node, deep?: boolean) => void;
  /** Новый порядок колонок после перетаскивания заголовка. */
  onReorder: (next: ColKey[]) => void;
  /** Ширины по id колонки. Держим их сами, а не отдаём react-aria на откуп:
   *  своё состояние переживает и перестановку колонок, и перезагрузку страницы,
   *  а внутреннее — нет. */
  widths: Record<string, number>;
  onWidths: (next: Record<string, number>) => void;
  specialLabels: Set<string>;
  /** `profile_id → человеческое имя`, ТОЛЬКО ДЛЯ ПОКАЗА (`lib/analytics-accounts`).
   *  В `n.socials` ничего не подменяет: по этим id идут фильтр и выгрузка, а
   *  подсказка на строке называет id всегда. Карты нет — рисуем id. */
  profileLabels?: ReadonlyMap<string, string>;
  /** Сколько крео среза скрыто фильтрами. Нужно строке итога: она считает по
   *  показанным, и обязана сказать об этом, а не выдавать часть за всё. */
  hiddenCount?: number;
}) {
  const drag = useColumnDrag(visible, onReorder);

  /* Шкалы тепла — по одной на колонку цены, построенные по строкам КРЕО.
   *
   *  Почему только цены: «дорого» и «дёшево» — это вывод, а «спенд 400» вывода
   *  не содержит, крупный расход не хорош и не плох сам по себе. Красить всё
   *  подряд значит превратить таблицу в мозаику, в которой цвет ничего не
   *  сообщает.
   *
   *  Почему по крео, а не по всем видимым строкам: строки кабов — это те же
   *  деньги, разложенные мельче, и подмешивать их в выборку значит смещать
   *  перцентили каждый раз, когда кто-то раскрыл ветку. Шкала обязана быть
   *  одной и той же независимо от того, что сейчас развёрнуто. */
  /* Кабинет по act_id: имя, агентство, состояние. Индекс приходит готовым от
     листа (`AnalyticsView`), потому что источников у этих фактов три и сводить
     их обязан кто-то один — см. `lib/analytics-accounts`.
     Кабинета в индексе может не быть вовсе — тогда `undefined`, и строка честно
     останется с голым id и серым кружком «не спрашивали». */
  const acc = React.useCallback(
    (id?: string) => (id ? accounts.get(id) : undefined),
    [accounts],
  );

  /* Верхний уровень дерева — строки крео. Он нужен и тепловым шкалам, и итогу
     внизу: считать по всем узлам нельзя, кабинеты и объявления внутри крео —
     это те же деньги ещё раз. */
  const tops = React.useMemo(
    () => rows.filter((r) => r.node.kind === "creative").map((r) => r.node),
    [rows],
  );

  const heat = React.useMemo(() => {
    const out: Partial<Record<ColKey, HeatScale>> = {};
    for (const key of visible) {
      if (BY_KEY[key]?.kind !== "money" || !key.startsWith("cp")) continue;
      out[key] = makeHeatScale(tops.map((n) => derive(n, key)));
    }
    return out;
  }, [tops, visible]);

  /* СВОЯ тепловая шкала внутри каждой раскрытой ветки — и это ответ на
     «раскрыл, и стало нечитаемо».
     
     Шкала выше построена по крео: её границы — самое дешёвое и самое дорогое
     крео среза. Кабинеты одного крео лежат в этих границах кучно (это тот же
     крео, те же гео, тот же оффер), поэтому внутри ветки все ячейки получают
     почти один оттенок. Цвет формально есть, а различает он ноль — глазу не за
     что зацепиться, и приходится читать колонку цифрами. Ровно это и ощущается
     как слепота.
     
     Внутри ветки границы берутся по её собственным кабинетам, и разница между
     дорогим и дешёвым кабом снова видна. Суммы при этом не трогаются: шкала —
     это способ смотреть, а не считать. */
  const branchHeat = React.useMemo(() => {
    const out = new Map<string, Partial<Record<ColKey, HeatScale>>>();
    const цветные = visible.filter(
      (k) => BY_KEY[k]?.kind === "money" && k.startsWith("cp"),
    );
    if (!цветные.length) return out;

    let корень: string | null = null;
    let кабы: Node[] = [];
    const закрыть = () => {
      if (корень && кабы.length > 1) {
        const шкалы: Partial<Record<ColKey, HeatScale>> = {};
        for (const key of цветные) шкалы[key] = makeHeatScale(кабы.map((n) => derive(n, key)));
        out.set(корень, шкалы);
      }
      кабы = [];
    };
    for (const r of rows) {
      if (r.depth === 0) {
        закрыть();
        корень = r.root;
        continue;
      }
      // Только кабинеты: кампании и адсеты — это те же деньги, разложенные
      // мельче, и подмешивать их значит смещать границы ветки без причины.
      if (r.node.kind === "account") кабы.push(r.node);
    }
    закрыть();
    return out;
  }, [rows, visible]);

  /* Стрелки по дереву — как в любом файловом менеджере: вправо раскрыть, влево
     свернуть, Alt+стрелка — вся ветка разом.
     Слушатель нативный, потому что ResizableTableContainer проп onKeyDown не
     принимает: он прокидывает наружу только свои. Через ref это ровно тот же
     обработчик, но на настоящем элементе. */
  const box = React.useRef<HTMLDivElement>(null);
  React.useEffect(() => {
    const el = box.current;
    if (!el) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "ArrowRight" && e.key !== "ArrowLeft") return;
      const id = (e.target as HTMLElement).closest<HTMLElement>("[data-rowid]")?.dataset.rowid;
      const row = id ? rows.find((r) => r.node.id === id) : undefined;
      if (!row?.hasKids) return;
      // Уже раскрыто и жмут «вправо» — пусть работает штатный переход фокуса.
      if (e.key === "ArrowRight" && row.open) return;
      if (e.key === "ArrowLeft" && !row.open) return;
      e.preventDefault();
      onToggle(row.node, e.altKey);
    };
    el.addEventListener("keydown", onKey);
    return () => el.removeEventListener("keydown", onKey);
  }, [rows, onToggle]);

  /* Ширины пишем по ОТПУСКАНИЮ ползунка, а не на каждый пиксель: onResize
     стреляет десятками событий за движение, и каждое уходило бы в localStorage
     через persist-стор. */
  const saveWidths = React.useCallback(
    (m: Map<React.Key, number | string>) => {
      const next: Record<string, number> = {};
      for (const [k, v] of m) {
        // Проценты и fr в стор не кладём: при следующем открытии ширина должна
        // быть той же в пикселях, а не долей от другого размера окна.
        if (typeof v === "number") next[String(k)] = Math.round(v);
      }
      onWidths(next);
    },
    [onWidths],
  );

  /* Шапка НЕПРОЗРАЧНАЯ, и это не вкусовщина.
     Стояло `surface-blur`: 82% фона плюс backdrop-filter. Фильтр на <th> не
     применяется вовсе (замерено: computed backdrop-filter = none), и от всего
     эффекта оставалась дырка в 18%, сквозь которую при прокрутке просвечивали
     строки — в тёмной теме шапка выглядела сломанной. Липкой строке нужен
     плотный фон, а не полупрозрачный. */
  const head =
    "bg-card label sticky top-0 z-20 h-9 border-b border-border " +
    // focus-ring вместо outline-none: клавиатурный фокус в шапке был не виден
    // вообще, и «где я сейчас» приходилось угадывать по подсветке сортировки.
    "text-muted-foreground cursor-default focus-ring";

  const resizer =
    "h-4 w-px flex-none cursor-col-resize rounded-full bg-border-strong/70 " +
    "outline-none transition-colors hover:bg-primary-ink data-[resizing]:bg-primary-ink " +
    "data-[resizing]:w-[2px]";

  return (
    /* Виртуализации здесь НЕТ, и это осознанный выбор, а не недоделка.
       Пробовали `Virtualizer layout={TableLayout}` 08.08: работает — на 98
       строках в DOM оставалось 25, минус 74%. Но под ним строки позиционируются
       абсолютно, скроллером становится сама таблица, и `position: sticky` на
       первой колонке перестаёт держать: замерено, при горизонтальной прокрутке
       на 400px имя крео уезжало с 249px на −151px, то есть просто укатывалось.
       В дереве это фатально: прокрутил вправо к деньгам — и не видишь, чья это
       строка. Гармошка держит открытым одно крео за раз, а это около сотни
       строк; ~1700 ячеек браузер тянет спокойно, тем более что перемонтирования
       таблицы на каждый пиксель драга больше нет. Возвращаться к виртуализации,
       если строк станет тысячи — но тогда липкую колонку придётся решать
       отдельно. */
    <ResizableTableContainer
      onResizeEnd={saveWidths}
      /* Клик ловим на контейнере, а не на самой Row: нужны модификаторы
         (Shift для диапазона, Cmd для добавления), а RAC отдаёт в onAction
         только факт нажатия. Делегирование заодно переживает перерисовки строк
         и не вешает по обработчику на каждую из сотни.

         Именно onClickCapture, а не onClick: react-aria внутри строки гасит
         всплытие клика, и до контейнера в обычной фазе он не доходит вовсе.
         Проверено на живой панели — прямой вызов обработчика выделял, а
         настоящий клик мышью не делал ничего. Перехват срабатывает раньше
         строки; на шевроне и ползунке ширины выходим по проверке ниже. */
      onClickCapture={(e) => {
        const t = e.target as HTMLElement;
        // Клик по шеврону, ползунку ширины или заголовку — не выделение.
        if (t.closest("button, [role='button'], [role='columnheader']")) return;
        const row = t.closest<HTMLElement>("[data-rowid]");
        const id = row?.dataset.rowid;
        if (!id) return;
        onRowClick(id, { shift: e.shiftKey, add: e.metaKey || e.ctrlKey });
      }}
      ref={box}
      className="min-h-0 flex-1 overflow-auto rounded-xl border border-border bg-card"
    >
      {/* Ремаунта по ключу здесь больше нет — см. комментарий у dependencies
          на TableBody ниже. */}
      <Table
        aria-label="Creative leaderboard"
        /* Выделение НЕ штатное. Раньше стоял selectionMode="multiple", и клик по
           любому месту строки её отмечал — походить по дереву, ничего не
           наотмечав, было невозможно. Теперь клик по строке РАСКРЫВАЕТ ветку,
           а отмечает только чекбокс, и множество живёт своим каскадом
           (lib/selection.ts): отметил кампанию — отметились её адсеты и
           объявления, снял одно — родитель ушёл в промежуточное состояние. */
        selectionMode="none"
        sortDescriptor={{ column: sortKey, direction: sortDesc ? "descending" : "ascending" }}
        onSortChange={(d) => onSort(String(d.column) as ColKey, d.direction === "descending")}
        className="border-separate border-spacing-0"
      >
        <TableHeader>
          <Column
            isRowHeader
            id="creative"
            defaultWidth={widths.creative ?? 330}
            minWidth={200}
            className={cn(head, "sticky left-0 z-30 px-3 text-left")}
          >
            <div className="flex h-full items-center gap-1">
              <Group className="min-w-0 flex-1 truncate outline-none">creative</Group>
              <ColumnResizer className={resizer} />
            </div>
          </Column>

          {visible.map((key) => {
            const def = BY_KEY[key];
            return (
              <Column
                key={key}
                id={key}
                allowsSorting
                textValue={def.title}
                defaultWidth={widths[key] ?? def.width}
                minWidth={54}
                data-colkey={key}
                className={cn(
                  head,
                  /* НЕ `relative`. Он стоял здесь ради тени схваченной
                     колонки и молча убивал `sticky` из `head`: обе утилиты
                     задают position, и `relative` в таблице стилей ниже.
                     Итог — первая колонка (у неё свой sticky left-0)
                     оставалась на месте, а все остальные заголовки уезжали
                     вверх при прокрутке, и таблица оказывалась без шапки.
                     Замерено: computed position у колонок-метрик = relative.
                     Sticky сам по себе позиционированный, отдельный класс
                     для абсолютных детей не нужен. */
                  "group/col px-2 text-right",
                  /* Схваченная колонка ПОДНИМАЕТСЯ, а не слегка красится.
                     Прошлый признак — заливка 60% прозрачности — на мягком
                     лаймовом токене поверх размытой шапки не читался вовсе, и
                     перетаскивание выглядело так, будто ничего не произошло.
                     Тень плюс явный z-index отделяют колонку от ряда, и видно,
                     что именно едет. */
                  drag.active === key && "z-40 shadow-[0_6px_18px_-6px_rgb(0_0_0/0.28)]",
                )}
                /* Фон инлайном, а не классом: `.surface-blur` объявлена вне
                   слоёв, а утилиты Tailwind внутри `@layer`, и по правилам
                   каскада беcслойное побеждает — `bg-elevated` на шапке не
                   применялся вовсе (замерено: computed background оставался
                   полупрозрачным от surface-blur). Плотный фон нужен, чтобы
                   схваченная колонка не просвечивала соседей насквозь. */
                style={drag.active === key ? { background: "var(--elevated)" } : undefined}
              >
                {({ sortDirection }) => (
                  <div className="flex h-full items-center justify-end gap-1">
                    <Group
                      className={cn(
                        "flex min-w-0 flex-1 cursor-grab touch-none items-center justify-end gap-1",
                        "outline-none active:cursor-grabbing",
                      )}
                      title={
                        (def.hint ? def.hint + " · " : "") +
                        "drag the handle to reorder the column"
                      }
                      onPointerDown={drag.start(key)}
                      onClickCapture={drag.suppressClick}
                    >
                      {/* Явная ручка. Без неё заголовок выглядел как обычная
                          кнопка сортировки: юзер жал, получал сортировку и
                          делал вывод, что перетаскивания нет. Точки появляются
                          при наведении и при захвате, места в шапке не
                          занимают — колонка узкая, и постоянная иконка съела бы
                          заголовок. */}
                      <GripVertical
                        aria-hidden
                        className={cn(
                          "size-3 flex-none transition-opacity duration-150 ease-out",
                          /* Ветками, а не добавлением класса поверх: `opacity-0`
                             и `opacity-100` на одном элементе решаются порядком
                             в таблице стилей, и побеждал ноль — ручка на
                             схваченной колонке оставалась невидимой. Замерено:
                             computed opacity 0 при активном перетаскивании. */
                          drag.active === key
                            ? "text-primary-ink opacity-100"
                            : "text-faint opacity-0 group-hover/col:opacity-100",
                        )}
                      />
                      <span className={cn("truncate", sortDirection && "text-foreground")}>
                        {def.title}
                      </span>
                      {sortDirection ? (
                        <ArrowUp
                          aria-hidden
                          className={cn(
                            "size-3 flex-none text-primary-ink transition-transform duration-150 ease-out",
                            sortDirection === "descending" && "rotate-180",
                          )}
                        />
                      ) : null}
                    </Group>
                    <ColumnResizer className={resizer} />
                  </div>
                )}
              </Column>
            );
          })}
        </TableHeader>

        {/* dependencies={[visible]} — обязательно, и вот почему.
            react-aria мемоизирует строки динамической коллекции по идентичности
            item: пока `rows` те же объекты, рендер-функция строки НЕ вызывается
            повторно. Переставили колонки — шапка пересобралась, а ячейки
            остались от прошлого порядка, и под «FTD» встала цена подписчика.
            Раньше это лечили перемонтированием таблицы через key, что стоило
            сброшенных ширин и запрещало виртуализацию. Правильный механизм —
            вот этот проп: он инвалидирует кэш строк, не разрушая компонент.
            Цена: смена порядка перерисовывает все видимые строки разом.

            Здесь обязано быть ВСЁ внешнее, от чего зависит отрисовка строки, а
            не только колонки. `selected` и `loading` в объект строки не входят
            (в Flat лежат только узел, глубина и флаги дерева), поэтому без них
            стор обновлялся, а галки в таблице оставались от прошлого состояния:
            снял отметку с кабинета — набор в сторе уменьшился, а на экране
            галка так и стояла. Ровно та же ловушка, что и с колонками. */}
        <TableBody items={rows} dependencies={[visible, selected]}>
          {(r) => {
            const n = r.node;
            const isCreative = n.kind === "creative";
            const isSpecial = isCreative && specialLabels.has(n.label);
            const mark = nodeState(n, selected);
            const on = mark === "on";
            const part = mark === "part";
            return (
              <Row
                id={n.id}
                data-rowid={n.id}
                /* onAction тут больше НЕТ, и это главное про ощущение строки.
                   Раньше клик по строке одновременно раскрывал ветку и
                   выделял её: одно нажатие — два несвязанных последствия,
                   причём второе видно, а первое сдвигает половину таблицы.
                   Теперь роли разведены: слева шеврон — раскрыть, вся
                   остальная строка — выделить. */
                className={cn(
                  // Подсветка едет переходом, а не щелчком: без него проводка
                  // курсором по таблице читалась как мигание строк.
                  // Строка тоже получает видимое кольцо: по дереву ходят
                  // стрелками, и без него не понять, какая строка под курсором
                  // клавиатуры — а именно с неё копируется Cmd+C.
                  "group focus-ring transition-colors duration-150 ease-out",
                  // Курсор один на всю строку: она вся про выделение.
                  "cursor-default",
                  !isCreative && "bg-subtle/40",
                  !on && !part && "hover:bg-hover",
                )}
                /* Состояние отметки — атрибутом, а раскраска в globals.css
                   вне слоёв. Утилитами это не решается: `group-hover:bg-hover`
                   и класс выделения живут на одном элементе, а вариантные
                   утилиты Tailwind идут в таблице стилей ПОЗЖЕ базовых — ховер
                   перебивал выделение, и отмеченная строка под курсором
                   выглядела неотмеченной. Ровно это и читалось как «выделение
                   работает по конченному». Правило вне слоёв выигрывает по
                   каскаду у любой утилиты и заодно умеет свой :hover. */
                data-sel={on ? "on" : part ? "part" : undefined}
              >
                {/* Липкая ячейка красится тем же токеном И ТЕМ ЖЕ переходом,
                    что и строка. Именно рассинхрон оставлял серый хвост,
                    отстающий от курсора на границе ячейки: раньше проблему
                    снимали, убрав переход у ячейки, — теперь длительность и
                    кривая совпадают, и они едут вместе.

                    Рельс слева — второй канал выделения помимо заливки.
                    Мягкая заливка это разница в пару процентов светлоты: на
                    десятке строк её видно, на сотне уже нет, а под
                    горизонтальной прокруткой правые ячейки и вовсе уезжают.
                    Рельс живёт на липкой колонке и виден всегда.
                    Половинчатая отметка (выбрана часть кабов) получает ТОЛЬКО
                    рельс, вполсилы и без заливки — иначе «выбрано всё» и
                    «выбрана часть» выглядели одинаково. */}
                <Cell
                  className={cn(
                    "sticky left-0 z-[1] overflow-hidden border-b border-border/60 px-3 py-[5px]",
                    "transition-colors duration-150 ease-out",
                    "before:absolute before:inset-y-0 before:left-0 before:w-[3px] before:content-['']",
                    /* Полоса слева на всю ветку — граница разворота. Без неё
                       кабинеты одного крео ничем не отделены от следующего
                       крео: отступ в дереве съедается первой же колонкой, и
                       где кончилась ветка, глаз не находит. Отметку строки она
                       не перебивает — у отмеченной полоса своего цвета. */
                    !on && !part && r.root && r.open !== undefined && r.depth > 0 &&
                      "before:bg-primary-line",
                    !on && !part && isCreative && r.open && "before:bg-primary-ink",
                    "before:transition-colors before:duration-150 before:ease-out",
                    isCreative ? "bg-card" : "bg-elevated",
                    /* Раскрытое крео липнет под шапкой таблицы: прокручивая
                       ветку на два десятка кабинетов, перестаёшь понимать, чьи
                       это кабинеты, — а вопрос «чья строка» тут единственный.
                       z-[2] против z-[1] у обычной липкой колонки: строка крео
                       обязана проехать НАД кабинетами, а не под ними. */
                    isCreative && r.open && "sticky top-9 z-[2]",
                    !on && !part && "group-hover:bg-hover",
                  )}
                >
                  <div
                    className="flex min-w-0 items-center gap-1.5"
                    style={{ paddingInlineStart: r.depth * INDENT }}
                  >
                    {/* Шеврон — ЕДИНСТВЕННОЕ место, которое раскрывает.
                        Клик по остальной строке только выделяет. Раньше
                        строка делала и то и другое разом: нажал крео —
                        выделилось и одновременно уехало пол-таблицы вниз, и
                        было не понять, что из этого ты только что попросил.

                        Клик по шеврону при этом НЕ выделяет: обработчик
                        выделения на контейнере пропускает всё внутри button. */}
                    <span
                      className="flex size-[18px] flex-none items-center justify-center"
                      /* Подсказка на обёртке, а не на кнопке: RAC Button проп
                         title до DOM не доносит. */
                      title={
                        r.hasKids
                          ? (r.open ? "Collapse" : "Expand ad accounts") + " · arrow keys ← →"
                          : undefined
                      }
                    >
                      {r.hasKids ? (
                        <AriaButton
                          aria-label={r.open ? "Collapse" : "Expand ad accounts"}
                          onPress={() => onToggle(n)}
                          className={cn(
                            "focus-ring relative flex size-full items-center justify-center rounded",
                            "text-muted-foreground transition-colors duration-150 ease-out",
                            "hover:bg-primary-line hover:text-foreground",
                            // Зона нажатия крупнее видимой иконки: в плотной
                            // таблице попадать в 14 пикселей — отдельная работа.
                            "after:absolute after:-inset-[7px] after:content-['']",
                          )}
                        >
                          <ChevronRight
                            className={cn(
                              // 180 мс и своя кривая: на 150 мс линейного
                              // поворот успевал прочитаться как подёргивание.
                              "size-3.5 transition-transform duration-[180ms]",
                              "[transition-timing-function:cubic-bezier(0.2,0,0,1)]",
                              r.open && "rotate-90",
                            )}
                          />
                        </AriaButton>
                      ) : null}
                    </span>

                    {/* Подписи уровня («каб», «кам», «объ») здесь больше нет:
                        уровень читается по отступу и раскрытию, а что за объект
                        — по неймингу, он для того и заведён. Три буквы перед
                        каждой строкой только съедали ширину первой колонки. */}

                    {/* Состояние кабинета — тем же кружком, что и на листе
                        «Кабинеты». Компонент один намеренно: два разных знака
                        про одно и то же читаются как два разных факта.

                        Статус сведён из базы и снапшота (`accounts` сверху).
                        Кабинет, о котором не спрашивал никто, получает серый
                        кружок «неизвестно» и ПРЕДЛОЖЕНИЕ в подсказке, а не
                        зелёный: нарисовать живой там, где не проверяли, — ровно
                        то враньё, против которого лист и затевался (#122). */}
                    {isCreative ? (
                      <span
                        className={cn(
                          "min-w-0 flex-1 truncate text-[13px]",
                          isSpecial ? "text-warning" : "font-medium text-foreground",
                        )}
                        title={n.label}
                      >
                        {n.label}
                      </span>
                    ) : n.kind === "account" && acc(n.act_id)?.name ? (
                      /* Кабинет подписан ИМЕНЕМ, как на листе «Кабинеты», а
                         id уходит вторым планом. Голый act_id ни о чём не
                         говорит: имя несёт агентство, гео и номер, по нему
                         кабинет и узнают. Id при этом остаётся видимым — его
                         копируют в manage и в Мету. */
                      /* Две строки, как на листе «Кабинеты»: имя сверху, id под
                         ним. В одну строку они не помещаются — первая колонка
                         держит ещё отступ дерева, шеврон, кружок и соц, — и имя
                         обрезалось до «Hiuhiu_…», то есть до той части, которая
                         одинакова у всех кабинетов подряд. Ради чего его и
                         показывали, терялось целиком. */
                      <span className="flex min-w-0 flex-1 flex-col leading-tight">
                        <span className="truncate text-[12.5px] text-foreground" title={acc(n.act_id)!.name!}>
                          {acc(n.act_id)!.name}
                        </span>
                        {/* Кружок стоит слева ОТ ID, а не от имени: id — это
                            то, что копируют и по чему кабинет ищут в Мете, и
                            состояние читается вместе с ним одним взглядом.
                            Подсказка на id говорит состояние СЛОВАМИ и называет
                            источник: серый кружок сам по себе читается как
                            «нормально, просто бледно». */}
                        <span
                          className="flex items-center gap-1.5"
                          title={stateHint(acc(n.act_id), n.label)}
                        >
                          <StatusDot status={acc(n.act_id)?.status ?? undefined} className="size-2" />
                          <span className="truncate font-mono text-[10.5px] text-faint">
                            {n.label}
                          </span>
                        </span>
                      </span>
                    ) : (
                      <>
                      {n.kind === "account" ? (
                        <StatusDot status={acc(n.act_id)?.status ?? undefined} className="size-2" />
                      ) : null}
                      <DiffName
                        node={n}
                        hint={
                          /* У кабинета без имени подсказка обязана сказать
                             ХОТЯ БЫ состояние: это единственная строка, где от
                             кабинета остался один id, и молчать о нём — значит
                             оставить человека с шестнадцатью цифрами. */
                          n.kind === "account"
                            ? [
                                stateHint(acc(n.act_id), n.label),
                                staleWhy(
                                  "this ad account",
                                  n.spend_at,
                                  n.stale_gap_s ?? null,
                                  n.stale_spend ?? null,
                                ),
                              ].filter(Boolean).join("\n")
                            : undefined
                        }
                      />
                      </>
                    )}

                    {/* Соц кабинета. Стоит на строке каба, потому что вопрос
                        «а это на каком соце» возникает ровно здесь: увидел
                        расход в незнакомом кабинете — и надо знать, куда идти
                        смотреть. Несколько соцев — значит каб виден с
                        нескольких, и это тоже важно знать. */}
                    {n.kind === "account" && n.socials?.length ? (
                      /* Не больше двух: каб бывает виден с пяти соцев, и полный
                         список выдавливал act_id — а он тут главное, его
                         копируют в manage и в Мету. Остальные в подсказке. */
                      /* Полный токен, а не /70: замерено 2.60 при норме 4.5 —
                         id соца читали прищурившись, а это ответ на вопрос
                         «куда идти тушить», ради которого строку и открыли. */
                      /* Имя соца вместо его id — но с потолком по ширине:
                         имя длиннее id, и без него длинное «Keine media buyer
                         3» выдавило бы act_id ровно так же, как раньше это
                         делал пятый соц. Подсказка называет и имя, и id. */
                      <span
                        className="max-w-[180px] flex-none truncate whitespace-nowrap font-mono text-[11px] text-muted-foreground"
                        title={`Ad account visible from ${profileHint(n.socials, profileLabels)}`}
                      >
                        {n.socials.slice(0, 2).map((s) => profileDisplay(s, profileLabels)).join(" · ")}
                        {n.socials.length > 2 ? ` +${n.socials.length - 2}` : ""}
                      </span>
                    ) : null}

                    {/* Возраст и расхождение — на строке КАБИНЕТА. Ниже они
                        повторяли бы одно и то же (объявления каба снимаются
                        одним заходом), а выше это уже не факт о кабинете, а
                        предупреждение — и его несёт подчёркнутая сумма справа. */}
                    {n.kind === "account" ? <StaleMark node={n} /> : null}
                    {n.kind === "account" ? <CheckMark node={n} /> : null}

                    {n.kind === "ad" ? <MethodMark method={n.method} /> : null}
                    {n.kind === "ad" ? <StatusMark status={n.status} /> : null}
                  </div>
                </Cell>

                {visible.map((key) => {
                  /* Тепло — только на строках КРЕО и только в колонках цены.
                     Крео красится общей шкалой среза, кабинет — шкалой СВОЕЙ
                     ветки. Одной на всех тут быть не может: у кабинета цена
                     депа всегда выше, чем у крео (делится на меньшее число), и
                     общей шкалой все развороты уехали бы в красное целиком.
                     А своя шкала по крео была почти вырожденной — кабинеты
                     одного крео лежат кучно, и цвет переставал различать
                     что-либо вовсе. Уровни ниже кабинета не красим: там уже
                     сравнивать не с чем. */
                  const tone = isCreative
                    ? heat[key]?.at(derive(n, key)) ?? null
                    : n.kind === "account"
                      ? branchHeat.get(r.root)?.[key]?.at(derive(n, key)) ?? null
                      : null;
                  const bg = heatTone(tone);
                  /* Спарклайн — только в спенде и только на крео. Ниже подневного
                     ряда просто нет: лес объявлений приходит суммами за окно. */
                  const spark = key === "spend" && isCreative ? n.spark : null;
                  /* Подчёркнутая сумма — вся правда, которая доступна СВЁРНУТОЙ
                     строке. Метка с моментом замера живёт на кабинете, а его
                     надо сначала раскрыть; крео же читают именно свёрнутым, и
                     ровно так $944 и выглядели итогом дня вместо $1516 (#20).
                     Не значок и не цвет цифры: значок на каждой второй строке
                     превращается в шум, а перекрашенная цифра читается как
                     оценка «плохо», хотя речь про доверие, а не про качество.
                     Пунктир под числом — общепринятое «тут есть сноска». */
                  const level = staleLevel(n.stale_gap_s ?? null);
                  const suspect =
                    key === "spend" && (level !== "ok" || !!n.mismatch);
                  /* Подсказка называет и шкалу тоже. На общей шкале низкая
                     горка значит «мало тратит по сравнению с остальными», на
                     своей — только «ровно»: это разные утверждения, и молча
                     сменить одно на другое значит переписать смысл картинки. */
                  const sparkHint = spark
                    ? `daily spend · ${TREND_WORD[spark.trend]} · peak ${money(spark.peak)}` +
                      (spark.bucket > 1 ? ` · 1 point = ${spark.bucket} days` : "") +
                      (spark.shared ? " · height comparable across all rows" : "")
                    : "";
                  return (
                    <Cell
                      key={key}
                      className="relative border-b border-border/60 px-2 py-[5px] text-right text-[12.5px]"
                    >
                      {/* Подложка отдельным слоем ПОД текстом, а не фоном
                          ячейки. Фоном она дралась бы с выделением и ховером
                          — те тоже красят ячейку, и побеждал бы тот, чья
                          утилита в таблице стилей ниже. Слой на -z-0 внутри
                          ячейки не спорит ни с чем и не трогает липкую
                          колонку. Скругление внутреннее, 4px: подложка не
                          должна касаться линий сетки, иначе колонка выглядит
                          залитой, а не подкрашенной. */}
                      {bg && bg !== "transparent" ? (
                        <span
                          aria-hidden
                          className="pointer-events-none absolute inset-x-[3px] inset-y-[2px] rounded-[4px]"
                          style={{ background: bg }}
                        />
                      ) : null}
                      {spark ? <SparkLine spark={spark} /> : null}
                      {/* Подсказка на цифре, а не на картинке: картинка
                          `pointer-events-none`, и наводят всё равно на число.
                          Корзину проговариваем словами — точка шириной в три
                          дня без предупреждения читается как день. */}
                      <span
                        className={cn(
                          "relative",
                          suspect &&
                            "underline decoration-dotted underline-offset-[3px] " +
                              (level === "frozen"
                                ? "decoration-destructive/70"
                                : "decoration-warning/70"),
                        )}
                        title={
                          suspect
                            ? [
                                n.mismatch
                                  ? "Mismatch found against Meta's total for " +
                                    "the ad account."
                                  : "",
                                staleWhy(
                                  isCreative ? "this creative" : "this row",
                                  n.spend_at,
                                  n.stale_gap_s ?? null,
                                  n.stale_spend ?? null,
                                ),
                                sparkHint,
                              ]
                                .filter(Boolean)
                                .join(" · ")
                            : sparkHint || undefined
                        }
                      >
                        {value(n, key)}
                      </span>
                    </Cell>
                  );
                })}
              </Row>
            );
          }}
        </TableBody>

        <TotalsFooter rows={tops} visible={visible} hidden={hiddenCount} />
      </Table>
    </ResizableTableContainer>
  );
}

/** Итог по таблице — прижат к её низу.
 *
 *  Считается по строкам КРЕО (`tops`), а не по всем узлам дерева: кабинеты и
 *  объявления внутри крео — это те же деньги ещё раз, и сумма по всему дереву
 *  была бы кратно завышена.
 *
 *  Берёт ровно то, что на экране: включил гео BD — итог про BD. Иначе строка
 *  спорила бы с таблицей над ней, а спорящей цифре верить нельзя ни одной.
 *
 *  `TableFooter` react-aria, а не свой блок под таблицей: колонки тут те же
 *  самые, поэтому итог не разъезжается ни при перетаскивании границ, ни при
 *  перестановке колонок, ни при горизонтальной прокрутке. Свой блок пришлось
 *  бы синхронизировать руками — и он бы кривился ровно в тот момент, когда
 *  таблицу трогают.
 */
function TotalsFooter({
  rows,
  visible,
  hidden = 0,
}: {
  rows: Node[];
  visible: ColKey[];
  hidden?: number;
}) {
  const t = React.useMemo(() => totalsOf(rows), [rows]);

  /* ИТОГ НАСЛЕДУЕТ НЕЗНАНИЕ СТРОК (#122). Владелец нашёл это на живом листе:
     восемь строк показывали `n/c`, а Total под ними — «0» и прочерк. Человек
     смотрит вниз, читает «0 подписок» и решает, что подписок нет. Их не ноль —
     их НЕ ЗНАЕМ, и починенными оказались только строки.

     Правило здесь ТО ЖЕ, что у строки, и берётся из того же места
     (`колонкаЧитаетВоронку`): второе вычисление разошлось бы с первым, и итог
     снова начал бы говорить не то, что строки над ним. */
  const безВоронки = React.useMemo(
    () => rows.filter((r) => r.funnel_at === null).length,
    [rows],
  );
  const всеБезВоронки = rows.length > 0 && безВоронки === rows.length;
  /* Часть строк дала цифры, часть нет. Молча сложить известное — значит выдать
     заведомо заниженную сумму за итог; это тот же промах, что и ноль вместо
     «не знаем», только тише. */
  const частично = безВоронки > 0 && !всеБезВоронки;

  if (!rows.length) return null;

  return (
    <TableFooter>
      <Row
        /* Обычная строка под таблицей, без прилипания и без тени.
           Липким футер был ровно один заход: на коротком списке он отрывался
           от данных и повисал у низа экрана — читалось как поднявшийся пол,
           а не как итог этих четырёх строк. Отделяем линией и фоном, а не
           слоем поверх. */
        className="border-t border-border-strong bg-subtle"
      >
        <Cell className="sticky left-0 z-10 bg-subtle px-3 py-1.5 text-left align-middle">
          <span className="text-2xs font-semibold uppercase tracking-wide text-muted-foreground">
            Total
          </span>
          {/* «21 of 29», когда часть строк скрыта фильтром. Итог считается по
              показанным — значит обязан сказать, что показано не всё, иначе
              это неверная цифра с уверенным видом. */}
          <span className="tnum ml-1.5 text-2xs text-ghost">
            {hidden > 0
              ? `${rows.length} of ${rows.length + hidden} creatives`
              : `${rows.length} creative${rows.length === 1 ? "" : "s"}`}
          </span>
          {/* Неполнота названа В САМОЙ строке итога, а не под курсором: цифру
              внизу читают последней и на ней останавливаются. */}
          {частично ? (
            <span className="ml-1.5 text-2xs text-warning">
              funnel not collected for {безВоронки} of {rows.length}
            </span>
          ) : null}
        </Cell>

        {visible.map((key) => {
          const def = BY_KEY[key];
          const v = totalCell(t, key);
          const воронка = колонкаЧитаетВоронку(key);
          /* Ни одна строка не дала цифры — итог не ноль, а то же «не собрано»,
             что и в строках. Слово одно и то же намеренно: два разных слова про
             одно состояние читаются как два разных состояния. */
          if (всеБезВоронки && воронка) {
            return (
              <Cell key={key} className="px-2 py-1.5 text-right align-middle">
                <span
                  className="tnum cursor-help text-ghost underline decoration-dotted underline-offset-2"
                  title="Not a single row has funnel data, so there is nothing to add up — this is a gap, not a zero."
                >
                  n/c
                </span>
              </Cell>
            );
          }
          /* У гео итога не бывает — это перечисление, а не число. Пустая
             ячейка честнее прочерка: прочерк читается как «посчитали и вышло
             ничего». */
          const базовый =
            v === undefined
              ? ""
              : def.kind === "money"
                ? money(v)
                : def.kind === "pct"
                  ? pct(v)
                  : num(v);
          /* Сложено НЕ ВСЁ — значит это нижняя граница, и знак ставится только
             там, где направление ошибки известно: у счётчиков воронки
             недостающие строки могут лишь ДОБАВИТЬ. У цены и конверсий
             направление зависит от того, чего именно не хватает, и «≥» на них
             было бы такой же выдумкой, как ноль вместо «не знаем», — поэтому
             там знака нет, а про неполноту говорит строка слева. */
          const text =
            частично && воронка && def.kind === "int" && v != null
              ? нижняяГраница(базовый)
              : базовый;
          return (
            <Cell key={key} className="px-2 py-1.5 text-right align-middle">
              <span className={cn("tnum text-xs font-semibold", v == null && "font-normal text-ghost")}>
                {text}
              </span>
            </Cell>
          );
        })}
      </Row>
    </TableFooter>
  );
}
