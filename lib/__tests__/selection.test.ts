import { describe, it, expect } from "vitest";
import { cascadeSelect, nodeState, rangeSelect } from "@/lib/selection";
import type { Node, NodeKind } from "@/lib/analytics-tree";

/** Метрики в тестах не участвуют — важна только форма дерева. */
function n(id: string, kind: NodeKind, children?: Node[]): Node {
  return {
    id, kind, label: id, children,
    spend: null, clicks: null, sub: null, contact: null, checkout: null,
    ftd: null, rd: null, ads: null, ads_with_ftd: null, geos: [],
  };
}

/** Полная глубина реального дерева: крео → каб → кампания → адсет → объявление.
 *  Мелкие двухуровневые фикстуры прячут ошибки в рекурсии наверх. */
function deepTree(): Node[] {
  return [
    n("cr1", "creative", [
      n("acc1", "account", [
        n("cmp1", "campaign", [
          n("set1", "adset", [n("ad1", "ad"), n("ad2", "ad")]),
          n("set2", "adset", [n("ad3", "ad")]),
        ]),
      ]),
      n("acc2", "account", [
        n("cmp2", "campaign", [n("set3", "adset", [n("ad4", "ad")])]),
      ]),
    ]),
  ];
}

const ALL_DEEP = [
  "cr1", "acc1", "cmp1", "set1", "ad1", "ad2", "set2", "ad3",
  "acc2", "cmp2", "set3", "ad4",
];

/** Плоский порядок строк как их видит юзер (обход в глубину). */
const FLAT = ALL_DEEP;

describe("каскад вниз", () => {
  it("отметка ветки тянет всех потомков и саму ветку", () => {
    const sel = cascadeSelect(deepTree(), "cmp1", true, new Set());
    // acc1 подтянулся сам: cmp1 — его единственный ребёнок, значит каб отмечен
    // целиком. cr1 не подтянулся — под ним ещё acc2.
    expect([...sel].sort()).toEqual(
      ["acc1", "ad1", "ad2", "ad3", "cmp1", "set1", "set2"].sort(),
    );
    expect(sel.has("cr1")).toBe(false);
  });

  it("отметка листа не трогает соседей", () => {
    const sel = cascadeSelect(deepTree(), "ad1", true, new Set());
    expect(sel.has("ad1")).toBe(true);
    expect(sel.has("ad2")).toBe(false);
  });

  it("снятие ветки уносит всех потомков", () => {
    const roots = deepTree();
    const on = cascadeSelect(roots, "cr1", true, new Set());
    expect([...on].sort()).toEqual([...ALL_DEEP].sort());

    const off = cascadeSelect(roots, "cmp1", false, on);
    expect(off.has("ad1")).toBe(false);
    expect(off.has("set2")).toBe(false);
    // Соседняя ветка цела.
    expect(off.has("ad4")).toBe(true);
    expect(off.has("acc2")).toBe(true);
  });

  it("неизвестный id ничего не меняет", () => {
    const cur = new Set(["ad1"]);
    const sel = cascadeSelect(deepTree(), "нет-такого", true, cur);
    expect([...sel]).toEqual(["ad1"]);
    expect(sel).not.toBe(cur);
  });
});

describe("пересчёт предков вверх", () => {
  it("снятие одного объявления снимает всю цепочку предков", () => {
    const roots = deepTree();
    const on = cascadeSelect(roots, "cr1", true, new Set());
    const off = cascadeSelect(roots, "ad1", false, on);

    // Предок с неполным набором детей уехал бы в manage одним id и потушил
    // только что снятое объявление — потому его снимаем на всех уровнях.
    expect(off.has("set1")).toBe(false);
    expect(off.has("cmp1")).toBe(false);
    expect(off.has("acc1")).toBe(false);
    expect(off.has("cr1")).toBe(false);
    // Всё, что не было задето, осталось.
    expect(off.has("ad2")).toBe(true);
    expect(off.has("set2")).toBe(true);
    expect(off.has("acc2")).toBe(true);
  });

  it("добор последнего ребёнка поднимает отметку до корня", () => {
    const roots = deepTree();
    let sel = new Set<string>();
    for (const id of ["ad1", "ad2", "ad3", "ad4"]) sel = cascadeSelect(roots, id, true, sel);
    expect([...sel].sort()).toEqual([...ALL_DEEP].sort());
  });

  it("добор предпоследнего ребёнка предка ещё не поднимает", () => {
    const roots = deepTree();
    let sel = cascadeSelect(roots, "ad1", true, new Set());
    expect(sel.has("set1")).toBe(false);
    sel = cascadeSelect(roots, "ad2", true, sel);
    expect(sel.has("set1")).toBe(true);
    // cmp1 не полон: set2 ещё пуст.
    expect(sel.has("cmp1")).toBe(false);
  });
});

describe("nodeState", () => {
  const roots = deepTree();
  const cmp1 = roots[0].children![0].children![0];

  it("лист: on/off по наличию в множестве", () => {
    const ad1 = cmp1.children![0].children![0];
    expect(nodeState(ad1, new Set(["ad1"]))).toBe("on");
    expect(nodeState(ad1, new Set())).toBe("off");
  });

  it("ветка: off при пустом множестве", () => {
    expect(nodeState(cmp1, new Set())).toBe("off");
    expect(nodeState(roots[0], new Set())).toBe("off");
  });

  it("ветка: on когда отмечены все потомки", () => {
    const full = cascadeSelect(roots, "cr1", true, new Set());
    expect(nodeState(roots[0], full)).toBe("on");
    expect(nodeState(cmp1, full)).toBe("on");
  });

  it("ветка: part при частичной отметке — на всех уровнях вверх", () => {
    const part = cascadeSelect(roots, "ad1", true, new Set());
    expect(nodeState(cmp1.children![0], part)).toBe("part"); // set1: ad1 да, ad2 нет
    expect(nodeState(cmp1, part)).toBe("part");
    expect(nodeState(roots[0], part)).toBe("part");
    // Нетронутая соседняя ветка остаётся off, а не part.
    expect(nodeState(roots[0].children![1], part)).toBe("off");
  });

  it("ветка с полностью отмеченным одним ребёнком из двух — part", () => {
    const part = cascadeSelect(roots, "set1", true, new Set());
    expect(nodeState(cmp1, part)).toBe("part");
  });

  it("узел с пустым списком детей ведёт себя как лист", () => {
    const empty = n("cmp0", "campaign", []);
    expect(nodeState(empty, new Set())).toBe("off");
    expect(nodeState(empty, new Set(["cmp0"]))).toBe("on");
  });
});

describe("rangeSelect", () => {
  it("берёт диапазон сверху вниз, включая края", () => {
    const sel = rangeSelect(FLAT, "cmp1", "ad2", new Set());
    expect([...sel]).toEqual(["cmp1", "set1", "ad1", "ad2"]);
  });

  it("работает снизу вверх с тем же результатом", () => {
    const down = rangeSelect(FLAT, "cmp1", "ad2", new Set());
    const up = rangeSelect(FLAT, "ad2", "cmp1", new Set());
    expect([...up].sort()).toEqual([...down].sort());
  });

  it("from === to берёт одну строку", () => {
    expect([...rangeSelect(FLAT, "ad3", "ad3", new Set())]).toEqual(["ad3"]);
  });

  it("добавляет к уже отмеченному, не сбрасывая его", () => {
    const sel = rangeSelect(FLAT, "ad1", "ad2", new Set(["ad4"]));
    expect([...sel].sort()).toEqual(["ad1", "ad2", "ad4"]);
  });

  it("неизвестный id — копия cur без изменений", () => {
    const cur = new Set(["ad1"]);
    expect([...rangeSelect(FLAT, "нет-такого", "ad2", cur)]).toEqual(["ad1"]);
    expect([...rangeSelect(FLAT, "ad1", "нет-такого", cur)]).toEqual(["ad1"]);
    expect(rangeSelect(FLAT, "нет-такого", "ad2", cur)).not.toBe(cur);
  });
});

describe("входной Set не мутируется", () => {
  it("cascadeSelect возвращает новый Set", () => {
    const roots = deepTree();
    const cur = new Set(["ad4"]);
    const sel = cascadeSelect(roots, "cmp1", true, cur);
    expect(sel).not.toBe(cur);
    expect([...cur]).toEqual(["ad4"]);
  });

  it("cascadeSelect на снятии не трогает исходный", () => {
    const roots = deepTree();
    const full = cascadeSelect(roots, "cr1", true, new Set());
    const snapshot = [...full].sort();
    cascadeSelect(roots, "ad1", false, full);
    expect([...full].sort()).toEqual(snapshot);
  });

  it("rangeSelect возвращает новый Set", () => {
    const cur = new Set<string>();
    const sel = rangeSelect(FLAT, "ad1", "ad2", cur);
    expect(sel).not.toBe(cur);
    expect(cur.size).toBe(0);
  });
});
