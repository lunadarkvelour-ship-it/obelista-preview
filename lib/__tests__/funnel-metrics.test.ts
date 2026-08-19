/* КОНТРАКТ ОБЩЕГО КАТАЛОГА ВОРОНКИ.
 *
 * Этот тест существует ради одной болезни: «метрики воронки одинаковые на двух
 * листах» до сих пор держалось на том, что никто не опечатался. Списки жили в
 * четырёх файлах разом — каталог колонок «Аналитики», свёртка дерева, итог
 * таблицы и карта цен «Кампаний», — и разъехаться они могли только молча:
 * каждая половина права по отдельности, а расходятся они в момент встречи.
 *
 * Поэтому проверки здесь ЧИТАЮТ НАСТОЯЩИЕ ИСТОЧНИКИ, а не фикстуру,
 * переписанную из них руками: канон берётся из `core/sources/base.py` тем же
 * способом, каким его читает `campaigns-funnel.test.ts`, а состав колонок — из
 * живых каталогов обоих листов. Проверка против своей копии — это второй
 * экземпляр договорённости, и он разъезжается с первым так же тихо.
 */
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";
import {
  FUNNEL_BY_ID,
  FUNNEL_COST_BY_STEP,
  FUNNEL_COST_IDS,
  FUNNEL_DERIVED,
  FUNNEL_DERIVED_BY_ID,
  FUNNEL_IDS,
  FUNNEL_METRICS,
  LEADERBOARD_FUNNEL_IDS,
  deriveFunnel,
  divideFunnel,
  funnelNumber,
  sumFunnel,
  type FunnelMetricId,
} from "@/lib/funnel-metrics";
import { COLUMNS, DEFAULT_VISIBLE, LS_KEY, BY_KEY } from "@/lib/analytics-columns";
import { ГЛАЗ_КЛЮЧ, колонкиВоронки, подписьШага, ступениАналитики } from "@/lib/campaigns-funnel";
import { ЦЕНА_ШАГА } from "@/lib/campaigns-columns";
import { FUNNEL_STEPS } from "@/lib/integrations";
import type { FunnelJoin } from "@/lib/campaigns-funnel";

/** Корень репозитория: `panel/lib/__tests__` → вверх на три. */
const КОРЕНЬ = path.resolve(__dirname, "..", "..", "..");
const читатьДвижок = (rel: string) => readFileSync(path.join(КОРЕНЬ, rel), "utf8");

/* ── (a) канон читается у движка ─────────────────────────────────────────── */

describe("каталог равен канону движка, а не своему представлению о нём", () => {
  const src = читатьДвижок("core/sources/base.py");

  const канон = (): string[] => {
    const m = src.match(/^CANON\s*=\s*\(([^)]*)\)/m);
    expect(m, "в core/sources/base.py не нашёлся CANON").toBeTruthy();
    return [...m![1].matchAll(/"([a-z_]+)"/g)].map((x) => x[1]);
  };

  const вид = (): Record<string, string> => {
    const m = src.match(/^ВИД\s*=\s*\{([\s\S]*?)\}/m);
    expect(m, "в core/sources/base.py не нашёлся ВИД").toBeTruthy();
    return Object.fromEntries(
      [...m![1].matchAll(/"([a-z_]+)"\s*:\s*"([a-z]+)"/g)].map((x) => [x[1], x[2]]),
    );
  };

  it("СОСТАВ И ПОРЯДОК метрик равны CANON — в обе стороны", () => {
    /* Обе стороны нужны: односторонняя проверка «каждая наша есть у них»
       промолчит про седьмую ступень, заведённую в движке и не доехавшую до
       панели, — а это и есть тот случай, когда лист показывает пять колонок из
       шести и ни слова об этом не говорит. */
    expect([...FUNNEL_IDS]).toEqual(канон());
  });

  it("ВИД метрики (события или деньги) равен ВИД движка", () => {
    const ожидание = вид();
    expect(Object.keys(ожидание).length).toBe(FUNNEL_METRICS.length);
    for (const m of FUNNEL_METRICS) {
      expect(m.kind, `вид ${m.id} разошёлся с движком`).toBe(ожидание[m.id]);
    }
    // Точечно: выручка — деньги, остальное — события. Пустая денежная ячейка
    // это прочерк, а не «$0.00 заработали».
    expect(FUNNEL_BY_ID.revenue.kind).toBe("money");
    expect(FUNNEL_BY_ID.sub.kind).toBe("count");
  });
});

/* ── (b) у каждой метрики полный контракт ────────────────────────────────── */

describe("контракт метрики заполнен целиком", () => {
  it("подпись НИКОГДА не равна ключу — иначе человеку показали бы «ftd»", () => {
    for (const m of FUNNEL_METRICS) {
      expect(m.title, `нет подписи у ${m.id}`).not.toBe(m.id);
      expect(m.title.length).toBeGreaterThan(0);
    }
  });

  it("у каждой метрики есть расшифровка, агрегация и объяснение пустоты", () => {
    for (const m of FUNNEL_METRICS) {
      expect(m.hint, `нет расшифровки у ${m.id}`).toBeTruthy();
      expect(m.aggregation, m.id).toBe("sum");
      // Пустота, не объяснённая словами, читается как ноль. Поэтому поле
      // обязательное, и оно обязано быть предложением, а не заглушкой.
      expect(m.emptyMeans.length, `нет emptyMeans у ${m.id}`).toBeGreaterThan(20);
    }
  });

  it("уровни объявлены, и признак лидерборда им не противоречит", () => {
    /* `leaderboard` и `levels` отвечают на один вопрос двумя способами, и
       второй способ существует только ради удобства чтения. Разъедутся — на
       экране появится колонка, которой на строке крео взять неоткуда. */
    for (const m of FUNNEL_METRICS) {
      expect(m.levels.length, `нет уровней у ${m.id}`).toBeGreaterThan(0);
      expect(m.leaderboard, `leaderboard спорит с levels у ${m.id}`)
        .toBe(m.levels.includes("creative"));
    }
    // Разложение движка живёт на объектах Меты (`core/crm.GROUPS`), и выручка
    // выше них не сворачивается ни у одного трекера.
    expect([...FUNNEL_BY_ID.revenue.levels]).toEqual(["campaign", "adset", "ad"]);
  });

  it("цена ступени объявлена ровно там, где она бывает", () => {
    for (const m of FUNNEL_METRICS) {
      if (m.cost === null) continue;
      const d = FUNNEL_DERIVED_BY_ID[m.cost];
      expect(d, `цена ${m.cost} у ${m.id} не описана в FUNNEL_DERIVED`).toBeTruthy();
      expect(d.numerator).toBe("spend");
      expect(d.denominator).toBe(m.id);
      expect(d.kind).toBe("money");
    }
    // Выручка — уже деньги, делить на неё спенд бессмысленно.
    expect(FUNNEL_BY_ID.revenue.cost).toBeNull();
    expect([...FUNNEL_COST_IDS]).toEqual(["cpsub", "cpcon", "cpcheck", "cpftd", "cprd"]);
  });
});

/* ── (c) «Creative Analytics» собирается из каталога ─────────────────────── */

describe("лидерборд «Аналитики» — это каталог, а не второй список", () => {
  const воронка = COLUMNS.filter((c) => c.group === "воронка");

  it("состав группы «воронка» равен ступеням лидерборда", () => {
    expect(new Set(воронка.map((c) => c.key)))
      .toEqual(new Set<string>(LEADERBOARD_FUNNEL_IDS));
  });

  it("подписи и расшифровки колонок ДОСЛОВНО равны каталожным", () => {
    for (const c of воронка) {
      const m = FUNNEL_BY_ID[c.key as FunnelMetricId];
      expect(m, `колонка ${c.key} не описана в каталоге`).toBeTruthy();
      expect(c.title, c.key).toBe(m.title);
      expect(c.hint, c.key).toBe(m.hint);
    }
  });

  it("ВЫРУЧКИ НА ЛИДЕРБОРДЕ НЕТ — и это состояние проверяется, а не подразумевается", () => {
    /* Колонка Revenue, показывающая прочерк всему парку, читается как
       «заработали ноль». Появится трекер с выручкой — в каталоге станет
       `leaderboard: true`, колонка соберётся сама, и эта проверка покраснеет,
       назвав причину. */
    expect(COLUMNS.map((c) => c.key)).not.toContain("revenue");
    expect(FUNNEL_BY_ID.revenue.leaderboard).toBe(false);
  });

  it("цены и конверсии в каталоге колонок взяты из FUNNEL_DERIVED", () => {
    for (const d of FUNNEL_DERIVED) {
      const c = BY_KEY[d.id] as { title: string; hint?: string; kind: string } | undefined;
      expect(c, `производная ${d.id} пропала из каталога колонок`).toBeTruthy();
      expect(c!.title, d.id).toBe(d.title);
      expect(c!.hint, d.id).toBe(d.hint);
      expect(c!.kind, d.id).toBe(d.kind);
    }
  });
});

/* ── (d) «Кампании» собираются из того же каталога ───────────────────────── */

describe("«Кампании» читают тот же каталог", () => {
  it("карта цен «Кампаний» совпадает с каталожной по каждой ступени", () => {
    /* `ЦЕНА_ШАГА` живёт в `lib/campaigns-columns` — файле, который этот срез не
       правит. Проверка перекрёстная намеренно: она ловит расхождение, которого
       не увидит ни один из двух файлов поодиночке. */
    for (const m of FUNNEL_METRICS) {
      expect(ЦЕНА_ШАГА[m.id] ?? null, `цена ${m.id} разошлась`).toBe(FUNNEL_COST_BY_STEP[m.id]);
    }
    expect(Object.keys(ЦЕНА_ШАГА).sort()).toEqual([...LEADERBOARD_FUNNEL_IDS].sort());
  });

  it("подпись ступени на «Кампаниях» — каталожная, включая выручку", () => {
    for (const m of FUNNEL_METRICS) {
      expect(подписьШага(m.id)).toEqual({ title: m.title, hint: m.hint });
    }
    // Ровно то, ради чего снят второй список подписей: выручка подписана, хотя
    // колонки под неё на лидерборде нет.
    expect(подписьШага("revenue").title).toBe("Revenue");
  });

  it("незнакомая ступень не выбрасывается, а называется ключом", () => {
    // Выброшенная колонка — это молчаливо потерянный шаг, который движок уже
    // считает. Ключ вместо подписи некрасив, но виден.
    expect(подписьШага("wtf")).toEqual({
      title: "wtf",
      hint: "funnel step «wtf» reported by the source",
    });
  });

  it("ступени экрана «Кампаний» — подмножество каталога, без чужаков", () => {
    for (const k of ступениАналитики()) {
      expect(FUNNEL_BY_ID[k as FunnelMetricId], `ступень ${k} не из каталога`).toBeTruthy();
    }
  });
});

/* ── (e) реестр интеграций знает тот же канон ────────────────────────────── */

describe("страница интеграций перечисляет те же шаги", () => {
  it("FUNNEL_STEPS равны каталогу — состав и порядок", () => {
    expect([...FUNNEL_STEPS]).toEqual([...FUNNEL_IDS]);
  });
});

/* ── (f) лид отвечает БЭКЕНД, а не каталог ───────────────────────────────── */

describe("лид не объявляется в каталоге", () => {
  it("в файле каталога нет константы лида", () => {
    /* Зашитый здесь `sub` пережил бы смену вертикали молча: панель продолжила
       бы звать лидом подписку там, где лид — регистрация. */
    const src = читатьДвижок("panel/lib/funnel-metrics.ts");
    expect(src).not.toMatch(/^\s*export\s+const\s+(ЛИД|LEAD|LEAD_METRIC)\b/m);
    expect(src).not.toMatch(/\blead:\s*true\b/);
  });

  it("лидом становится то, что назвал бэкенд полем lead_metric", () => {
    const ответ = (лид: string): FunnelJoin => ({
      ok: true, tracker: "keine_media", lead_metric: лид,
      metrics: [...FUNNEL_IDS], rows: {}, ever_at: "2026-08-16",
    });
    // Не `sub`, а `ftd` — чтобы проверка ловила именно чтение ответа, а не
    // совпадение с сегодняшним значением движка.
    const колонки = колонкиВоронки(ответ("ftd"));
    expect(колонки.filter((c) => c.lead).map((c) => c.metric)).toEqual(["ftd"]);
    expect(колонкиВоронки(ответ("sub")).find((c) => c.lead)?.metric).toBe("sub");
  });
});

/* ── (g) пустота никогда не ноль ─────────────────────────────────────────── */

describe("null-семантика: неизвестное не превращается в ноль", () => {
  it("funnelNumber пропускает только конечные числа", () => {
    expect(funnelNumber("12")).toBeNull();
    expect(funnelNumber(Number.NaN)).toBeNull();
    expect(funnelNumber(Number.POSITIVE_INFINITY)).toBeNull();
    expect(funnelNumber(undefined)).toBeNull();
    expect(funnelNumber(null)).toBeNull();
    expect(funnelNumber({})).toBeNull();
    // А НАСТОЯЩИЙ НОЛЬ ОСТАЁТСЯ НУЛЁМ: «крутилось и не привело никого» —
    // измеренный факт, и стирать его в прочерк значит терять сигнал.
    expect(funnelNumber(0)).toBe(0);
    expect(funnelNumber(-3.5)).toBe(-3.5);
  });

  it("сумма без единого вклада — null, а не 0", () => {
    expect(sumFunnel([null, null])).toBeNull();
    expect(sumFunnel([undefined, "12", Number.NaN])).toBeNull();
    expect(sumFunnel([])).toBeNull();
    // Хоть один вклад — уже число, и ноль тут настоящий.
    expect(sumFunnel([null, 0])).toBe(0);
    expect(sumFunnel([null, 2, "x", 3])).toBe(5);
  });

  it("деление без знаменателя — null, а не 0 и не бесконечность", () => {
    expect(divideFunnel(5, 0)).toBeNull();
    expect(divideFunnel(5, -1)).toBeNull();
    expect(divideFunnel(5, null)).toBeNull();
    expect(divideFunnel(null, 5)).toBeNull();
    expect(divideFunnel(5, "5")).toBeNull();
    expect(divideFunnel(10, 4)).toBe(2.5);
    // Числитель-ноль — законное число: «потратили ноль на десять подписок».
    expect(divideFunnel(0, 10)).toBe(0);
  });

  it("deriveFunnel считает по описанию и молчит там, где считать нечего", () => {
    const строка = { spend: 100, sub: 50, contact: 25, ftd: 0, clicks: 200 };
    expect(deriveFunnel(FUNNEL_DERIVED_BY_ID.cpsub, строка)).toBe(2);
    expect(deriveFunnel(FUNNEL_DERIVED_BY_ID.sub_to_contact, строка)).toBe(0.5);
    // FTD ноль — цена депа не «бесплатно», а неизвестна.
    expect(deriveFunnel(FUNNEL_DERIVED_BY_ID.cpftd, строка)).toBeNull();
    expect(deriveFunnel(FUNNEL_DERIVED_BY_ID.cprd, строка)).toBeNull();
  });

  it("конверсии — ДОЛЯ, а не процент", () => {
    /* Форматтер `pct` сам умножает на сто. Процент здесь давал вторую сотню:
       на экране стояло 5670% там, где строки показывали 39–73%. */
    for (const d of FUNNEL_DERIVED.filter((x) => x.kind === "pct")) {
      expect(deriveFunnel(d, { sub: 100, contact: 39, checkout: 20, ftd: 10, rd: 4 }))
        .toBeLessThanOrEqual(1);
    }
  });
});

/* ── (h) совместимость сохранённых и выгружаемых идентификаторов ─────────── */

describe("идентификаторы, которые уже лежат у людей в браузере", () => {
  it("ключи localStorage не менялись", () => {
    /* Смена ключа стирает раскладку у каждого, кто хоть раз открывал лист, и
       делает это молча — сохранённое просто перестаёт находиться. */
    expect(LS_KEY).toBe("laundry-analytics-columns-v2");
    expect(ГЛАЗ_КЛЮЧ).toBe("obelista-campaigns-funnel-eye-v1");
  });

  it("состав и порядок каталога колонок — прежние, до ключа", () => {
    expect(COLUMNS.map((c) => c.key)).toEqual([
      "spend", "cpftd", "cprd", "cpsub", "cpcon", "cpcheck",
      "ftd", "rd", "checkout", "contact", "sub",
      "sub_to_ftd", "sub_to_rd", "sub_to_checkout", "sub_to_contact",
      "ads", "ads_with_ftd", "clicks", "clicks_per_ftd", "geos",
    ]);
  });

  it("набор по умолчанию — прежний", () => {
    expect(DEFAULT_VISIBLE).toEqual([
      "spend",
      "sub", "cpsub",
      "contact", "cpcon",
      "checkout", "cpcheck",
      "ftd", "cpftd",
      "rd", "cprd",
      "sub_to_contact", "sub_to_checkout", "sub_to_ftd", "sub_to_rd",
      "ads_with_ftd",
    ]);
  });

  it("ширины и группы колонок воронки не поехали при переезде подписей", () => {
    const ширины = Object.fromEntries(
      COLUMNS.filter((c) => c.group === "воронка").map((c) => [c.key, c.width]),
    );
    expect(ширины).toEqual({ ftd: 68, rd: 62, checkout: 72, contact: 74, sub: 78 });
  });
});
