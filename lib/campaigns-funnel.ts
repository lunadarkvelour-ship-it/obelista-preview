/**
 * Воронка на листе «Кампании»: колонки, которые НЕ ВРУТ, когда цифр нет.
 *
 * Лист обязан показывать не только структуру и доставку, но и то, ради чего
 * реклама и крутится: сколько подписчиков она принесла и почём. Сопоставление
 * воронки CRM на объекты Меты уже сделано движком (`core/funnel_join.py`, #156)
 * — здесь только показ. Своего сопоставления панель не заводит: два правила на
 * вопрос «чей это подписчик» дали бы разные числа на «Кампаниях» и на
 * «Аналитике», а сверить их было бы нечем.
 *
 * ЛИД В ЭТОЙ ВЕРТИКАЛИ — ПОДПИСЧИК. Слова владельца: «лид это лид. В случае с
 * моей вертикалью и моей интеграцией и funnel данными с срм кеине медиа это
 * вообще подписчик». Не регистрация и не депозит. Имя лида панель НЕ ВЫБИРАЕТ:
 * его отвечает бэкенд полем `lead_metric` (`core/funnel_join.ЛИД`), и читать
 * его надо оттуда. Зашей мы здесь свой `sub` — и в день, когда у другой
 * вертикали лидом станет регистрация, панель молча продолжит звать лидом
 * подписку.
 *
 * ГЛАВНОЕ В ЭТОМ ФАЙЛЕ — ПУСТАЯ ЯЧЕЙКА, А НЕ ЗАПОЛНЕННАЯ
 *
 * Прямо сейчас в облаке НЕТ НИ ОДНОЙ строки воронки: приём из браузера
 * отвергался сервером (403 «запрос с постороннего сайта отклонён») и не
 * работал ни разу; чинит #161. При этом у владельца локально прочитано 39905
 * ПДП и 20872 контакта — то есть данные ЕСТЬ, просто не доехали. Нарисовать в
 * этом положении ноль значит сказать «твоя реклама не принесла ни одного
 * подписчика». Это не «неточность оформления», это противоположное по смыслу
 * утверждение, и принимать по нему решения человек будет всерьёз.
 *
 * Поэтому пустая ячейка здесь — не одно состояние, а ПЯТЬ, и каждое лечится
 * по-своему:
 *
 *   `no_handle`    — демон этого деплоя ещё не умеет отдавать связку;
 *   `never`        — воронка не приезжала НИ РАЗУ (чинится приёмом, #161);
 *   `unknown_ever` — демон не сказал, приезжала ли она когда-нибудь;
 *   `empty_window` — приезжала, но за это окно строк нет;
 *   `ok`           — цифры есть, и тогда пустая ячейка значит уже другое:
 *                    либо CRM не меряет этот шаг, либо про этот объект она за
 *                    окно не присылала ничего, либо имя объекта носят тёзки и
 *                    цифры не приписаны никому.
 *
 * Правило троичности взято не с потолка: ровно так же устроено `funnel_at` на
 * листе «Аналитика» (`lib/analytics.ts`) — строка значит «приезжало», `null` —
 * «не приезжало никогда», отсутствие поля — «демон старше контракта». Один
 * вопрос — один ответ на оба листа.
 *
 * ВСЯ ВОРОНКА ВИДНА ПО УМОЛЧАНИЮ, ПРЯЧЕТ ЕЁ ЧЕЛОВЕК, А НЕ МЫ
 *
 * Слова владельца: «пускай отображаются ВСЕ данные с воронки, и для этого есть
 * кнопка глаза, которая скрывает то, что без спенда найденного. А ВОТ СПЕНД
 * ДОЛЖЕН НАХОДИТЬСЯ АБСОЛЮТНО ВЕСЬ, ЕСЛИ Я ЗАЛИВАЮСЬ С СКИЛЛОМ ОБЕЛИСТЫ».
 *
 * Отсюда три правила, и они важнее удобства:
 *
 *   1. По умолчанию показано ВСЁ, включая воронку, к которой спенд не нашёлся.
 *      Молча отфильтрованная строка — это потерянные подписчики, о которых
 *      человек не узнает никогда: у него просто станет меньше. Поэтому воронка,
 *      не севшая ни на один объект (тёзки и «нет объекта»), приезжает СВОИМИ
 *      строками (`сиротыВоронки`), а не остаётся в подвале отчёта.
 *   2. Глаз — ЕГО выбор в момент просмотра. Наше решение за него — это и есть
 *      «мы посчитали, что тебе это не нужно».
 *   3. Спрятанное ВСЕГДА названо числом, даже когда спрятано. Если залив шёл
 *      скиллом Обелисты, спенд обязан находиться для всего — значит строка без
 *      спенда это НАШ дефект, а не свойство данных. Глаз, за которым молча
 *      лежит наша недоработка, превращает сигнал в удобство, и чинить станет
 *      нечего: поломка перестанет быть видимой.
 *
 * ЧТО ЭТОТ ФАЙЛ НЕ ДЕЛАЕТ: не рисует. Разметка — `components/sections/campaigns/
 * FunnelCells.tsx`, а дерево строк принадлежит `CampaignsView`. Здесь чистые
 * функции: ни сети внутри расчётов, ни DOM.
 */

import { API_BASE, DASH } from "@/lib/analytics";
/* Каталог колонок «Аналитики» — ЖИВОЙ источник ступеней воронки, а не копия.
   Из него же читают таблица того листа, выбор колонок, сортировка и CSV. */
import { BY_KEY, COLUMNS, DEFAULT_VISIBLE, type ColKey } from "@/lib/analytics-columns";
/* Канон воронки — общий на оба листа. Подписи, вид и правила пустоты берутся
   отсюда, а не переписываются: `lib/funnel-metrics`. */
import {
  FUNNEL_BY_ID, divideFunnel, funnelNumber, type FunnelMetricId,
} from "@/lib/funnel-metrics";
import { NoHandle, type Level } from "@/lib/campaigns";
import { периодВЗапрос, type PeriodQuery } from "@/lib/period";
import { guardSession } from "@/lib/session";

/** Ручка связки. Ответ — ровно то, что собирает `core/funnel_join.воронка()`,
 *  плюс `ever_at` (см. `FunnelJoin.ever_at`). */
export const FUNNEL_PATH = "/funnel_join";

/* ── что приезжает ─────────────────────────────────────────────────────────
 *
 * Метрики НЕ ПЕРЕЧИСЛЕНЫ ЗДЕСЬ ПОЛЯМИ, и это не лень. Канон живёт в движке
 * (`core/sources/base.CANON`), и список, переписанный сюда руками, разъедется
 * с ним молча: у трекера появится шаг, движок начнёт его писать, а лист
 * продолжит показывать пять колонок из шести и ни слова об этом не скажет.
 * Поэтому набор колонок строится из `metrics` ОТВЕТА, а метрики в строке
 * читаются по имени.
 */

/** Значение шага воронки. `null` — «источник этот шаг не меряет» (у
 *  `keine_media` так с выручкой), и это НЕ ноль. */
export type FunnelValue = number | null;

/** Строка одного объекта Меты. Метрики лежат по именам из `metrics`. */
export interface FunnelObjectRow {
  level: Level;
  act_id?: string | null;
  /** За сколько дней окна по этому объекту вообще были строки. */
  days?: number | null;
  /** Какими именами он приезжал из CRM. Их может быть несколько: объявление
   *  переименовали, а CRM помнит и старое (`ad_name_history`). */
  names?: string[];
  [metric: string]: unknown;
}

/** То, что НЕ легло ни на один объект. Со своими цифрами, а не счётчиком:
 *  «пять имён мимо» умалчивает, что в них четыре тысячи подписчиков. */
export interface FunnelUnmatchedRow {
  level: Level;
  name: string;
  days?: number | null;
  /** Только у тёзок: кто носит это имя. */
  candidates?: string[];
  [metric: string]: unknown;
}

export type FunnelBucket = "in_scope" | "other_accounts" | "ambiguous" | "no_object";

export interface FunnelJoin {
  ok?: boolean;
  since?: string;
  until?: string;
  act_id?: string | null;
  /** Какой трекер отвечал за это окно. `null` — строк воронки за окно нет
   *  вовсе, и это единственный способ отличить «окно пустое» от «данные есть». */
  tracker?: string | null;
  /** Как зовут лид ЭТОЙ вертикали. Отвечает бэкенд, не вёрстка. */
  lead_metric?: string | null;
  /** Полный набор шагов, которые движок умеет разложить. Порядок канонический. */
  metrics?: string[] | null;
  generated_at?: string | null;
  rows?: Record<string, FunnelObjectRow> | null;
  unmatched?: {
    ambiguous?: FunnelUnmatchedRow[] | null;
    no_object?: FunnelUnmatchedRow[] | null;
  } | null;
  /** Четыре корзины, сумма которых равна окну целиком. */
  totals?: Partial<Record<FunnelBucket, Record<string, FunnelValue>>> | null;
  /** Когда воронка приезжала последний раз ВООБЩЕ — не за окно.
   *
   *  ПОЛЕ КОНТРАКТА, И ОНО ЗДЕСЬ САМОЕ ВАЖНОЕ. Без него «за это окно пусто» и
   *  «не приезжало ни разу» неразличимы, а лечатся они противоположно: первое —
   *  подождать, второе — идти чинить приём. Три значения и три смысла, как у
   *  `funnel_at` на «Аналитике»: строка — приезжало; `null` — не приезжало
   *  никогда; поля нет — демон старше контракта, и мы не знаем даже этого. */
  ever_at?: string | null;
}

/* ── состояние колонок ─────────────────────────────────────────────────── */

export type FunnelState =
  | "no_handle"
  | "never"
  | "unknown_ever"
  | "empty_window"
  | "ok";

/**
 * Почему в колонках пусто — или что они не пусты.
 *
 * ПОРЯДОК ПРОВЕРОК И ЕСТЬ ПРАВИЛО. Цифры за окно перевешивают всё: если
 * трекер за окно отвечал, колонки работают, даже когда демон промолчал про
 * «приезжало ли когда-нибудь». И наоборот — пока цифр нет, панель обязана
 * назвать причину, а не показать пустоту, одинаковую на все случаи.
 */
export function состояниеВоронки(
  resp: FunnelJoin | null,
  опции: { ручкиНет?: boolean } = {},
): FunnelState {
  if (опции.ручкиНет) return "no_handle";
  if (!resp) return "unknown_ever";
  if (resp.tracker) return "ok";
  if (resp.ever_at === null) return "never";
  if (resp.ever_at === undefined) return "unknown_ever";
  return "empty_window";
}

/** Пустая ячейка обязана объясняться словами: молчаливый прочерк в колонке
 *  подписчиков читается как «ноль подписчиков». Текст — для подсказки под
 *  курсором и для плашки над таблицей, поэтому он законченное предложение, а
 *  не обрывок. */
export function объяснениеСостояния(state: FunnelState, resp?: FunnelJoin | null): string {
  switch (state) {
    case "no_handle":
      return "The collector on this deploy cannot join the funnel to Meta objects yet, " +
        "so these columns have nothing to show. Nothing is wrong with your ads.";
    case "never":
      return "No funnel has ever reached this workspace. These columns are empty because " +
        "nothing has arrived — not because nobody subscribed. Connect the intake on the " +
        "Integrations page and the numbers appear here for the days that get pushed.";
    case "unknown_ever":
      return "We do not know whether any funnel has ever arrived, so an empty cell here " +
        "means «we do not know», not «nobody subscribed».";
    case "empty_window":
      return resp?.ever_at
        ? `Funnel data has arrived before — last on ${resp.ever_at} — but nothing covers ` +
          "this period. An empty cell means «nothing was reported for these days», not zero."
        : "Funnel data has arrived before, but nothing covers this period. An empty cell " +
          "means «nothing was reported for these days», not zero.";
    case "ok":
      return "";
  }
}

/** Короткая подпись состояния — для плашки над таблицей. */
export function подписьСостояния(state: FunnelState): string {
  switch (state) {
    case "no_handle": return "Funnel not available on this deploy";
    case "never": return "No funnel has ever arrived";
    case "unknown_ever": return "Funnel arrival unknown";
    case "empty_window": return "No funnel for this period";
    case "ok": return "";
  }
}

/* ── колонки ───────────────────────────────────────────────────────────── */

/* ── ступени: ОДИН источник на два листа ────────────────────────────────────
 *
 * Требование владельца дословно: метрики воронки «ДОЛЖНЫ БЫТЬ ОДИНАКОВЫЕ С
 * ЛИСТОМ CREATIVE ANALYTICS».
 *
 * «Одинаковые» — это НЕ «я посмотрел на тот лист и написал такой же список».
 * Два списка, написанные руками в двух местах, разъезжаются в первый же день,
 * когда кто-то добавит ступень в одном: обе половины при этом правы по
 * отдельности, и расходятся они только в момент встречи — ровно так спенд
 * занизился в сто раз, так `spend_today` чуть не начал значить неделю, так две
 * колонки чуть не назвались `Leads`.
 *
 * Поэтому состав, порядок и подписи ЧИТАЮТСЯ ИЗ ЖИВОГО КАТАЛОГА того листа
 * (`lib/analytics-columns`) — того самого, из которого их берут его таблица,
 * выбор колонок, сортировка и выгрузка в CSV. Не копия и не фикстура: добавят
 * ступень там — она приедет сюда сама, тем же словом и на то же место.
 */

/** Ключи каталога, у которых группа — воронка. Группа объявлена там же, где
 *  колонка, так что «что считать ступенью» решает каталог, а не мы.
 *
 *  Экспортируется затем, что этот же список собирает группу «воронка» в
 *  каталоге колонок «Кампаний» (`lib/campaigns-columns`): состав там не
 *  переписывается, а строится отсюда. */
export function ступениАналитики(): ColKey[] {
  /* Порядок берём с ЭКРАНА, а не из каталога: на экране колонки стоят так, как
     их видит владелец по умолчанию (`DEFAULT_VISIBLE` — воронка сверху вниз, за
     каждой ступенью её цена), а порядок каталога отвечает на другой вопрос —
     куда вставить только что включённую. Хвост — ступени, которых сегодня нет
     в наборе по умолчанию: пропасть они не имеют права. */
  const воронка = (k: ColKey) => BY_KEY[k]?.group === "воронка";
  const наЭкране = DEFAULT_VISIBLE.filter(воронка);
  const остальные = COLUMNS.map((c) => c.key).filter((k) => воронка(k) && !наЭкране.includes(k));
  return [...наЭкране, ...остальные];
}

/** Подпись ступени: сперва ОБЩИЙ КАТАЛОГ ВОРОНКИ, потом сам ключ.
 *
 *  Второго списка подписей здесь больше нет, и это главное в этой функции.
 *  Раньше рядом лежала карта «подписи для ступеней, которых в каталоге
 *  „Аналитики“ нет» — с одной записью, выручкой: тот каталог знал только те
 *  ступени, под которые на его листе завели колонку. Значит подпись ступени
 *  зависела от того, показывает ли её ДРУГОЙ лист, и в день, когда выручку
 *  завели бы там, две подписи начали бы спорить. Теперь канон один
 *  (`lib/funnel-metrics`), и в нём есть все шесть ступеней независимо от того,
 *  кто их сегодня рисует.
 *
 *  Ключ вместо подписи некрасив, но честен: колонка, выброшенная из-за
 *  отсутствия подписи, — это потерянный шаг, который движок уже считает. */
export function подписьШага(metric: string): { title: string; hint: string } {
  const из = FUNNEL_BY_ID[metric as FunnelMetricId];
  if (из) return { title: из.title, hint: из.hint };
  return { title: metric, hint: `funnel step «${metric}» reported by the source` };
}

export interface FunnelColumn {
  metric: string;
  title: string;
  hint: string;
  /** Лид этой вертикали — ровно один. Ставится по ответу бэкенда. */
  lead: boolean;
}

/**
 * Какие колонки показывать.
 *
 * ЧТО ЕСТЬ — отвечает движок (`metrics` ответа): он один знает, какие ступени
 * умеет разложить сегодня. ПОРЯДОК И ПОДПИСИ — отвечает «Аналитика»: те же
 * ступени на двух листах обязаны стоять одинаково и называться одинаково, иначе
 * байер, читающий их подряд, каждый раз спрашивает, одно ли это число.
 *
 * ЛИД НЕ ПЕРЕСТАВЛЯЕТСЯ НАВЕРХ, хотя решение принимают по нему. Порядок задан
 * требованием владельца «одинаковые с Creative Analytics», и своя сортировка
 * здесь была бы ровно тем расхождением, которое мы устраняем; сегодня лид и так
 * стоит первым, потому что первым его поставила «Аналитика». Выделяется он
 * признаком `lead`, а не местом.
 *
 * Метрика, которой «Аналитика» не знает, не выбрасывается: она встаёт хвостом в
 * порядке движка. Колонка с ключом вместо подписи некрасива, а выброшенная —
 * это молчаливо потерянный шаг, который движок уже считает.
 */
export function колонкиВоронки(resp: FunnelJoin | null): FunnelColumn[] {
  const порядок = ступениАналитики() as string[];
  const метрики = resp?.metrics?.length ? resp.metrics : порядок;
  const лид = resp?.lead_metric || "";
  const колонка = (m: string): FunnelColumn => ({ metric: m, ...подписьШага(m), lead: m === лид });
  const поАналитике = порядок.filter((k) => метрики.includes(k));
  const хвост = метрики.filter((m) => !поАналитике.includes(m));
  return [...поАналитике, ...хвост].map(колонка);
}

/* ── ячейка ────────────────────────────────────────────────────────────── */

export type CellKind =
  /** Число, измеренное CRM. Только здесь ноль означает ноль. */
  | "number"
  /** Источник этого шага не меряет вовсе (у `keine_media` — выручка). */
  | "not_measured"
  /** За окно CRM не присылала про этот объект ни строки. */
  | "no_row"
  /** Имя объекта носят несколько объектов: цифры есть, но чьи — неизвестно. */
  | "ambiguous"
  /** Цифр нет вообще, и почему — говорит состояние. */
  | "no_data";

export interface FunnelCell {
  kind: CellKind;
  /** Число только у `number`. У остальных — `null`, и рисовать его нельзя. */
  value: number | null;
  /** Что это значит, законченным предложением. */
  title: string;
  /** Ячейка требует внимания: цифры есть, но не приписаны. */
  warn: boolean;
}

/** Разобранный ответ: индексы, которые считать на каждую ячейку было бы
 *  расточительно, а пересчитывать в разметке — опасно. */
export interface FunnelContext {
  resp: FunnelJoin | null;
  state: FunnelState;
  lead: string;
  /** (уровень, имя) → тёзки.
   *
   *  РАЗДЕЛИТЕЛЬ КЛЮЧА — `\u0000` ESCAPE-ПОСЛЕДОВАТЕЛЬНОСТЬЮ, а не самим
   *  байтом. Нулевой байт в исходнике не ломает продукт — он ломает нашу
   *  способность его читать: git показывает файл как `Bin` и в PR не видно
   *  ни строки кода, `grep` по нему молчит вообще (в том числе тот grep,
   *  которым будут искать поломку), а `file(1)` зовёт его `data`. Сторож —
   *  `lib/__tests__/no-nul-bytes.test.ts`.
   *
   *  Сам разделитель нужен: имя объекта придумал человек, и любой печатный
   *  символ в нём законен. Склей мы ключ через дефис или двоеточие — имя,
   *  содержащее их, дало бы столкновение ключей, то есть чужие цифры в
   *  чужой строке. */
  тёзки: Map<string, FunnelUnmatchedRow>;
}

const ключ = (level: string, name: string) => `${level}\u0000${name}`;

export function подготовить(
  resp: FunnelJoin | null,
  опции: { ручкиНет?: boolean } = {},
): FunnelContext {
  const тёзки = new Map<string, FunnelUnmatchedRow>();
  for (const r of resp?.unmatched?.ambiguous ?? []) тёзки.set(ключ(r.level, r.name), r);
  return {
    resp,
    state: состояниеВоронки(resp, опции),
    lead: resp?.lead_metric || "",
    тёзки,
  };
}

/** Число из строки ответа по имени метрики. Всё, что не конечное число,
 *  считаем «не знаем»: `"12"` строкой или `NaN` в колонке подписчиков — это
 *  поломка, и показывать её как цифру нельзя. Правило одно на всю панель
 *  (`funnelNumber`), здесь только доступ по имени. */
function число(источник: Record<string, unknown> | undefined, metric: string): number | null {
  return funnelNumber(источник?.[metric]);
}

/**
 * Что стоит в ячейке этого объекта по этой метрике.
 *
 * `row` — то немногое, что нужно от строки дерева: чем объект опознаётся у
 * Меты и как он называется. Тип строки кампаний сюда не тянем намеренно: у
 * дерева свой владелец, и он перебирает его форму (#160), а этот расчёт от
 * формы дерева не зависит.
 */
export function ячейкаВоронки(
  ctx: FunnelContext,
  объект: { fb_id: string; level: Level; name?: string | null },
  metric: string,
): FunnelCell {
  if (ctx.state !== "ok") {
    return {
      kind: "no_data",
      value: null,
      title: объяснениеСостояния(ctx.state, ctx.resp),
      warn: false,
    };
  }

  const строка = ctx.resp?.rows?.[объект.fb_id];
  if (строка) {
    const v = число(строка as Record<string, unknown>, metric);
    if (v === null) {
      return {
        kind: "not_measured",
        value: null,
        title: `The source does not measure «${metric}» at all, so this is empty rather ` +
          "than zero.",
        warn: false,
      };
    }
    return { kind: "number", value: v, title: подписьЧисла(строка, metric), warn: false };
  }

  /* Объекта нет в разложении. Два разных случая, и путать их нельзя: тёзки —
     это ЕСТЬ цифры, но они ничьи, а «ни строки» — это CRM про него молчала. */
  const тёзка = объект.name ? ctx.тёзки.get(ключ(объект.level, объект.name)) : undefined;
  if (тёзка) {
    const сколько = число(тёзка as Record<string, unknown>, metric);
    const носители = тёзка.candidates?.length ?? 0;
    return {
      kind: "ambiguous",
      value: null,
      title:
        `«${тёзка.name}» is the name of ${носители || "several"} objects, so the funnel ` +
        `reported for that name is not attributed to any of them` +
        (сколько === null ? "." : ` — ${сколько} held back here.`) +
        " Rename one of them and the numbers land.",
      warn: true,
    };
  }

  return {
    kind: "no_row",
    value: null,
    title: "The CRM reported nothing for this object in this period. Empty, not zero: " +
      "zero would mean it was measured and nobody came.",
    warn: false,
  };
}

/**
 * Число ячейки — или `null`, если числа нет.
 *
 * Для итогов и для арифметики: складывать можно только измеренное. `null` тут
 * покрывает все четыре «не числа» разом (не приезжало, не меряют, про объект
 * молчали, тёзки), и это правильно — ни одно из них не ноль, а разницу между
 * ними человеку объясняет сама ячейка, а не сумма внизу.
 */
export function числоЯчейки(
  ctx: FunnelContext,
  объект: { fb_id: string; level: Level; name?: string | null },
  metric: string,
): number | null {
  const c = ячейкаВоронки(ctx, объект, metric);
  return c.kind === "number" ? c.value : null;
}

function подписьЧисла(строка: FunnelObjectRow, metric: string): string {
  const дней = typeof строка.days === "number" ? строка.days : null;
  const имена = строка.names?.length ? строка.names.join(" · ") : "";
  const части = [`«${metric}» reported by the CRM for this object`];
  if (дней !== null) части.push(`over ${дней} day${дней === 1 ? "" : "s"} of the period`);
  if (имена) части.push(`matched by name: ${имена}`);
  return части.join(", ") + ".";
}

/* ── цена лида ─────────────────────────────────────────────────────────────
 *
 * Считается ЗДЕСЬ, а не в разметке, и по тому же правилу, что `cpc`/`cpm` в
 * `lib/campaigns`: из сумм, а не усреднением по строкам, и в МИНОРНЫХ
 * единицах — делит на сто одно место (`budget`). Два формата денег в одной
 * строке уже стоили нам суммы в сто раз не той.
 */

/** Спенд на один шаг воронки, минорными единицами. `null` — считать не из
 *  чего, и это не ноль: «$0.00 за подписчика» читается как «подписчики
 *  бесплатные», а не как «мы не знаем, сколько их». */
export function ценаШага(spend?: number | null, count?: number | null): number | null {
  return divideFunnel(spend, count);
}

/** Цена лида по ячейке: считается только когда в ячейке настоящее число.
 *  Из `ambiguous` или `no_row` цену выводить нельзя — получилась бы цена,
 *  выведенная из отсутствия. */
export function ценаЛида(ctx: FunnelContext, cell: FunnelCell, spend?: number | null): number | null {
  if (cell.kind !== "number") return null;
  return ценаШага(spend, cell.value);
}

/* ── сколько воронки не легло на объекты ───────────────────────────────── */

export interface FunnelLeftOut {
  /** Лидов у тёзок — цифры есть, но чьи, неизвестно. */
  ambiguous: number | null;
  /** Лидов, чьё имя не носит ни один объект: переименовали или объект удалён. */
  no_object: number | null;
  /** Лидов, легших на объекты ДРУГИХ кабинетов этого арендатора. */
  other_accounts: number | null;
  /** Лидов, легших на объекты этого кабинета. */
  in_scope: number | null;
}

/**
 * Что не попало в колонки. Показывать обязательно.
 *
 * Колонка с числами читается как «вот вся воронка», и человек, у которого
 * четыре тысячи подписчиков уехали в «нет объекта» после переименования
 * кампании, не узнает об этом никогда: у него просто станет меньше. Поэтому
 * итог по четырём корзинам — часть показа, а не отладка.
 */
export function неЛегло(resp: FunnelJoin | null, metric?: string): FunnelLeftOut {
  const м = metric || resp?.lead_metric || "";
  const из = (b: FunnelBucket) => число(resp?.totals?.[b] as Record<string, unknown>, м);
  return {
    ambiguous: из("ambiguous"),
    no_object: из("no_object"),
    other_accounts: из("other_accounts"),
    in_scope: из("in_scope"),
  };
}

/** Фраза про недоехавшее — или пусто, когда всё легло. Пустая строка значит
 *  «сказать нечего», и рисовать плашку в этом случае не надо. */
export function фразаНеЛегло(left: FunnelLeftOut, title: string): string {
  const части: string[] = [];
  if (left.ambiguous) части.push(`${left.ambiguous} on names shared by several objects`);
  if (left.no_object) части.push(`${left.no_object} on names no object carries any more`);
  if (!части.length) return "";
  return `${title} not shown in the columns: ${части.join(", ")}. The funnel reported them, ` +
    "but there is no single object to attribute them to.";
}

/* ── глаз: показывать ли то, к чему спенд не нашёлся ───────────────────────
 *
 * Требование владельца дословно: «пускай отображаются ВСЕ данные с воронки, и
 * для этого есть кнопка глаза, которая скрывает то, что без спенда найденного».
 * То есть по умолчанию видно ВСЁ, а прячет — он.
 */

export type FunnelEye =
  /** Видно всё, включая воронку без найденного спенда. Положение по умолчанию. */
  | "all"
  /** Спрятано то, к чему спенд не нашёлся. Выбор человека, не наш. */
  | "with_spend";

/** ПО УМОЛЧАНИЮ — ВСЁ. Значение вынесено отдельной константой затем, чтобы
 *  случайная правка «пусть по умолчанию чище» была видна в дифе и красила
 *  сторож, а не проезжала как вкусовая. */
export const ГЛАЗ_ПО_УМОЛЧАНИЮ: FunnelEye = "all";

/* Версия в ключе по той же причине, что у колонок «Аналитики»: сохранённое в
   браузере всегда перебивает новый дефолт, и без версии смена умолчания не
   доехала бы ни до кого, кто хоть раз открывал лист. */
export const ГЛАЗ_КЛЮЧ = "obelista-campaigns-funnel-eye-v1";

export function загрузитьГлаз(): FunnelEye {
  if (typeof window === "undefined") return ГЛАЗ_ПО_УМОЛЧАНИЮ;
  try {
    const v = window.localStorage.getItem(ГЛАЗ_КЛЮЧ);
    return v === "with_spend" || v === "all" ? v : ГЛАЗ_ПО_УМОЛЧАНИЮ;
  } catch {
    return ГЛАЗ_ПО_УМОЛЧАНИЮ;
  }
}

export function сохранитьГлаз(v: FunnelEye): void {
  try {
    window.localStorage.setItem(ГЛАЗ_КЛЮЧ, v);
  } catch {
    /* приватный режим — не повод падать */
  }
}

/**
 * Нашёлся ли спенд.
 *
 * НОЛЬ — ЭТО НАЙДЕННЫЙ СПЕНД, а не отсутствие. «Крутилось и не потратило» —
 * измеренный факт, и прятать такую строку под глазом значит прятать рекламу,
 * которая работала бесплатно. Не найден — только `null` и мусор вместо числа.
 */
export function спендНайден(spend?: number | null): boolean {
  return typeof spend === "number" && Number.isFinite(spend);
}

/** Воронка, не севшая ни на один объект этого кабинета. Показывается СВОИМИ
 *  строками — иначе подписчики, уехавшие в «нет объекта» после переименования
 *  кампании, исчезают с экрана совсем. */
export interface FunnelOrphanRow {
  /** Устойчивый ключ строки для разметки. */
  key: string;
  kind: "ambiguous" | "no_object";
  level: Level;
  name: string;
  days?: number | null;
  /** Кто носит это имя — только у тёзок. */
  candidates?: string[];
  /** Метрики по именам, как в ответе. */
  metrics: Record<string, FunnelValue>;
  /** Почему спенда к этой строке нет — законченным предложением. */
  reason: string;
}

/**
 * Воронка без объекта — списком, отсортированным по лиду вниз.
 *
 * Порядок именно такой: сверху то, где потеряно больше всего. Алфавит здесь
 * означал бы, что четыре тысячи подписчиков лежат где-то на третьем экране.
 */
export function сиротыВоронки(resp: FunnelJoin | null): FunnelOrphanRow[] {
  const лид = resp?.lead_metric || "";
  const собрать = (
    список: FunnelUnmatchedRow[] | null | undefined,
    kind: FunnelOrphanRow["kind"],
  ): FunnelOrphanRow[] =>
    (список ?? []).map((r) => {
      const metrics: Record<string, FunnelValue> = {};
      for (const [k, v] of Object.entries(r)) {
        if (typeof v === "number" && k !== "days") metrics[k] = v;
      }
      const носители = r.candidates?.length ?? 0;
      return {
        key: `${kind} ${r.level} ${r.name}`,
        kind,
        level: r.level,
        name: r.name,
        days: typeof r.days === "number" ? r.days : null,
        candidates: r.candidates,
        metrics,
        reason: kind === "ambiguous"
          ? `«${r.name}» is the name of ${носители || "several"} objects at once, so ` +
            "neither the funnel nor the spend can be attributed to one of them. " +
            "Rename one and both land."
          : `No object carries the name «${r.name}» any more — renamed in Ads Manager, ` +
            "or deleted. The funnel arrived under the old name, and there is nothing " +
            "left to attach the spend of.",
      };
    });

  const все = [
    ...собрать(resp?.unmatched?.ambiguous, "ambiguous"),
    ...собрать(resp?.unmatched?.no_object, "no_object"),
  ];
  return все.sort((a, b) => (b.metrics[лид] ?? 0) - (a.metrics[лид] ?? 0));
}

export interface ГлазИтог<T> {
  /** Что показывать при этом положении глаза. */
  видимые: T[];
  /** Сколько строк спрятано. Ноль — прятать было нечего. */
  скрыто: number;
  /** Сколько лида в спрятанном. `null` — лида в этих строках не измеряли. */
  скрытоЛида: number | null;
  /** У скольких спрятанных строк лид НЕ ИЗМЕРЕН.
   *
   *  Считается отдельно затем, что иначе сумма тихо занижает саму себя: три
   *  спрятанные строки и «5520 подписчиков» читаются как «вот всё, что
   *  спрятано», хотя у третьей числа нет вовсе. Это ровно тот молчаливый ноль,
   *  который мы гоняем по всему продукту, — только в счётчике. */
  скрытоБезЛида: number;
}

/**
 * Применить глаз.
 *
 * ВОЗВРАЩАЕТ И СПРЯТАННОЕ ЧИСЛОМ — всегда, в обоих положениях. Счётчик, который
 * появляется только когда что-то спрятано, ничем не отличается от отсутствия
 * счётчика: человек видит его ровно тогда, когда сам всё и спрятал. Здесь
 * наоборот: при открытом глазе число говорит, СКОЛЬКО он спрячет, если нажмёт.
 */
export function применитьГлаз<T>(
  строки: T[],
  eye: FunnelEye,
  есть: { спендНайден: (r: T) => boolean; лид: (r: T) => number | null },
): ГлазИтог<T> {
  const безСпенда = строки.filter((r) => !есть.спендНайден(r));
  let сумма: number | null = null;
  let безЛида = 0;
  for (const r of безСпенда) {
    const v = есть.лид(r);
    if (v === null || !Number.isFinite(v)) {
      безЛида += 1;
      continue;
    }
    сумма = (сумма ?? 0) + v;
  }
  return {
    видимые: eye === "all" ? строки : строки.filter((r) => есть.спендНайден(r)),
    скрыто: безСпенда.length,
    скрытоЛида: сумма,
    скрытоБезЛида: безЛида,
  };
}

/**
 * Фраза про спрятанное — и она НЕ НЕЙТРАЛЬНАЯ, когда прятать есть что.
 *
 * Условие владельца: если залив шёл скиллом Обелисты, спенд обязан находиться
 * для всего. Значит строка без спенда — это наш дефект, а не свойство его
 * данных, и называть её «просто отфильтровано» было бы враньём в свою пользу.
 */
export function фразаГлаза(
  итог: { скрыто: number; скрытоЛида: number | null; скрытоБезЛида?: number },
  eye: FunnelEye,
  leadTitle: string,
): string {
  if (!итог.скрыто) {
    return "Spend was found for every funnel row here — nothing to hide.";
  }
  /* Сумма НАЗЫВАЕТ СВОЙ ОХВАТ. «3 строки, 5520 подписчиков» читается как «вот
     всё спрятанное», хотя у части строк числа нет вовсе, и тогда счётчик тихо
     занижает сам себя — тот же молчаливый ноль, только в счётчике. */
  const немые = итог.скрытоБезЛида ?? 0;
  const хвостСуммы = немые
    ? `, ${немые} of them with no funnel number at all`
    : "";
  const лид = итог.скрытоЛида === null
    ? ""
    : ` (${итог.скрытоЛида} ${leadTitle}${хвостСуммы})`;
  const что = `${итог.скрыто} row${итог.скрыто === 1 ? "" : "s"}${лид}`;
  const хвост = " Uploads made with the Obelista skill are supposed to match spend for " +
    "every row, so this is our defect to fix, not a property of your data.";
  return eye === "with_spend"
    ? `${что} hidden: no spend was found for them.${хвост}`
    : `${что} have no spend found.${хвост}`;
}

/* ── запрос ────────────────────────────────────────────────────────────── */

/** Прочерк тот же, что во всей панели: ячейка воронки не заводит своего. */
export { DASH };

async function запрос<T>(path: string, params: Record<string, string | null>): Promise<T> {
  const url = new URL(API_BASE + path);
  for (const [k, v] of Object.entries(params)) if (v) url.searchParams.set(k, v);
  const r = await fetch(url.toString(), { cache: "no-store" });
  guardSession(r);
  const data = await r.json().catch(() => ({}));
  /* Демон отвечает на незнакомый путь НЕ 404, а `400 {"error": "нет такого
     пути: …"}` — проверено на живом проде. Ловить только код значило бы
     показать человеку нашу внутреннюю русскую фразу в английском интерфейсе
     вместо честного «ручка ещё не выкачена». Признак тот же, что в
     `lib/campaigns`, и класс ошибки тот же — второго заводить нельзя, иначе
     лист начнёт различать «ручки нет» двумя способами. */
  const текст = String((data as { error?: unknown })?.error ?? "");
  if (r.status === 404 || текст.includes("нет такого пути")) throw new NoHandle(path);
  if (!r.ok || (data as { ok?: boolean })?.ok === false) {
    throw new Error(текст || `API ${r.status}`);
  }
  return data as T;
}

export const funnelApi = {
  /** Воронка кабинета за то же окно, каким подписан лист. Период уходит В
   *  ЗАПРОС, а не режется по месту: сумма, которую никто не считал за это
   *  окно, — это не сумма (#154). */
  forAccount: (act_id: string, период?: PeriodQuery | null) =>
    запрос<FunnelJoin>(FUNNEL_PATH, { act_id, ...периодВЗапрос(период) }),
};
