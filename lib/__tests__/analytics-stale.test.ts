/* Возраст спенда и метка расхождения — иссус #20.
 *
 *  Панель за 9 августа показывала $944.19 при реальных $1516.58, и выглядело
 *  это как свежая правда. Цифры не отсутствовали: у девяти кабов соца с умершим
 *  токеном спенд сняли 8 августа в 23:08 — за сутки до конца тех суток, за
 *  которые он записан, — и больше не трогали. $9.13 стояли на месте $192.07.
 *
 *  Сторожим здесь две вещи. Первая: застывшая цифра обязана быть отличима от
 *  свежей на ЛЮБОМ уровне дерева, включая свёрнутую строку крео — её и читают,
 *  пока не раскрыли. Вторая: метка расхождения приезжает из движковой половины
 *  иссуса, которая доедет своим ходом, и её отсутствие обязано выглядеть как
 *  «метки нет», а не как ошибка или пустая колонка.
 */
import { describe, expect, it } from "vitest";
import { buildTree, rollStale, type Node } from "@/lib/analytics-tree";
import { hasMismatch, staleLevel, staleWhy, whenShort } from "@/lib/analytics";
import type { AdRow } from "@/lib/analytics";

const HOUR = 3600;

function ad(over: Partial<AdRow> = {}): AdRow {
  return {
    fb_id: "ad_1",
    ad_name: "spx--ad--1--bangla18",
    creative: "bangla18",
    act_id: "act_1",
    act_name: "Каб 1",
    agency: "spx",
    campaign_id: "camp_1",
    campaign: "spx--BD--camp",
    adset_id: "adset_1",
    adset: "spx--adset--1",
    geo: "BD",
    attrib_method: "exact_job",
    attrib_confidence: 1,
    effective_status: "ACTIVE",
    socials: ["k1f9qbcs"],
    owner_profile: "k1f9qbcs",
    spend: 10,
    clicks: 2,
    sub: 1,
    contact: 1,
    checkout: 1,
    ftd: 1,
    rd: 0,
    ...over,
  };
}

describe("staleLevel", () => {
  it("незакрытый день молчит: сутки идут, цифра дорастёт", () => {
    expect(staleLevel(null)).toBe("ok");
  });

  it("хвост в пару часов — не повод кричать", () => {
    // Живые кабы 9 августа: сняты за 2 ч 12 мин до конца суток. Круг просто не
    // успел сделать последний заход, и метка тут была бы шумом на всей таблице.
    expect(staleLevel(2 * HOUR + 12 * 60)).toBe("ok");
  });

  it("больше трёх часов недобора — «late»", () => {
    expect(staleLevel(5 * HOUR)).toBe("late");
  });

  it("снято до начала суток — «frozen», а не просто «поздно»", () => {
    // Ровно случай #20: 24 ч 51 мин. Лечится не следующим кругом сбора, а
    // переподключением соца, поэтому и ступень отдельная.
    expect(staleLevel(24 * HOUR + 51 * 60)).toBe("frozen");
  });
});

describe("buildTree: возраст едет снизу вверх", () => {
  it("кладёт возраст на объявление как есть", () => {
    const [acct] = buildTree([
      ad({ spend_at: "2026-08-08T23:08:35+00:00", stale_gap_s: 89485, stale_spend: 9.13 }),
    ]);
    const one = acct.children![0].children![0].children![0];
    expect(one.stale_gap_s).toBe(89485);
    expect(one.stale_spend).toBe(9.13);
  });

  it("у каба возраст — по САМОМУ СТАРОМУ замеру, недобор — по худшему", () => {
    const [acct] = buildTree([
      ad({ fb_id: "ad_1", spend_at: "2026-08-09T21:47:00+00:00", stale_gap_s: 7900, stale_spend: 0 }),
      ad({ fb_id: "ad_2", spend_at: "2026-08-08T23:08:00+00:00", stale_gap_s: 89485, stale_spend: 9.13 }),
    ]);
    // Свежий сосед не имеет права делать сумму свежей: она честна ровно
    // настолько, насколько честно её слабое звено.
    expect(acct.spend_at).toBe("2026-08-08T23:08:00+00:00");
    expect(acct.stale_gap_s).toBe(89485);
    expect(acct.stale_spend).toBe(9.13);
    expect(staleLevel(acct.stale_gap_s!)).toBe("frozen");
  });

  it("без полей возраста ничего не выдумывает", () => {
    // Демон постарше их не отдаёт вовсе. Ноль тут был бы враньём в другую
    // сторону: «снято ровно в конец суток».
    const [acct] = buildTree([ad()]);
    expect(acct.spend_at).toBeNull();
    expect(acct.stale_gap_s).toBeNull();
    expect(staleLevel(acct.stale_gap_s ?? null)).toBe("ok");
  });
});

describe("rollStale: строка крео", () => {
  /* Цифры крео приходят готовыми из лидерборда, а не считаются снизу вверх, и
     потому строка крео — единственная, которая сама ничего не знает о возрасте
     своих денег. Ровно она и вводила в заблуждение: свёрнутая, она выглядела
     итогом дня. */
  function creative(kids: Node[]): Node {
    return {
      id: "cr:bangla18", kind: "creative", label: "bangla18",
      spend: 944.19, clicks: null, sub: null, contact: null, checkout: null,
      ftd: null, rd: null, ads: null, ads_with_ftd: null, geos: [],
      children: kids,
    };
  }

  it("досыпает возраст из кабов, не трогая сумму", () => {
    const kids = buildTree([
      ad({ act_id: "act_живой", fb_id: "ad_1", spend_at: "2026-08-09T21:47:00+00:00", stale_gap_s: 7900, stale_spend: 0 }),
      ad({ act_id: "act_мёртвый", fb_id: "ad_2", spend_at: "2026-08-08T23:08:00+00:00", stale_gap_s: 89485, stale_spend: 9.13 }),
    ]);
    const node = rollStale(creative(kids));
    expect(node.spend).toBe(944.19);            // сумму считает движок, не мы
    expect(staleLevel(node.stale_gap_s ?? null)).toBe("frozen");
    expect(node.stale_spend).toBe(9.13);
    expect(node.spend_at).toBe("2026-08-08T23:08:00+00:00");
  });

  it("крео целиком из свежих кабов остаётся чистым", () => {
    const kids = buildTree([
      ad({ spend_at: "2026-08-09T21:47:00+00:00", stale_gap_s: 7900, stale_spend: 0 }),
    ]);
    expect(staleLevel(rollStale(creative(kids)).stale_gap_s ?? null)).toBe("ok");
  });

  it("крео без детей не падает и ничего не сочиняет", () => {
    const node = rollStale(creative([]));
    expect(node.stale_gap_s).toBeUndefined();
    expect(node.mismatch).toBeUndefined();
  });
});

describe("метка расхождения: её может не быть вовсе", () => {
  it("сторож не доехал — нет ни метки, ни ошибки", () => {
    const [acct] = buildTree([ad()]);          // checks не передан вовсе
    expect(acct.check).toBeUndefined();
    expect(acct.mismatch).toBe(false);
    expect(hasMismatch(acct.check)).toBe(false);
  });

  it("сверка сошлась — метки тоже нет", () => {
    // Сторож пишет строку на КАЖДУЮ сверку, а говорить надо только про
    // несошедшиеся: иначе метка стоит у всех и не значит ничего.
    const [acct] = buildTree([ad()], { act_1: { meta: 100, ours: 100, diff: 0 } });
    expect(acct.mismatch).toBe(false);
  });

  it("расхождение есть — метка на кабе и предупреждение выше по дереву", () => {
    const kids = buildTree([ad()], { act_1: { meta: 192.07, ours: 9.13, diff: 182.94 } });
    expect(kids[0].mismatch).toBe(true);
    const top: Node = {
      id: "cr:x", kind: "creative", label: "x", spend: 9.13, clicks: null,
      sub: null, contact: null, checkout: null, ftd: null, rd: null, ads: null,
      ads_with_ftd: null, geos: [], children: kids,
    };
    expect(rollStale(top).mismatch).toBe(true);
  });

  it("расхождение без цифр всё равно новость", () => {
    // Сторож может положить только факт «не сошлось». Молчать об этом нельзя:
    // сам факт попадания каба в список — уже ответ на вопрос «верить ли числу».
    const [acct] = buildTree([ad()], { act_1: { at: "2026-08-10T06:23:00+00:00" } });
    expect(acct.mismatch).toBe(true);
  });
});

describe("слова для человека", () => {
  it("без замера подсказки нет — пустая строка, а не «неизвестно когда»", () => {
    expect(staleWhy("this ad account", null, null, null)).toBe("");
    expect(whenShort(null)).toBe("");
    expect(whenShort("не дата")).toBe("");
  });

  it("незакрытый день объясняет себя, а не пугает", () => {
    const s = staleWhy("this ad account", "2026-08-10T06:23:00+00:00", null, null);
    expect(s).toContain("The day is still running");
  });

  it("застывший каб называет и причину, и сумму под вопросом", () => {
    const s = staleWhy("this ad account", "2026-08-08T23:08:35+00:00", 89485, 9.13);
    expect(s).toContain("before the day it is recorded for had even started");
    expect(s).toContain("$9.13");
    // «Нижняя граница», а не «недобор»: сколько именно потеряли, знает Мета.
    expect(s).toContain("a lower bound");
  });

  it("недобранный хвост говорит про хвост, а не про смерть соца", () => {
    const s = staleWhy("this ad account", "2026-08-09T21:47:00+00:00", 5 * HOUR, 20);
    expect(s).toContain("before the day ended");
    expect(s).not.toContain("before the day it is recorded for had even started");
  });
});
