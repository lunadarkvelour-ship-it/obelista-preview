/* Экспорт выделенного в вызовы MCP-тула `manage`.
 *
 *  Три правила, из которых растёт весь формат:
 *   1. `manage` берёт ОДИН profile_name на вызов (`server.py:427`) → группируем
 *      по соцам, N соцев = N вызовов.
 *   2. `object_ids` — плоский массив, микс уровней легален (`server.py:1031`)
 *      → дедуп по предкам обязателен: Мета гасит каскадом, и слать вместе с
 *      кампанией её объявления значит утроить список и получить мусор в ответе.
 *   3. Единственная причина не попасть в вызовы — у объекта нет соца-исполнителя.
 *      Списка запрещённых профилей больше НЕТ: гард `NEVER_OPEN` снесён из
 *      движка 13.08 решением владельца, и панель, вырезая кнопку по старому
 *      списку, врала бы про запрет, которого в коде уже нет.
 */
import { describe, expect, it } from "vitest";
import {
  buildManagePayload, collectSelected, dedupeByAncestor, payloadText,
} from "@/lib/analytics-export";
import { buildTree, type Node } from "@/lib/analytics-tree";
import type { AdRow } from "@/lib/analytics";

function ad(over: Partial<AdRow> = {}): AdRow {
  return {
    fb_id: "ad_1", ad_name: "spx--ad--1--bangla18", creative: "bangla18",
    act_id: "act_1",
    act_name: "Каб 1", agency: "spx",
    campaign_id: "camp_1", campaign: "spx--BD--camp",
    adset_id: "adset_1", adset: "spx--adset--1",
    geo: "BD", attrib_method: "exact_job", attrib_confidence: 1,
    effective_status: "ACTIVE", socials: ["k1f9qbcs"], owner_profile: "k1f9qbcs",
    spend: 10, clicks: 2, sub: 1, contact: 1, checkout: 1, ftd: 1, rd: 0,
    ...over,
  };
}

/** Крео-корень поверх кабов — так же, как его лепит AnalyticsView. */
function root(rows: AdRow[], label = "bangla18"): Node {
  return {
    id: "cr:" + label, kind: "creative", label, children: buildTree(rows),
    spend: null, clicks: null, sub: null, contact: null, checkout: null,
    ftd: null, rd: null, ads: null, ads_with_ftd: null, geos: [],
  };
}

const win = { since: "2026-08-01", until: "2026-08-08" };

describe("collectSelected", () => {
  it("находит отмеченный узел в свёрнутой ветке", () => {
    const got = collectSelected([root([ad()])], new Set(["ad:ad_1"]));
    expect(got.map((n) => n.id)).toEqual(["ad:ad_1"]);
  });

  it("неизвестный id молча игнорируется", () => {
    expect(collectSelected([root([ad()])], new Set(["ad:нет"]))).toEqual([]);
  });
});

describe("dedupeByAncestor", () => {
  it("выбрасывает потомков отмеченного предка", () => {
    const all = collectSelected([root([ad()])],
      new Set(["camp:act_1:camp_1", "ad:ad_1"]));
    expect(dedupeByAncestor(all).map((n) => n.id)).toEqual(["camp:act_1:camp_1"]);
  });

  it("не трогает узлы из разных веток", () => {
    const r = root([
      ad({ fb_id: "ad_1" }),
      ad({ fb_id: "ad_2", act_id: "act_2", campaign_id: "camp_2", adset_id: "adset_2" }),
    ]);
    const all = collectSelected([r], new Set(["ad:ad_1", "ad:ad_2"]));
    expect(dedupeByAncestor(all)).toHaveLength(2);
  });

  it("ни крео, ни кабинет не заслоняют то, что под ними", () => {
    /* Заслонять может только узел, который `manage` умеет ВЫКЛЮЧИТЬ, то есть
       кампания, адсет или объявление. Ни у крео, ни у кабинета такого объекта
       нет: крео — наша сущность поверх чужих объявлений, а рекламный кабинет
       не выключается вовсе (`manage` делает POST /{id} {status}, и на act_
       Мета ответит ошибкой). Пока кабинет считался предком, отметка каба
       схлопывалась к одному act_id — вызов уходил и не тушил ничего. */
    const r = root([ad()]);
    const all = collectSelected([r], new Set([
      "cr:bangla18", "acct:act_1", "camp:act_1:camp_1",
      "adset:act_1:adset_1", "ad:ad_1",
    ]));
    expect(dedupeByAncestor(all).map((n) => n.id))
      .toEqual(["cr:bangla18", "acct:act_1", "camp:act_1:camp_1"]);
  });

  it("схлопывает цепочку до верхнего узла, у которого есть объект в Мете", () => {
    const all = collectSelected([root([ad()])], new Set([
      "acct:act_1", "camp:act_1:camp_1", "adset:act_1:adset_1", "ad:ad_1",
    ]));
    expect(dedupeByAncestor(all).map((n) => n.id))
      .toEqual(["acct:act_1", "camp:act_1:camp_1"]);
  });
});

describe("buildManagePayload", () => {
  it("группирует вызовы по соцам", () => {
    const r = root([
      ad({ fb_id: "ad_1", owner_profile: "k1f9qbcs" }),
      ad({
        fb_id: "ad_2", act_id: "act_2", campaign_id: "camp_2",
        adset_id: "adset_2", owner_profile: "k1ffja5h",
      }),
    ]);
    const nodes = collectSelected([r], new Set(["ad:ad_1", "ad:ad_2"]));
    const p = buildManagePayload(nodes, { action: "pause", ...win });
    expect(p.вызовы).toHaveLength(2);
    expect(p.вызовы.map((c) => c.profile_name)).toEqual(["k1f9qbcs", "k1ffja5h"]);
  });

  it("кабы одного соца — один вызов", () => {
    const r = root([
      ad({ fb_id: "ad_1" }),
      ad({ fb_id: "ad_2", act_id: "act_2", campaign_id: "camp_2", adset_id: "adset_2" }),
    ]);
    const nodes = collectSelected([r], new Set(["ad:ad_1", "ad:ad_2"]));
    const p = buildManagePayload(nodes, { action: "pause", ...win });
    expect(p.вызовы).toHaveLength(1);
    expect([...p.вызовы[0].object_ids].sort()).toEqual(["ad_1", "ad_2"]);
  });

  it("каб без соца-исполнителя уходит в «не потушить», а не в вызовы", () => {
    const nodes = collectSelected([root([ad({ owner_profile: null })])],
      new Set(["ad:ad_1"]));
    const p = buildManagePayload(nodes, { action: "pause", ...win });
    expect(p.вызовы).toHaveLength(0);
    expect(p.не_потушить).toEqual([
      { act_id: "act_1", причина: "соц не подключён", объектов: 1 },
    ]);
  });

  it("k1fg9weq — обычный исполнитель: запрета на открытие больше нет", () => {
    const nodes = collectSelected([root([ad({ owner_profile: "k1fg9weq" })])],
      new Set(["ad:ad_1"]));
    const p = buildManagePayload(nodes, { action: "pause", ...win });
    expect(p.вызовы).toEqual([{ profile_name: "k1fg9weq", object_ids: ["ad_1"] }]);
    expect(p.не_потушить).toEqual([]);
  });

  it("итого считается после дедупа, а не по отметкам", () => {
    const nodes = collectSelected([root([ad({ spend: 10, ftd: 1 })])], new Set([
      "acct:act_1", "camp:act_1:camp_1", "ad:ad_1",
    ]));
    const p = buildManagePayload(nodes, { action: "pause", ...win });
    expect(p.итого.объектов).toBe(1);
    expect(p.итого.спенд).toBe(10);
    expect(p.итого.ftd).toBe(1);
    expect(p.вызовы[0].object_ids).toEqual(["camp_1"]);
  });

  it("отметка кабинета уезжает его кампаниями, а не act_id", () => {
    /* Рекламный кабинет выключить нельзя: `manage` шлёт POST /{id} с новым
       статусом, и act_ на это ответит ошибкой. Дерево на экране кончается на
       кабе, но в manage вместо него обязаны уехать кампании под ним — иначе
       кнопка выглядит рабочей и не тушит ничего. */
    const nodes = collectSelected([root([ad()])], new Set([
      "acct:act_1", "camp:act_1:camp_1", "adset:act_1:adset_1", "ad:ad_1",
    ]));
    const p = buildManagePayload(nodes, { action: "pause", ...win });
    expect(p.вызовы[0].object_ids).toEqual(["camp_1"]);
  });

  it("в вызовы не попадает ни один act_", () => {
    /* Контрактная страховка на будущее: что бы ни отметили в дереве, ни один
       object_id не может начинаться с act_. */
    const r = root([
      ad({ fb_id: "ad_1" }),
      ad({ fb_id: "ad_2", act_id: "act_2", campaign_id: "camp_2", adset_id: "adset_2" }),
    ]);
    const nodes = collectSelected([r], new Set([
      "cr:bangla18", "acct:act_1", "acct:act_2",
      "camp:act_1:camp_1", "adset:act_1:adset_1", "ad:ad_1",
      "camp:act_2:camp_2", "adset:act_2:adset_2", "ad:ad_2",
    ]));
    const p = buildManagePayload(nodes, { action: "pause", ...win });
    const ids = p.вызовы.flatMap((c) => c.object_ids);
    expect(ids.length).toBeGreaterThan(0);
    expect(ids.filter((i) => i.startsWith("act_"))).toEqual([]);
  });

  it("объявления без спенда и депов всё равно экспортируются", () => {
    const nodes = collectSelected([root([ad({ spend: null, ftd: null })])],
      new Set(["ad:ad_1"]));
    const p = buildManagePayload(nodes, { action: "pause", ...win });
    expect(p.вызовы[0].object_ids).toEqual(["ad_1"]);
    expect(p.итого.спенд).toBe(0);
  });

  it("отметка целого крео уезжает кампаниями, а не пустым списком", () => {
    const r = root([
      ad({ fb_id: "ad_1" }),
      ad({ fb_id: "ad_2", act_id: "act_2", campaign_id: "camp_2", adset_id: "adset_2" }),
    ]);
    const nodes = collectSelected([r], new Set([
      "cr:bangla18", "acct:act_1", "acct:act_2",
      "camp:act_1:camp_1", "adset:act_1:adset_1", "ad:ad_1",
      "camp:act_2:camp_2", "adset:act_2:adset_2", "ad:ad_2",
    ]));
    const p = buildManagePayload(nodes, { action: "pause", ...win });
    expect(p.вызовы).toHaveLength(1);
    expect([...p.вызовы[0].object_ids].sort()).toEqual(["camp_1", "camp_2"]);
    expect(p.итого.объектов).toBe(2);
  });

  it("узел без id объекта в вызовы не попадает", () => {
    // Кампания, которой у нас нет (объявление залито не нашим движком).
    const r = root([ad({ campaign_id: null, campaign: null })]);
    const nodes = collectSelected([r], new Set(["camp:act_1:нет"]));
    const p = buildManagePayload(nodes, { action: "pause", ...win });
    expect(p.вызовы).toHaveLength(0);
  });

  it("без действия payload собирается, но поля «действие» нет", () => {
    const nodes = collectSelected([root([ad()])], new Set(["ad:ad_1"]));
    const p = buildManagePayload(nodes, win);
    expect(p.действие).toBeUndefined();
    expect(p.вызовы).toHaveLength(1);
  });

  it("порядок вызовов детерминирован", () => {
    const r = root([
      ad({ fb_id: "ad_1", owner_profile: "k1zzzz" }),
      ad({ fb_id: "ad_2", act_id: "act_2", campaign_id: "camp_2", adset_id: "adset_2", owner_profile: "k1aaaa" }),
    ]);
    const nodes = collectSelected([r], new Set(["ad:ad_1", "ad:ad_2"]));
    const a = buildManagePayload(nodes, { action: "pause", ...win });
    const b = buildManagePayload([...nodes].reverse(), { action: "pause", ...win });
    expect(a.вызовы.map((c) => c.profile_name)).toEqual(["k1aaaa", "k1zzzz"]);
    expect(JSON.stringify(a.вызовы)).toBe(JSON.stringify(b.вызовы));
  });
});

describe("payloadText", () => {
  it("кладёт преамбулу и валидный JSON", () => {
    const nodes = collectSelected([root([ad()])], new Set(["ad:ad_1"]));
    const text = payloadText(buildManagePayload(nodes, { action: "pause", ...win }));
    expect(text).toContain("manage");
    const json = JSON.parse(text.slice(text.indexOf("{")));
    expect(json.вызовы[0].profile_name).toBe("k1f9qbcs");
    expect(json.действие).toBe("pause");
    expect(json.версия).toBe(1);
  });
});
