/* Кабинеты, сгруппированные по Business Manager — данные для листа «Agencies».
 *
 * Слово «agency» в проекте уже занято: это тег нейминга агентства (`hiu`,
 * `spx`, см. `AdRow.agency` в `analytics.ts` и `tagForProfile` в `groups.ts`),
 * он привязан к соцу и к Business Manager отношения не имеет. Здесь речь про
 * BM из `SnapshotAccount.business` — площадку Меты, которой принадлежит каб.
 * Поэтому весь этот модуль — только `business`/`bm`, ни одного `agency*`.
 *
 * Строки кабинетов сюда приезжают уже готовыми из `accountRows()`
 * (`account-rows.ts`) — этот модуль их не собирает заново, а только
 * группирует по `row.acc.business` и складывает итоги по группе. Отсюда два
 * следствия, которые здесь не чинятся, а только фиксируются в комментарии:
 *
 *  - `row.acc` берётся от САМОГО СВЕЖЕГО соца, а `row.profile` — от главного
 *    (годного к заливу), и это могут быть разные профили
 *    (`account-rows.ts:139-149`). Значит и `business`, который мы здесь
 *    группируем, — тоже от свежего соца, а не обязательно от того, что видно
 *    в колонке profile рядом. Для самой группировки это не проблема (данные о
 *    БМ вернее у свежего), но если кто-то удивится несовпадению — расхождение
 *    отсюда, а не из бага.
 *
 *  - Имена БМ сырые и НЕ парсятся: `Barnes George 06 08 2026 14 20 22» похоже
 *    на закупочную партию по дате, но вытащить из неё «настоящее» имя значит
 *    придумать факт, которого в данных нет (иссус #35 «панель не врёт»).
 *    Группа показывает `business` как есть.
 *
 * Ревью PR добавило сюда два правила, оба подтверждены на живом снапшоте:
 *
 *  - **Деньги складываются ТОЛЬКО внутри одной валюты.** Живой снапшот несёт
 *    каб с `currency=VND`; наивная сумма `spent`-чисел без взгляда на
 *    `SnapshotAccount.currency` превратила бы его донги в доллары как есть —
 *    курс там порядка 25000:1, и первый же ненулевой VND-спенд разнёс бы
 *    тотал. Курсов у нас нет и придумывать их нельзя: честное «не сложили»
 *    лучше выдуманного пересчёта. Поэтому в `spendUsd`/`limitUsd` идут только
 *    кабинеты основной валюты, а сколько и в каких валютах осталось за
 *    бортом — отдельными полями, не молчком.
 *
 *  - **Статус — четыре корзины СЛОЖЕНИЕМ, не «остальное» вычитанием.**
 *    `banned = cabs - live` завтра прибьёт к «бану» любой статус, который
 *    сегодня не ACTIVE, — в живом снапшоте это 8 кабов с `UNSETTLED`
 *    (биллинг, не бан). Источник классификации — та же `statusMeta`, что
 *    красит точку статуса на строке кабинета (`health-bits.tsx:20-37`):
 *    два независимых классификатора одного и того же поля рано или поздно
 *    расходятся, и раскрытая группа с шапкой «бан» поверх жёлтой точки
 *    «биллинг» — ровно то расхождение, которое уже случилось.
 */
import { statusMeta } from "@/components/sections/health-bits";
import type { AccountRow } from "./account-rows";
import type { SnapshotAccount } from "./types";

/** Единственная валюта, которую этот модуль СКЛАДЫВАЕТ в `spendUsd`/`limitUsd`.
 *  Не «валюта по умолчанию, потому что так удобнее» — это тот же дефолт, на
 *  котором стоит вся остальная панель: `usd()`-форматирование с символом `$`
 *  везде и без альтернативы (`AccountsView.tsx`, `AnalyticsView.tsx`). Кабинет
 *  без указанной валюты трактуется как эта же — иначе пришлось бы исключать
 *  из суммы большинство парка только потому, что поле `currency` не всегда
 *  заполнено сборщиком, а это не то же самое, что «валюта не доллар». */
const PRIMARY_CURRENCY = "USD";

function currencyOf(v: string | undefined): string {
  const c = (v || "").trim().toUpperCase();
  return c || PRIMARY_CURRENCY;
}

/** Число из значения снапшота — то число, то строка с валютой («1.96 USD»).
 *  `null`, когда распарсить нечего: вызывающий решает, показать «—» или
 *  считать нулём, это разные ответы на разные вопросы.
 *
 *  Экспортирована и переиспользуется в `AgenciesView.tsx` (импортом, не
 *  копией) — тот же самый regex раньше был там дублирован. Копий этой
 *  функции в проекте всё равно две, а не одна: вторая — приватная `money()` в
 *  `AccountsView.tsx`, её трогать нельзя, и общего файла ниже уровня `lib/`
 *  для них двоих в границах этого PR нет. */
export function parseMoney(v: string | number | undefined | null): number | null {
  if (v === undefined || v === null || v === "") return null;
  if (typeof v === "number") return Number.isFinite(v) ? v : null;
  const m = String(v).replace(",", ".").match(/-?\d+(\.\d+)?/);
  if (!m) return null;
  const n = Number(m[0]);
  return Number.isFinite(n) ? n : null;
}

/** Кабинеты одного Business Manager + подсчитанные по ним итоги. */
export interface BusinessGroup {
  /** `business` как в снапшоте, обрезаны только края пробелов — сам текст не
   *  трогаем. Для группы без БМ — пустая строка, смотри `noBusiness`. */
  business: string;
  /** `business` состоит только из цифр — значит это id, а не имя (см.
   *  комментарий у `SnapshotAccount.business` в `types.ts:184`). UI обязан
   *  показать это отдельно, а не выдать цифры за название. */
  isId: boolean;
  /** Кабинеты вовсе без БМ. Отдельная группа-хвост, а не спрятанная и не
   *  слитая с именованными: у части кабов снапшот не знает БМ, и это факт про
   *  данные, а не дырка в группировке. */
  noBusiness: boolean;
  rows: AccountRow[];
  cabs: number;
  /** `statusMeta(status).label === "active"`. */
  live: number;
  /** `label === "disabled"` (ACTIVE-статусы `DISABLED`/`PENDING_CLOSURE`) —
   *  то же самое, что красная точка статуса на строке кабинета. Не включает
   *  биллинг: `UNSETTLED` красится жёлтым и в бан не идёт. */
  banned: number;
  /** `label === "billing"` (`UNSETTLED`/`IN_GRACE_PERIOD`) — жёлтая точка
   *  «биллинг», а не бан. Раньше сюда не было отдельного поля вовсе: 8 таких
   *  кабов на живом снапшоте считались `cabs - live`, то есть баном. */
  billing: number;
  /** Всё остальное: `label === "review"` (риск-ревью Меты) и любой статус,
   *  которого `statusMeta` не знает вовсе — в т.ч. тот, что Мета заведёт
   *  завтра. НЕ сливается ни с `banned`, ни с `billing`: новый статус не
   *  обязан быть бывшим кабинетом. `live + banned + billing + other === cabs`
   *  всегда, потому что каждый кабинет считается ровно в одну корзину
   *  сложением, а не выводится вычитанием остатка. */
  other: number;
  /** Сумма `spent`, ТОЛЬКО по кабинетам `PRIMARY_CURRENCY`. `null` — ни один
   *  кабинет группы суммы не дал, и это НЕ ноль: ноль означал бы «не тратили». Кабинеты в другой
   *  валюте в сумму не идут — курсов у нас нет, а сложить доллары с донгами
   *  как одно число значит наврать числом. Что осталось за бортом —
   *  `excludedCurrencyCabs`/`excludedCurrencies`. */
  spendUsd: number | null;
  /** Сумма дневного лимита той же дисциплиной, что `spendUsd`. */
  limitUsd: number | null;
  /** Кабинетов ОСНОВНОЙ валюты, чью сумму разобрать не удалось: поля нет,
   *  оно пустое или в нём не число.
   *
   *  Отдельными числами, а не спрятанными в сумму, потому что итог, в котором
   *  часть строк не сложена, выглядит полным. Тот, кто рисует группу, обязан
   *  сказать «не собрано у N из M» — ровно теми же словами, что стоят в самих
   *  строках: два разных слова про одно состояние читаются как два состояния. */
  spendUnknown: number;
  limitUnknown: number;
  /** Кабинетов группы, чья валюта — не `PRIMARY_CURRENCY`, и поэтому они не
   *  вошли в `spendUsd`/`limitUsd`. 0, если валюта у всех совпала (или не
   *  была указана — см. `currencyOf`). */
  excludedCurrencyCabs: number;
  /** Какие валюты остались за бортом, отсортировано — для подсказки в UI.
   *  Пусто при `excludedCurrencyCabs === 0`. */
  excludedCurrencies: string[];
  /** Сколько кабинетов группы имеют способ оплаты (`funding`). */
  withCard: number;
  /** Разных id пикселей по всей группе: `Set`, а не сумма списков — пиксель,
   *  повторяющийся на двух кабах, считается один раз. */
  pixels: number;
}

function summarize(business: string, rows: AccountRow[], noBusiness: boolean): BusinessGroup {
  const pixelIds = new Set<string>();
  const excludedCurrencies = new Set<string>();
  let live = 0;
  let banned = 0;
  let billing = 0;
  let other = 0;
  /* НАЧИНАЕМ С «НЕ ЗНАЕМ», А НЕ С НУЛЯ. Ноль — это утверждение («не потрачено»),
     и если ни один кабинет группы суммы не дал, ноль здесь означал бы, что мы
     её посчитали. Первое же сложение превращает `null` в число. */
  let spendUsd: number | null = null;
  let limitUsd: number | null = null;
  let spendUnknown = 0;
  let limitUnknown = 0;
  let withCard = 0;
  let excludedCurrencyCabs = 0;

  for (const r of rows) {
    // Сложением в одну из четырёх корзин, а не вычитанием остатка — иначе
    // любой статус вне ACTIVE молча стал бы «баном», что и было блокером.
    const label = statusMeta(r.acc.status).label;
    if (label === "active") live++;
    else if (label === "disabled") banned++;
    else if (label === "billing") billing++;
    else other++;

    if (currencyOf(r.acc.currency) === PRIMARY_CURRENCY) {
      /* `?? 0` НА ВХОДЕ В СЛОЖЕНИЕ ЗДЕСЬ И ЖИЛ. Он гасит «не знаем» ДО того,
         как сумма сложилась, и дальше отличить посчитанный ноль от
         несложенного нечем: итог агентства молча оказывается ниже правды.
         Та же болезнь и та же форма, что владелец увидел на строке Total в
         аналитике (#122, разбор в `totals-inherit-silence.test.ts`).
         Теперь незнание доезжает до итога отдельным числом. */
      const spent = parseMoney(r.acc.spent);
      if (spent === null) spendUnknown += 1;
      else spendUsd = (spendUsd ?? 0) + spent;

      const limit = parseMoney(r.acc.limit);
      if (limit === null) limitUnknown += 1;
      else limitUsd = (limitUsd ?? 0) + limit;
    } else {
      excludedCurrencyCabs++;
      excludedCurrencies.add(currencyOf(r.acc.currency));
    }

    if (r.acc.funding) withCard++;
    for (const p of r.acc.pixels || []) pixelIds.add(p.id);
  }

  return {
    business,
    isId: /^\d+$/.test(business),
    noBusiness,
    rows,
    cabs: rows.length,
    live,
    banned,
    billing,
    other,
    spendUsd,
    limitUsd,
    spendUnknown,
    limitUnknown,
    excludedCurrencyCabs,
    excludedCurrencies: [...excludedCurrencies].sort(),
    withCard,
    pixels: pixelIds.size,
  };
}

/** Группировка кабинетов по `business` + итоги по каждой группе.
 *
 *  Сортировка — по `spendUsd` убыв., группа без БМ ВСЕГДА последней. Это не
 *  «так получилось по цифрам», а прямое требование: у неё нет БМ, значит её
 *  место среди групп БМ ошибочно, даже если спенд там больше всех.
 */
export function businessRows(rows: AccountRow[]): BusinessGroup[] {
  const byBiz = new Map<string, AccountRow[]>();
  const noBiz: AccountRow[] = [];

  for (const row of rows) {
    // Обрезаем пробелы ДО проверки на пустоту: снапшот иногда отдаёт
    // business:"   ", и без trim это стало бы отдельной группой-призраком с
    // пустым именем вместо слияния с «без БМ».
    const biz = (row.acc.business || "").trim();
    if (!biz) {
      noBiz.push(row);
      continue;
    }
    const list = byBiz.get(biz);
    if (list) list.push(row);
    else byBiz.set(biz, [row]);
  }

  const groups = [...byBiz.entries()]
    .map(([business, groupRows]) => summarize(business, groupRows, false))
    /* Группа без единой посчитанной суммы уходит ВНИЗ, а не встаёт как
       нулевая: ноль — это факт («не тратили»), а `null` значит «сложить было
       нечего», и ставить их рядом значит утверждать про вторую то же, что про
       первую. То же правило и та же причина, что у `bySpendIn` в
       `cloud-accounts`. */
    .sort((a, b) => (b.spendUsd ?? -1) - (a.spendUsd ?? -1));

  if (noBiz.length) groups.push(summarize("", noBiz, true));

  return groups;
}
