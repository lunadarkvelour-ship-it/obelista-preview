/* Лес: все ветки среза одним построением.
 *
 * Заменил загрузку ветки по клику. Ленивость выглядела экономией, а стоила
 * того, что половина листа работала вслепую: фильтру нечего было резать,
 * список статусов собирался из пустого набора, сохранённый разворот
 * открывался пустым. Здесь проверяется единственное, ради чего лес нужен:
 * ветка внутри леса обязана быть В ТОЧНОСТИ той же, что построил бы старый
 * путь по одному крео. Иначе цифра в развороте разойдётся с цифрой в дереве.
 */
import { describe, expect, it } from "vitest";
import { buildForest, buildTree } from "@/lib/analytics-tree";
import type { AdRow } from "@/lib/analytics";

function ad(over: Partial<AdRow> = {}): AdRow {
  return {
    fb_id: "ad_1", ad_name: "spx--ad--1--bangla18", creative: "bangla18",
    act_id: "act_1", act_name: "Каб 1", agency: "spx",
    campaign_id: "camp_1", campaign: "spx--BD--camp",
    adset_id: "adset_1", adset: "spx--adset--1",
    geo: "BD", attrib_method: "exact_job", attrib_confidence: 1,
    effective_status: "ACTIVE", socials: ["k1f9qbcs"], owner_profile: "k1f9qbcs",
    spend: 10, clicks: 2, sub: 1, contact: 1, checkout: 1, ftd: 1, rd: 0,
    ...over,
  };
}

const rows = [
  ad(),
  ad({ fb_id: "ad_2", creative: "dz5", spend: 4, ftd: 0 }),
  ad({ fb_id: "ad_3", act_id: "act_2", campaign_id: "camp_2", spend: 6, ftd: 2 }),
];

describe("buildForest", () => {
  it("раскладывает объявления по своим крео", () => {
    const forest = buildForest(rows);
    expect(Object.keys(forest).sort()).toEqual(["bangla18", "dz5"]);
    expect(forest.bangla18.map((a) => a.label).sort()).toEqual(["act_1", "act_2"]);
    expect(forest.dz5.map((a) => a.label)).toEqual(["act_1"]);
  });

  it("ветка в лесу совпадает с веткой, построенной отдельно", () => {
    /* Два разных сборщика означали бы, что «раскрой крео» и «покажи дерево»
       умеют разойтись в суммах — а сходимость и есть главный вопрос листа. */
    const mine = rows.filter((r) => r.creative === "bangla18");
    expect(buildForest(rows).bangla18).toEqual(buildTree(mine));
  });

  it("суммы каба считаются по его собственным объявлениям", () => {
    const acct = buildForest(rows).bangla18.find((a) => a.label === "act_1")!;
    expect(acct.spend).toBe(10);
    expect(acct.ftd).toBe(1);
  });

  it("пустой ответ даёт пустой лес, а не падение", () => {
    expect(buildForest([])).toEqual({});
  });
});
