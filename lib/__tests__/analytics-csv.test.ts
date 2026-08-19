/* Выгрузка настроенной таблицы аналитики в CSV.
 *
 *  Зачем эти тесты. Выгрузку открывают в Экселе и считают по ней дальше —
 *  значит цена ошибки здесь не «некрасиво», а «цифры не сойдутся, и понять
 *  почему нельзя». Два способа испортить файл молча:
 *
 *   • неэкранированное имя. Имена кабов приходят от Меты и от людей, запятые в
 *     них живут («Barnes George 06 08 2026, backup»). Одна такая строка сдвигает
 *     все колонки правее себя, и заметят это на несходящейся сумме, а не на виде;
 *   • форматированное число. «$142.90» и «50%» Эксель считает текстом и не
 *     суммирует, а обратно в число это уже не превратить.
 *
 *  Поэтому тут проверяется ровно это: экранирование и сырые числа.
 */
import { describe, expect, it } from "vitest";
import { BOM, csvFilename, escapeCsv, toCsv, type CsvRow } from "@/lib/analytics-csv";
import { accountFacts } from "@/lib/analytics-accounts";
import { BY_KEY, type ColKey } from "@/lib/analytics-columns";
import { FUNNEL_DERIVED, FUNNEL_METRICS } from "@/lib/funnel-metrics";
import type { Node } from "@/lib/analytics-tree";

function узел(over: Partial<Node> = {}): Node {
  return {
    id: "cre:bangla18", kind: "creative", label: "bangla18",
    spend: 100, clicks: 50, sub: 20, contact: 10, checkout: 5, ftd: 4, rd: 1,
    ads: 3, ads_with_ftd: 2, geos: ["BD"],
    ...over,
  } as Node;
}

const строка = (n: Node, depth = 0): CsvRow => ({ node: n, depth });

describe("escapeCsv — поля, которые ломают файл", () => {
  it("обычное слово не трогается", () => {
    expect(escapeCsv("bangla18")).toBe("bangla18");
  });

  it("запятая, кавычка и перенос заворачиваются в кавычки", () => {
    expect(escapeCsv("Barnes George, backup")).toBe('"Barnes George, backup"');
    expect(escapeCsv('Каб "один"')).toBe('"Каб ""один"""');
    expect(escapeCsv("две\nстроки")).toBe('"две\nстроки"');
  });
});

describe("toCsv — что уезжает в файл", () => {
  it("шапка: постоянные поля, затем ВЫБРАННЫЕ колонки в порядке выбора", () => {
    const csv = toCsv([], ["ftd", "spend"]);
    expect(csv.split("\n")[0])
      .toBe("level,depth,name,act_id,account,agency,fb_id,status,FTD,Spend");
  });

  it("невыбранная колонка в файл не попадает", () => {
    const csv = toCsv([строка(узел())], ["spend"]);
    expect(csv).not.toContain("FTD");
  });

  it("несуществующий ключ колонки не роняет выгрузку и не даёт пустого столбца", () => {
    const csv = toCsv([строка(узел())], ["spend", "мусор" as never]);
    expect(csv.split("\n")[0])
      .toBe("level,depth,name,act_id,account,agency,fb_id,status,Spend");
  });

  it("деньги — числом до сотых, без валюты и разделителей", () => {
    const csv = toCsv([строка(узел({ spend: 1234.567 }))], ["spend"]);
    expect(csv.split("\n")[1].endsWith(",1234.57")).toBe(true);
    expect(csv).not.toContain("$");
  });

  it("доля остаётся долей, а не процентом: 4 депа на 20 подписок = 0.2", () => {
    const csv = toCsv([строка(узел({ ftd: 4, sub: 20 }))], ["sub_to_ftd"]);
    expect(csv.split("\n")[1].endsWith(",0.2000")).toBe(true);
    expect(csv).not.toContain("%");
  });

  it("производная считается, а не берётся готовой: CPFTD = spend / ftd", () => {
    const csv = toCsv([строка(узел({ spend: 100, ftd: 4 }))], ["cpftd"]);
    expect(csv.split("\n")[1].endsWith(",25.00")).toBe(true);
  });

  it("делить не на что — пустая ячейка, а не ноль и не Infinity", () => {
    // Ноль депов это «депов не было», а не «крео бесплатное». Ноль в файле
    // усреднится вместе с настоящими ценами и занизит их.
    const csv = toCsv([строка(узел({ spend: 100, ftd: 0 }))], ["cpftd"]);
    expect(csv.split("\n")[1].endsWith(",")).toBe(true);
    expect(csv).not.toContain("Infinity");
  });

  it("имя с запятой не сдвигает колонки", () => {
    const csv = toCsv([строка(узел({ label: "Barnes George, backup" }))], ["spend"]);
    const строки = csv.trim().split("\n");
    expect(строки[1]).toContain('"Barnes George, backup"');
    // Колонок ровно столько же, сколько в шапке — вот что реально проверяем.
    const колонок = (s: string) => s.match(/(^|,)("([^"]|"")*"|[^,]*)/g)!.length;
    expect(колонок(строки[1])).toBe(колонок(строки[0]));
  });

  it("гео — текстом через пробел, пустое гео не даёт мусора", () => {
    expect(toCsv([строка(узел({ geos: ["BD", "DZ"] }))], ["geos"])).toContain(",BD DZ");
    expect(toCsv([строка(узел({ geos: [] }))], ["geos"]).split("\n")[1].endsWith(",")).toBe(true);
  });

  it("уровень и глубина едут всегда, даже когда колонок не выбрано ни одной", () => {
    const csv = toCsv(
      [строка(узел()), строка(узел({ id: "acct:act_1", kind: "account", label: "Каб 1", act_id: "act_1" }), 1)],
      [],
    );
    const строки = csv.trim().split("\n");
    expect(строки[1].startsWith("creative,0,bangla18,")).toBe(true);
    expect(строки[2].startsWith("account,1,Каб 1,act_1,")).toBe(true);
  });

  it("порядок строк сохраняется как пришёл — это порядок экрана", () => {
    const csv = toCsv(
      [строка(узел({ label: "второй" })), строка(узел({ label: "первый" }))],
      [],
    );
    const строки = csv.trim().split("\n");
    expect(строки[1]).toContain("второй");
    expect(строки[2]).toContain("первый");
  });

  it("пустая таблица даёт шапку, а не пустой файл", () => {
    // Пустой файл читается как «выгрузка сломалась». Шапка говорит «строк нет».
    expect(toCsv([], ["spend"]).trim().split("\n")).toHaveLength(1);
  });
});

/* Кабинет в файле — та же строка, что на экране (#132), и «не собрано» в ней
 *  отличимо от нуля (#122). */
describe("toCsv — кабинет", () => {
  const каб = (over: Partial<Node> = {}) =>
    узел({
      id: "acct:act_1", kind: "account", label: "act_1", act_id: "act_1",
      act_name: "Hiuhiu_MediaBuyer_3.8_2", agency: "hiu", ...over,
    });

  it("имя и агентство кабинета едут отдельными полями, id остаётся id", () => {
    const csv = toCsv([строка(каб(), 1)], []);
    expect(csv.split("\n")[1])
      .toBe("account,1,act_1,act_1,Hiuhiu_MediaBuyer_3.8_2,hiu,,unknown");
  });

  it("состояние берётся из индекса кабинетов, а не из поля объявления", () => {
    const csv = toCsv([строка(каб(), 1)], [], {
      accounts: accountFacts({ base: [{ act_id: "act_1", status: "DISABLED" }] }),
    });
    expect(csv.split("\n")[1].endsWith(",DISABLED")).toBe(true);
  });

  it("состояния никто не снимал — слово unknown, а не пустота", () => {
    // Пустота в этой колонке означает «у уровня статуса не бывает» (крео,
    // кампания). У кабинета он бывает — мы его просто не спрашивали.
    const csv = toCsv([строка(узел()), строка(каб(), 1)], []);
    const строки = csv.trim().split("\n");
    expect(строки[1].split(",")[7]).toBe("");          // крео — пусто
    expect(строки[2].split(",")[7]).toBe("unknown");   // каб — слово
  });

  it("несобранный спенд — пустая ячейка, настоящий ноль — 0", () => {
    const csv = toCsv(
      [строка(каб({ spend: null }), 1), строка(каб({ id: "acct:act_2", spend: 0 }), 1)],
      ["spend"],
    );
    const строки = csv.trim().split("\n");
    expect(строки[1].endsWith(",")).toBe(true);
    expect(строки[2].endsWith(",0.00")).toBe(true);
  });
});

describe("toCsv — строка ИТОГО", () => {
  it("цена депа в итоге считается из сумм, а не усреднением цен", () => {
    // $290 за один деп и $580 за десять: среднее цен дало бы 174, правда — 79.
    const csv = toCsv(
      [строка(узел({ spend: 290, ftd: 1 })), строка(узел({ spend: 580, ftd: 10 }))],
      ["cpftd"],
    );
    const итог = csv.trim().split("\n").at(-1)!;
    expect(итог.startsWith("total,")).toBe(true);
    expect(итог.endsWith(",79.09")).toBe(true);
  });

  it("итог считается по КРЕО: кабы внутри — те же деньги ещё раз", () => {
    const csv = toCsv(
      [
        строка(узел({ spend: 100 })),
        строка(узел({ id: "acct:act_1", kind: "account", label: "act_1", spend: 100 }), 1),
      ],
      ["spend"],
    );
    const итог = csv.trim().split("\n").at(-1)!;
    expect(итог.endsWith(",100.00")).toBe(true);
    expect(итог).toContain("1 creative");
  });

  it("часть крео скрыта фильтром — итог говорит об этом словами", () => {
    const csv = toCsv([строка(узел())], ["spend"], { hidden: 28 });
    expect(csv.trim().split("\n").at(-1)!).toContain("1 of 29 creatives");
  });

  it("строк нет — итога тоже нет, а не нулевая строка", () => {
    // «total,,0 creatives,...,0.00» читалось бы как «посчитали, вышло ноль».
    expect(toCsv([], ["spend"]).trim().split("\n")).toHaveLength(1);
  });
});

describe("обвязка файла", () => {
  it("в имени файла стоит период среза", () => {
    expect(csvFilename("2026-08-08", "2026-08-13"))
      .toBe("obelista-analytics-2026-08-08_2026-08-13.csv");
  });

  it("пустая дата не склеивается в правдоподобное имя", () => {
    // «obelista-analytics-_2026-08-13.csv» выглядит настоящим и молча врёт про
    // период. Имя файла человек читает через неделю, спорить с ним нечем.
    expect(csvFilename("", "2026-08-13")).toBe("obelista-analytics-unknown-period.csv");
    expect(csvFilename("2026-08-08", "")).toBe("obelista-analytics-unknown-period.csv");
    expect(csvFilename("", "")).toBe("obelista-analytics-unknown-period.csv");
  });

  it("BOM — ровно один невидимый символ", () => {
    expect(BOM).toHaveLength(1);
    expect(BOM.charCodeAt(0)).toBe(0xfeff);
  });
});

/* ── выгрузка знает ВЕСЬ каталог воронки, а не пять знакомых колонок ───────
 *
 * Файл открывают в Экселе и считают по нему дальше. Колонка, которая на экране
 * есть, а в файле пуста, — это не «мелочь оформления»: человек посчитает сумму
 * по тому, что видит в файле, и разойдётся с панелью, не узнав об этом. Поэтому
 * набор проверяется по каталогу, а не перечислением. */
describe("CSV покрывает весь каталог воронки", () => {
  const все = [
    ...FUNNEL_METRICS.filter((m) => m.leaderboard).map((m) => m.id),
    ...FUNNEL_DERIVED.map((d) => d.id),
  ] as ColKey[];

  it("каждая ступень, цена и конверсия выгружаются СЫРЫМ числом", () => {
    const csv = toCsv([строка(узел())], все);
    const [head, row] = csv.trim().split("\n");
    for (const k of все) {
      expect(head, `нет колонки ${k}`).toContain(BY_KEY[k].title);
    }
    // Ни валюты, ни процентов: и то и другое Эксель считает текстом.
    expect(row).not.toMatch(/[$%]/);
    const ячейки = row.split(",").slice(8);
    expect(ячейки.length).toBe(все.length);
    for (const c of ячейки) expect(c, `не число: ${c}`).toMatch(/^-?\d+(\.\d+)?$/);
  });

  it("НЕСОБРАННОЕ — ПУСТАЯ ЯЧЕЙКА, А НЕ НОЛЬ, по каждой колонке каталога", () => {
    /* Ноль в Экселе участвует в `СРЗНАЧ` и занижает результат, пустота — нет.
       Разница между «крутилось и не потратило» и «не собрали» сохраняется до
       файла включительно. */
    const пусто = узел({
      spend: null, clicks: null, sub: null, contact: null,
      checkout: null, ftd: null, rd: null,
    });
    const csv = toCsv([строка(пусто)], все);
    const ячейки = csv.trim().split("\n")[1].split(",").slice(8);
    expect(ячейки.length).toBe(все.length);
    for (const c of ячейки) expect(c).toBe("");
  });

  it("итоговая строка тоже пуста там, где считать не из чего", () => {
    const csv = toCsv([строка(узел({ sub: null, ftd: null, spend: null }))], все);
    const итог = csv.trim().split("\n").at(-1)!.split(",").slice(8);
    const место = (k: ColKey) => все.indexOf(k);
    expect(итог[место("sub")]).toBe("");
    expect(итог[место("cpsub")]).toBe("");
    expect(итог[место("sub_to_ftd")]).toBe("");
  });
});
