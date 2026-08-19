/**
 * КАНОНИЧЕСКИЙ КАТАЛОГ МЕТРИК ВОРОНКИ — ОДИН НА ВСЮ ПАНЕЛЬ.
 *
 * Требование владельца дословно: метрики воронки «ДОЛЖНЫ БЫТЬ ОДИНАКОВЫЕ С
 * ЛИСТОМ CREATIVE ANALYTICS». «Одинаковые» — это не «я посмотрел на тот лист и
 * написал такой же список»: два списка, написанные руками в двух местах,
 * разъезжаются в первый же день, когда кто-то добавит ступень в одном. Обе
 * половины при этом правы по отдельности, и расходятся они только в момент
 * встречи — ровно так спенд занизился в сто раз, так `spend_today` чуть не
 * начал значить неделю, так две колонки чуть не назвались `Leads`.
 *
 * Поэтому ЗДЕСЬ, и только здесь, объявлено: какие ступени бывают, в каком они
 * порядке, как называются человеку, на каких уровнях объектов имеют смысл, как
 * складываются, чем форматируются, какая у ступени цена и что означает пустая
 * ячейка. Отсюда читают ОБА листа:
 *
 *   • «Creative Analytics» — `lib/analytics-columns` (каталог колонок),
 *     `lib/analytics-tree` (суммы и производные), `lib/analytics-total` (итог),
 *     `lib/analytics-csv` (выгрузка) — все через каталог колонок;
 *   • «Кампании» — `lib/campaigns-funnel` (подписи, состояние, ячейки, цены),
 *     а через него `lib/campaigns-columns`.
 *
 * ИСТОЧНИК ЭТОГО ФАЙЛА — ДВИЖОК, А НЕ ВКУС. Состав и порядок метрик равны
 * `core/sources/base.CANON`, вид (события или деньги) — `core/sources/base.ВИД`.
 * Сверка не обещана комментарием, а сделана тестом, который ЧИТАЕТ эти самые
 * питоновские строки: `lib/__tests__/funnel-metrics.test.ts`. Комментарий не
 * умеет стареть вместе с кодом, а тест умеет краснеть.
 *
 * ЛИД ЗДЕСЬ НЕ ОБЪЯВЛЯЕТСЯ НИКОГДА. Какая из ступеней — лид, отвечает бэкенд
 * полем `lead_metric` (`core/funnel_join.ЛИД`, `core/funnel_join.py:85`), и
 * читать его надо оттуда. Зашей мы здесь свой `sub` — и в день, когда у другой
 * вертикали лидом станет регистрация, панель молча продолжит звать лидом
 * подписку. Константы лида в этом файле нет, и её отсутствие проверяется
 * тестом.
 *
 * ПУСТОТА ЗДЕСЬ НИКОГДА НЕ НОЛЬ. Три помощника внизу (`funnelNumber`,
 * `sumFunnel`, `divideFunnel`) — единственный разрешённый способ превратить
 * что-то приехавшее в число: «не меряют», «не приезжало», «тёзки», «нет
 * знаменателя» дают `null`, а не `0`. Ноль в колонке подписчиков читается как
 * «твоя реклама не принесла никого», и по такому утверждению человек тушит
 * рекламу всерьёз.
 */

/* ── типы ──────────────────────────────────────────────────────────────── */

/** Ступень канона. Порядок объявления — порядок `core/sources/base.CANON`. */
export type FunnelMetricId =
  | "sub" | "contact" | "checkout" | "ftd" | "rd" | "revenue";

/** Что это за метрика — события или деньги (`core/sources/base.ВИД`). От вида
 *  зависит, чем заменяется пустая сумма: штучное «никого не было» — честный
 *  ноль, денежное — прочерк, потому что `keine_media` про выручку не отвечает
 *  вовсе и `0.00` сказал бы «заработали ноль». */
export type FunnelMetricKind = "count" | "money";

/** Уровень объекта, на котором метрика имеет смысл. Совпадает с `NodeKind`
 *  дерева «Аналитики»; `campaign`/`adset`/`ad` — те же, что отдаёт разложение
 *  движка (`core/funnel_join.УРОВНИ` ← `core/crm.GROUPS`). */
export type FunnelLevel = "creative" | "account" | "campaign" | "adset" | "ad";

/** Ключ цены ступени. Соглашение «cp + имя» нарушено уже на второй ступени
 *  (`contact` → `cpcon`), поэтому ключи перечислены, а не выведены шаблоном. */
export type FunnelCostId = "cpsub" | "cpcon" | "cpcheck" | "cpftd" | "cprd";

/** Ключ отношения двух измеренных величин. */
export type FunnelRatioId =
  | "sub_to_contact" | "sub_to_checkout" | "sub_to_ftd" | "sub_to_rd"
  | "clicks_per_ftd";

/** Чем измеряется числитель и знаменатель производной. Кроме ступеней воронки
 *  сюда входят две величины Меты — их считает не CRM, и в канон они не входят. */
export type FunnelOperandId = FunnelMetricId | "spend" | "clicks";

export interface FunnelMetricDef {
  id: FunnelMetricId;
  /** Подпись человеку. Никогда не равна `id`: колонка `ftd` вместо «FTD» — это
   *  «подписи нет», и заметить это на экране некому. */
  title: string;
  /** Что это, словами байера. Идёт в подсказку шапки и во вторую строку
   *  выбора колонок. */
  hint: string;
  kind: FunnelMetricKind;
  /** Складывать ступени МОЖНО: это события, а не уникальные люди. Охват сюда
   *  не попадает по построению — сумма охватов считает человека дважды. */
  aggregation: "sum";
  /** Где метрика имеет смысл. `creative`/`account` есть только у тех ступеней,
   *  которые сворачивает лидерборд; разложение движка живёт на объектах Меты. */
  levels: readonly FunnelLevel[];
  /** Показывается ли на лидерборде «Creative Analytics». Ровно то же, что
   *  `levels.includes("creative")`, и это проверяется тестом — второй источник
   *  правды здесь был бы ошибкой, а не удобством. */
  leaderboard: boolean;
  /** Ключ цены этой ступени — или `null`, если цены у неё не бывает. */
  cost: FunnelCostId | null;
  /** ЧТО ЗНАЧИТ ПУСТАЯ ЯЧЕЙКА этой метрики. Обязательное поле: пустота, не
   *  объяснённая словами, читается как ноль. */
  emptyMeans: string;
}

export interface FunnelDerivedDef {
  id: FunnelCostId | FunnelRatioId;
  title: string;
  hint?: string;
  numerator: FunnelOperandId;
  denominator: FunnelOperandId;
  /** `money` — цена, `pct` — доля (0.39, НЕ 39: на сто умножает форматтер),
   *  `int` — отношение штук к штукам. */
  kind: "money" | "pct" | "int";
  /** Никогда не «сложить и поделить на количество»: среднее от средних врёт
   *  тем сильнее, чем неравномернее строки. Считается ЗАНОВО из сумм. */
  aggregation: "derived";
}

/* ── канон ─────────────────────────────────────────────────────────────── */

/** Уровни, на которых живёт свёртка лидерборда: строку крео и строку кабинета
 *  собирает демон, а не разложение воронки по объектам Меты. */
const УРОВНИ_ЛИДЕРБОРДА: readonly FunnelLevel[] = [
  "creative", "account", "campaign", "adset", "ad",
];

/** Уровни разложения движка: `core/funnel_join.УРОВНИ`, вычисленные из
 *  `core/crm.GROUPS` — кампания, адсет, объявление. Выше них выручка не
 *  сворачивается ни у одного трекера, и обещать её на строке крео было бы
 *  враньём. */
const УРОВНИ_РАЗЛОЖЕНИЯ: readonly FunnelLevel[] = ["campaign", "adset", "ad"];

/**
 * ВЕСЬ КАНОН, В ПОРЯДКЕ ДВИЖКА.
 *
 * Порядок равен `core/sources/base.CANON` — это порядок воронки сверху вниз:
 * подписался → заговорил → начал платить → заплатил → заплатил снова → сколько
 * денег принёс. Подписи и расшифровки взяты у «Creative Analytics», где их
 * выбрал владелец, и переезд сюда их не менял: у `Subs`, `Cont`, `Check`,
 * `FTD`, `RD` они дословно те же, что стояли в `lib/analytics-columns`.
 */
export const FUNNEL_METRICS: readonly FunnelMetricDef[] = [
  {
    id: "sub",
    title: "Subs",
    hint: "subscribers",
    kind: "count",
    aggregation: "sum",
    levels: УРОВНИ_ЛИДЕРБОРДА,
    leaderboard: true,
    cost: "cpsub",
    emptyMeans: "The CRM reported no subscriber row for this object — not that nobody subscribed.",
  },
  {
    id: "contact",
    title: "Cont",
    hint: "contacts — bot conversations",
    kind: "count",
    aggregation: "sum",
    levels: УРОВНИ_ЛИДЕРБОРДА,
    leaderboard: true,
    cost: "cpcon",
    emptyMeans: "The CRM reported no contact row for this object — not that nobody talked to the bot.",
  },
  {
    id: "checkout",
    title: "Check",
    hint: "checkouts started",
    kind: "count",
    aggregation: "sum",
    levels: УРОВНИ_ЛИДЕРБОРДА,
    leaderboard: true,
    cost: "cpcheck",
    emptyMeans: "The CRM reported no checkout row for this object — not that nobody started paying.",
  },
  {
    id: "ftd",
    title: "FTD",
    hint: "first deposits",
    kind: "count",
    aggregation: "sum",
    levels: УРОВНИ_ЛИДЕРБОРДА,
    leaderboard: true,
    cost: "cpftd",
    emptyMeans: "The CRM reported no first deposit for this object — not that nobody deposited.",
  },
  {
    id: "rd",
    title: "RD",
    hint: "repeat deposits",
    kind: "count",
    aggregation: "sum",
    levels: УРОВНИ_ЛИДЕРБОРДА,
    leaderboard: true,
    cost: "cprd",
    emptyMeans: "The CRM reported no repeat deposit for this object — not that nobody came back.",
  },
  {
    /* ВЫРУЧКИ НЕТ НА ЛИДЕРБОРДЕ, И ЭТО НЕ ЗАБЫВЧИВОСТЬ. Строку крео и строку
       кабинета собирает демон из своих свёрток, и денег CRM в них нет вовсе;
       `keine_media` про выручку не отвечает даже на объектах. Колонка,
       заведённая «на всякий случай», показывала бы прочерк всему парку и
       называлась бы при этом Revenue — то есть выглядела бы как «заработали
       ноль». Появится трекер с выручкой — сюда приедет `leaderboard: true`, а
       колонка соберётся сама. */
    id: "revenue",
    title: "Revenue",
    hint: "money the CRM reports for these people",
    kind: "money",
    aggregation: "sum",
    levels: УРОВНИ_РАЗЛОЖЕНИЯ,
    leaderboard: false,
    cost: null,
    emptyMeans: "This source does not measure money at all, so the cell is blank rather than $0.00.",
  },
];

/** Ступень, которая доезжает до лидерборда «Creative Analytics». Тип выведен
 *  ИЗ каталога, а не выписан вторым списком. */
export type LeaderboardFunnelId = Exclude<FunnelMetricId, "revenue">;

export const FUNNEL_BY_ID: Readonly<Record<FunnelMetricId, FunnelMetricDef>> =
  Object.fromEntries(FUNNEL_METRICS.map((m) => [m.id, m])) as
    Record<FunnelMetricId, FunnelMetricDef>;

/** Порядок ступеней канона — тот же, что в `FUNNEL_METRICS`. */
export const FUNNEL_IDS: readonly FunnelMetricId[] = FUNNEL_METRICS.map((m) => m.id);

/** Ступени лидерборда в порядке канона. */
export const LEADERBOARD_FUNNEL_IDS: readonly LeaderboardFunnelId[] =
  FUNNEL_METRICS.filter((m) => m.leaderboard).map((m) => m.id as LeaderboardFunnelId);

/** Ступень → ключ её цены. Выведена ИЗ каталога: держать вторую карту рядом
 *  значит завести второго писателя одной договорённости. */
export const FUNNEL_COST_BY_STEP: Readonly<Record<FunnelMetricId, FunnelCostId | null>> =
  Object.fromEntries(FUNNEL_METRICS.map((m) => [m.id, m.cost])) as
    Record<FunnelMetricId, FunnelCostId | null>;

/* ── производные ───────────────────────────────────────────────────────── */

/**
 * Цены и отношения — ОДНИМ СПИСКОМ на всю панель.
 *
 * Пары «что делим на что» до этого файла жили в трёх местах разом: `derive()`
 * дерева, `totalsOf()` итога и `ЦЕНА_ШАГА` «Кампаний». Три `switch`, каждый со
 * своим порядком и своей опечаткой в перспективе; расходятся такие места
 * молча — цена ступени просто перестаёт совпадать с самой собой на соседнем
 * листе, и сказать об этом некому.
 *
 * Порядок здесь — канонический (цены по порядку ступеней, потом отношения). На
 * ЭКРАНЕ порядок другой, и он принадлежит листу: `lib/analytics-columns`
 * выкладывает колонки так, как их расставил владелец.
 */
export const FUNNEL_DERIVED: readonly FunnelDerivedDef[] = [
  { id: "cpsub", title: "CPSub", hint: "spend / subs", numerator: "spend", denominator: "sub", kind: "money", aggregation: "derived" },
  { id: "cpcon", title: "CPCon", hint: "spend / contacts", numerator: "spend", denominator: "contact", kind: "money", aggregation: "derived" },
  { id: "cpcheck", title: "CPCheck", hint: "spend / checkouts", numerator: "spend", denominator: "checkout", kind: "money", aggregation: "derived" },
  { id: "cpftd", title: "CPFTD", hint: "spend / FTD", numerator: "spend", denominator: "ftd", kind: "money", aggregation: "derived" },
  { id: "cprd", title: "CPRD", hint: "spend / repeat deposits", numerator: "spend", denominator: "rd", kind: "money", aggregation: "derived" },

  /* Конверсии — ДОЛЕЙ (0.39), а не процентом: ровно так их ждёт форматтер
     `pct`, который сам умножает на сто. Умножение здесь давало вторую сотню —
     на экране стояло 5670% там, где строки показывали 39–73%. */
  { id: "sub_to_contact", title: "Sub→Cont", numerator: "contact", denominator: "sub", kind: "pct", aggregation: "derived" },
  { id: "sub_to_checkout", title: "Sub→Check", numerator: "checkout", denominator: "sub", kind: "pct", aggregation: "derived" },
  { id: "sub_to_ftd", title: "Sub→FTD", numerator: "ftd", denominator: "sub", kind: "pct", aggregation: "derived" },
  { id: "sub_to_rd", title: "Sub→RD", numerator: "rd", denominator: "sub", kind: "pct", aggregation: "derived" },

  { id: "clicks_per_ftd", title: "Clicks/FTD", hint: "clicks per deposit", numerator: "clicks", denominator: "ftd", kind: "int", aggregation: "derived" },
];

export const FUNNEL_DERIVED_BY_ID:
  Readonly<Record<FunnelCostId | FunnelRatioId, FunnelDerivedDef>> =
  Object.fromEntries(FUNNEL_DERIVED.map((d) => [d.id, d])) as
    Record<FunnelCostId | FunnelRatioId, FunnelDerivedDef>;

/** Все ключи цен — в каноническом порядке ступеней. */
export const FUNNEL_COST_IDS: readonly FunnelCostId[] =
  FUNNEL_DERIVED.filter((d) => d.kind === "money").map((d) => d.id as FunnelCostId);

/* ── ПУСТОТА НИКОГДА НЕ НОЛЬ ───────────────────────────────────────────── */

/**
 * Число — или `null`. Единственный разрешённый способ достать величину.
 *
 * Всё, что не конечное число, — «не знаем»: `"12"` строкой, `NaN`, `undefined`,
 * `null`. Строка в колонке подписчиков это поломка приёма, и показывать её как
 * цифру нельзя; `NaN` — поломка расчёта, и он тем более не ноль. А вот
 * настоящий `0` остаётся нулём: «крутилось и не привело никого» — измеренный
 * факт, и стирать его в прочерк значит терять сигнал.
 */
export function funnelNumber(v: unknown): number | null {
  return typeof v === "number" && Number.isFinite(v) ? v : null;
}

/**
 * Сумма, которая отличает «нигде не было числа» от нуля (#122).
 *
 * Владелец нашёл это на живом листе: восемь строк показывали «не собрано», а
 * строка Total под ними — «0». Человек смотрит вниз, читает «0 подписок» и
 * решает, что подписок нет. Их не ноль — их НЕ ЗНАЕМ. Хоть один вклад — число,
 * ни одного — `null`.
 */
export function sumFunnel(values: Iterable<unknown>): number | null {
  let было = false;
  let acc = 0;
  for (const v of values) {
    const n = funnelNumber(v);
    if (n === null) continue;
    было = true;
    acc += n;
  }
  return было ? acc : null;
}

/**
 * Деление, честное к нулю: нет знаменателя — нет числа, а не бесконечность и
 * не ноль. Ноль здесь читался бы как «бесплатно».
 *
 * Знаменатель `<= 0` даёт прочерк намеренно: ноль бывает двух сортов —
 * «связка не показывалась» и «рост съеден пересчётом трекера вниз», — и в обоих
 * цена не определена. Отрицательный знаменатель встречается на живых дневных
 * приростах, и без этой проверки крео с минусом заняло бы первое место в
 * сортировке «дешевле выше».
 */
export function divideFunnel(a: unknown, b: unknown): number | null {
  const чис = funnelNumber(a);
  const зн = funnelNumber(b);
  if (чис === null || зн === null || зн <= 0) return null;
  return чис / зн;
}

/** Посчитать производную по её описанию из набора уже измеренных величин.
 *  Один расчёт на строку дерева, на итог таблицы и на что угодно дальше. */
export function deriveFunnel(
  def: FunnelDerivedDef,
  источник: Partial<Record<FunnelOperandId, unknown>>,
): number | null {
  return divideFunnel(источник[def.numerator], источник[def.denominator]);
}
