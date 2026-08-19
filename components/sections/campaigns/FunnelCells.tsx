/* Ячейки воронки в строке дерева «Кампаний» и плашка над таблицей.
 *
 * ЗАЧЕМ ОТДЕЛЬНЫМ ФАЙЛОМ, А НЕ КУСКОМ `CampaignsView`. Дерево строк
 * принадлежит другому владельцу и переписывается целиком (#160): колонка,
 * вписанная внутрь его разметки, конфликтует с каждой его правкой. Здесь —
 * только содержимое ячейки, а место под неё в строке даёт дерево. Граница
 * ровно по вопросу «что значит эта цифра»: он мой, а «где она стоит» — его.
 *
 * ПОЧЕМУ ЯЧЕЙКА УМЕЕТ БЫТЬ ПУСТОЙ ПЯТЬЮ РАЗНЫМИ СПОСОБАМИ — в шапке
 * `lib/campaigns-funnel.ts`. Здесь важно одно: НИ В ОДНОМ из них не рисуется
 * ноль. Прямо сейчас в облаке нет ни одной строки воронки (приём чинится в
 * #161), а у владельца локально прочитано 39905 ПДП — то есть ноль в колонке
 * подписчиков был бы не «пусто», а прямая неправда о его рекламе.
 *
 * Ширина колонок и `tnum` — те же, что у соседних числовых колонок листа:
 * цифры в таблице обязаны стоять столбиком, иначе их не сравнить глазом.
 */

import { Fragment } from "react";
import { AlertTriangle, Eye, EyeOff, Info } from "lucide-react";
import { DASH, money, num } from "@/lib/analytics";
import { budget, LEVEL_LABEL } from "@/lib/campaigns";
import {
  объяснениеСостояния,
  подписьСостояния,
  фразаГлаза,
  фразаНеЛегло,
  ценаЛида,
  type FunnelCell,
  type FunnelColumn,
  type FunnelContext,
  type FunnelEye,
  type FunnelLeftOut,
  type FunnelOrphanRow,
} from "@/lib/campaigns-funnel";
import { cn } from "@/lib/utils";

/** Ширина числовой колонки листа. Одно число на весь файл: колонка шапки и
 *  колонка строки, разъехавшиеся на два пикселя, дают лесенку на всю таблицу. */
export const FUNNEL_COL = "w-[76px]";

/** Шапка одной колонки воронки. Лид выделен, потому что решение принимают по
 *  нему: остальные ступени объясняют, ПОЧЕМУ он такой. */
export function FunnelHeadCell({ col }: { col: FunnelColumn }) {
  return (
    <span
      className={cn(
        "label hidden flex-none text-right sm:block",
        FUNNEL_COL,
        col.lead ? "text-foreground" : "text-faint",
      )}
      title={col.hint}
    >
      {col.title}
    </span>
  );
}

/**
 * Одна ячейка. Число — только когда оно измерено; во всех остальных случаях
 * прочерк с объяснением под курсором.
 *
 * Тёзки красятся, остальная пустота — нет. Разница не в вежливости: у тёзок
 * цифры ЕСТЬ и они не приписаны никому, то есть это чинится (переименовать), и
 * человек об этом узнать обязан. Раскрасить же «данные не приезжали» значило бы
 * покрасить весь лист целиком в тот день, когда приём не работает, — а
 * постоянная тревога ничего не сообщает.
 */
export function FunnelValueCell({ cell }: { cell: FunnelCell }) {
  return (
    <span
      className={cn(
        "tnum hidden flex-none text-right text-[12px] sm:block",
        FUNNEL_COL,
        cell.kind === "number" ? "text-foreground"
          : cell.warn ? "text-warning"
          : "text-faint",
      )}
      title={cell.title}
    >
      {cell.kind === "number" ? num(cell.value) : cell.warn ? "≠" : DASH}
    </span>
  );
}

/** Цена шага воронки. Отдельной ячейкой, потому что «сколько» и «почём» —
 *  разные вопросы, и байер читает их парой (тот же порядок, что на
 *  «Аналитике»: ступень, сразу за ней её цена). */
export function FunnelCostCell({
  ctx, cell, spend, currency,
}: {
  ctx: FunnelContext;
  cell: FunnelCell;
  spend?: number | null;
  currency?: string | null;
}) {
  const минорные = ценаЛида(ctx, cell, spend);
  const сумма = budget(минорные, currency);
  return (
    <span
      className={cn("tnum hidden flex-none text-right text-[12px] text-muted-foreground sm:block", FUNNEL_COL)}
      title={
        сумма != null
          ? "Spend of this period divided by what the funnel reported for it."
          : cell.kind === "number"
            ? "Nothing was reported for this step, so there is no price to divide by."
            : "No number to divide by — see the funnel cell next to this one."
      }
    >
      {сумма != null ? money(сумма) : DASH}
    </span>
  );
}

/**
 * Плашка над таблицей: почему колонки пусты, или что часть воронки в них не
 * попала. Пусто — плашки нет вовсе.
 *
 * Она обязана стоять ОДИН раз сверху, а не повторяться в каждой строке:
 * причина у всех строк одна, и сто одинаковых предупреждений человек
 * перестаёт читать после третьего.
 */
export function FunnelNotice({
  ctx, left, leadTitle,
}: {
  ctx: FunnelContext;
  left?: FunnelLeftOut | null;
  leadTitle?: string;
}) {
  if (ctx.state !== "ok") {
    return (
      <div
        role="status"
        className="flex items-start gap-2 rounded-lg border border-warning/40 bg-warning-soft px-3 py-2"
      >
        <Info className="mt-px size-3.5 flex-none text-warning" strokeWidth={1.8} aria-hidden />
        <p className="text-xs leading-relaxed">
          <span className="font-medium">{подписьСостояния(ctx.state)}</span>{" "}
          <span className="text-muted-foreground">{объяснениеСостояния(ctx.state, ctx.resp)}</span>
        </p>
      </div>
    );
  }

  const фраза = left ? фразаНеЛегло(left, leadTitle || "Funnel") : "";
  if (!фраза) return null;
  return (
    <div
      role="status"
      className="flex items-start gap-2 rounded-lg border border-warning/40 bg-warning-soft px-3 py-2"
    >
      <AlertTriangle className="mt-px size-3.5 flex-none text-warning" strokeWidth={1.8} aria-hidden />
      <p className="text-xs leading-relaxed text-muted-foreground">{фраза}</p>
    </div>
  );
}

/**
 * Кнопка-глаз и счётчик спрятанного.
 *
 * СЧЁТЧИК СТОИТ РЯДОМ ВСЕГДА, А НЕ ТОЛЬКО КОГДА СПРЯТАНО. Требование владельца:
 * при заливе скиллом Обелисты спенд обязан находиться для всего, значит строка
 * без спенда — наш дефект. Счётчик, который виден только в закрытом положении,
 * прячет этот дефект ровно от того, кто должен его чинить: открыл глаз — и
 * «всё в порядке, ничего не спрятано».
 *
 * Число само по себе тоже не молчит: `title` говорит, чей это дефект, а не
 * ограничивается «отфильтровано N строк».
 */
export function FunnelEyeToggle({
  eye, скрыто, скрытоЛида, скрытоБезЛида = 0, leadTitle, onChange,
}: {
  eye: FunnelEye;
  скрыто: number;
  скрытоЛида: number | null;
  /** Сколько спрятанных строк без числа лида — чтобы сумма рядом не выглядела
   *  полной, будучи частичной. */
  скрытоБезЛида?: number;
  leadTitle?: string;
  onChange: (v: FunnelEye) => void;
}) {
  const фраза = фразаГлаза({ скрыто, скрытоЛида, скрытоБезЛида }, eye, leadTitle || "leads");
  const прячется = eye === "with_spend";
  return (
    <div className="flex items-center gap-2">
      <button
        type="button"
        onClick={() => onChange(прячется ? "all" : "with_spend")}
        aria-pressed={прячется}
        title={
          прячется
            ? "Showing only rows whose spend was found. Click to show everything again."
            : "Showing everything, including funnel rows with no spend found. " +
              "Click to hide those."
        }
        className={cn(
          "focus-ring inline-flex items-center gap-1.5 rounded-md border px-2 py-1 text-[11.5px]",
          прячется
            ? "border-border bg-elevated text-foreground"
            : "border-border text-muted-foreground hover:text-foreground",
        )}
      >
        {прячется ? <EyeOff className="size-3.5" aria-hidden /> : <Eye className="size-3.5" aria-hidden />}
        {прячется ? "with spend only" : "all funnel"}
      </button>

      {/* Число — не украшение кнопки, а состояние продукта, поэтому оно живёт
          снаружи кнопки и читается даже когда глаз открыт. */}
      <span
        className={cn("text-[11.5px]", скрыто ? "text-warning" : "text-faint")}
        title={фраза}
      >
        {скрыто
          ? `${num(скрыто)} without spend${скрытоЛида === null ? "" : ` · ${num(скрытоЛида)} ${leadTitle || "leads"}`}`
          : "all rows have spend"}
      </span>
    </div>
  );
}

/**
 * Строка воронки, которой не досталось объекта Меты.
 *
 * ПОЧЕМУ ОНА ВООБЩЕ РИСУЕТСЯ. «Пускай отображаются ВСЕ данные с воронки» —
 * прямое требование владельца. Воронка, не севшая ни на что, — это не отход
 * производства, а его подписчики: четыре тысячи ПДП, уехавшие в «нет объекта»
 * после переименования кампании, при молчаливой фильтрации просто исчезают, и
 * узнать об этом неоткуда.
 *
 * Спенда у такой строки нет и быть не может, поэтому в его колонке стоит
 * прочерк с объяснением, а не ноль.
 */
export function FunnelOrphanTreeRow({
  row, columns,
}: {
  row: FunnelOrphanRow;
  columns: FunnelColumn[];
}) {
  return (
    <div className="flex items-center gap-2 border-t border-border bg-warning-soft/30 px-3 py-1.5">
      {/* Тем же словарём, что дерево (`LEVEL_LABEL`), а не сырым `row.level`:
          полное «campaign» шире этой колонки и налезает на имя. Поймано
          глазами на снимке — тест видел узел и верный текст. */}
      <span className="label w-12 flex-none text-faint">{LEVEL_LABEL[row.level]}</span>
      <span className="min-w-0 flex-1 truncate text-[12.5px] text-muted-foreground" title={row.reason}>
        {row.name}
        <span
          className="label ml-1.5 rounded-[3px] bg-warning-soft px-1 py-px text-warning"
          title={row.reason}
        >
          {row.kind === "ambiguous" ? "shared name" : "no object"}
        </span>
      </span>

      {/* Спенд. Прочерк, а не ноль: объекта нет, и тратить было некому. */}
      <span
        className="tnum w-20 flex-none text-right text-[12px] text-faint"
        title={row.reason}
      >
        {DASH}
      </span>

      {columns.map((c) => {
        const v = row.metrics[c.metric];
        return (
          <Fragment key={c.metric}>
            <span
              className={cn(
                "tnum hidden flex-none text-right text-[12px] sm:block",
                FUNNEL_COL,
                typeof v === "number" ? "text-foreground" : "text-faint",
              )}
              title={
                typeof v === "number"
                  ? `${c.title}: reported by the CRM under this name. ${row.reason}`
                  : `The source does not measure «${c.metric}» at all.`
              }
            >
              {typeof v === "number" ? num(v) : DASH}
            </span>
            {/* Место под цену лида держится и здесь. Без него строка без объекта
                съезжает на колонку влево, и её подписчики встают под чужим
                заголовком — цифра, подписанная не тем словом, хуже пустоты. */}
            {c.lead ? (
              <span
                className={cn("tnum hidden flex-none text-right text-[12px] text-faint sm:block", FUNNEL_COL)}
                title="No spend to divide by: this funnel is not attached to any object."
              >
                {DASH}
              </span>
            ) : null}
          </Fragment>
        );
      })}
    </div>
  );
}
