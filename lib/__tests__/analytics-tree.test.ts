/* Дерево: пятый уровень и ключи узлов по id.
 *
 *  Ключ кампании раньше собирался из ИМЕНИ (`camp:${act}:${camp}`). Две разные
 *  кампании с одинаковым именем сливались в один узел: разворот показывал чужие
 *  объявления, а потушить их было нечем — `manage` принимает только id.
 *
 *  Уровня адсета не было вовсе, хотя демон отдаёт `adset` с самого начала.
 *  Без него нельзя ни выключить адсет целиком, ни увидеть, что дорогие
 *  объявления сидят в одном из них.
 */
import { describe, expect, it } from "vitest";
import { buildTree, derive, type Node } from "@/lib/analytics-tree";
import { FUNNEL_DERIVED, FUNNEL_METRICS } from "@/lib/funnel-metrics";
import type { AdRow } from "@/lib/analytics";

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

describe("buildTree", () => {
  it("строит пять уровней: каб → кампания → адсет → объявление", () => {
    const [acct] = buildTree([ad()]);
    expect(acct.kind).toBe("account");
    const camp = acct.children![0];
    expect(camp.kind).toBe("campaign");
    const adset = camp.children![0];
    expect(adset.kind).toBe("adset");
    expect(adset.label).toBe("spx--adset--1");
    expect(adset.children![0].kind).toBe("ad");
  });

  it("две кампании с одинаковым именем — два узла, а не один", () => {
    const [acct] = buildTree([
      ad({ fb_id: "ad_1", campaign_id: "camp_1", adset_id: "adset_1" }),
      ad({ fb_id: "ad_2", campaign_id: "camp_2", adset_id: "adset_2" }),
    ]);
    expect(acct.children).toHaveLength(2);
    expect(acct.children!.map((c) => c.id).sort()).toEqual([
      "camp:act_1:camp_1",
      "camp:act_1:camp_2",
    ]);
  });

  it("два адсета с одинаковым именем внутри кампании тоже не сливаются", () => {
    const [acct] = buildTree([
      ad({ fb_id: "ad_1", adset_id: "adset_1", adset: "одно имя" }),
      ad({ fb_id: "ad_2", adset_id: "adset_2", adset: "одно имя" }),
    ]);
    expect(acct.children![0].children).toHaveLength(2);
  });

  it("кладёт fb_id объекта на узлы кампании, адсета и объявления", () => {
    const [acct] = buildTree([ad()]);
    const camp = acct.children![0];
    const adset = camp.children![0];
    expect(camp.fb_id).toBe("camp_1");
    expect(adset.fb_id).toBe("adset_1");
    expect(adset.children![0].fb_id).toBe("ad_1");
  });

  it("проносит соца-исполнителя от каба вниз по всей ветке", () => {
    const [acct] = buildTree([ad()]);
    expect(acct.owner).toBe("k1f9qbcs");
    const camp = acct.children![0];
    expect(camp.owner).toBe("k1f9qbcs");
    expect(camp.children![0].owner).toBe("k1f9qbcs");
    expect(camp.children![0].children![0].owner).toBe("k1f9qbcs");
  });

  it("каб без исполнителя проносит null, а не теряет поле", () => {
    const [acct] = buildTree([ad({ owner_profile: null })]);
    expect(acct.owner).toBeNull();
    expect(acct.children![0].children![0].children![0].owner).toBeNull();
  });

  it("объявление без кампании и адсета не теряется", () => {
    const [acct] = buildTree([
      ad({ campaign_id: null, campaign: null, adset_id: null, adset: null }),
    ]);
    const camp = acct.children![0];
    expect(camp.label).toBe("без кампании");
    expect(camp.fb_id).toBeUndefined();
    const adset = camp.children![0];
    expect(adset.label).toBe("без адсета");
    expect(adset.fb_id).toBeUndefined();
    expect(adset.children![0].fb_id).toBe("ad_1");
  });

  it("суммы сходятся снизу вверх через новый уровень", () => {
    const [acct] = buildTree([
      ad({ fb_id: "ad_1", spend: 10, ftd: 1 }),
      ad({ fb_id: "ad_2", spend: 5, ftd: 2 }),
    ]);
    expect(acct.spend).toBe(15);
    expect(acct.ftd).toBe(3);
    const adset = acct.children![0].children![0];
    expect(adset.spend).toBe(15);
    expect(adset.ftd).toBe(3);
    expect(adset.ads).toBe(2);
  });

  it("id узлов стабильны между вызовами на тех же данных", () => {
    const ids = (rows: AdRow[]) => {
      const out: string[] = [];
      const walk = (ns: ReturnType<typeof buildTree>) => {
        for (const n of ns) { out.push(n.id); walk(n.children || []); }
      };
      walk(buildTree(rows));
      return out;
    };
    expect(ids([ad()])).toEqual(ids([ad()]));
  });
});

/* ── производные строки идут по каталогу, а не по «switch» ────────────────
 *
 * `derive()` больше не перечисляет пары «что на что делим» — он берёт их из
 * `FUNNEL_DERIVED`. Значит проверять надо не пять знакомых случаев, а КАЖДУЮ
 * запись каталога: ступень, заведённая завтра, получит цену автоматически, и
 * молча пропасть из строки она права не имеет. */
describe("derive() покрывает весь каталог производных", () => {
  const узел = (o: Partial<Node>): Node => ({
    id: "n", kind: "creative", label: "n",
    spend: 100, clicks: 200, sub: 50, contact: 25, checkout: 10, ftd: 5, rd: 2,
    ads: 1, ads_with_ftd: 1, geos: [], ...o,
  });

  it("каждая производная каталога считается, а не проваливается в поле узла", () => {
    const n = узел({});
    for (const d of FUNNEL_DERIVED) {
      const v = derive(n, d.id);
      expect(typeof v, `производная ${d.id} не посчиталась`).toBe("number");
      expect(v).toBe(
        (n as unknown as Record<string, number>)[d.numerator]
        / (n as unknown as Record<string, number>)[d.denominator],
      );
    }
  });

  it("НЕТ ЗНАМЕНАТЕЛЯ — ПРОЧЕРК, А НЕ НОЛЬ, по каждой производной", () => {
    /* Ноль в колонке цены читается как «бесплатно», а `null` — как «не из чего
       считать». Разница решает, тушить связку или ждать данных. */
    for (const d of FUNNEL_DERIVED) {
      expect(derive(узел({ [d.denominator]: 0 } as Partial<Node>), d.id), `${d.id} при нуле`)
        .toBeNull();
      expect(derive(узел({ [d.denominator]: null } as Partial<Node>), d.id), `${d.id} при null`)
        .toBeNull();
      expect(derive(узел({ [d.numerator]: null } as Partial<Node>), d.id), `${d.id} без числителя`)
        .toBeNull();
    }
  });

  it("неизвестный ключ по-прежнему читается как поле узла", () => {
    expect(derive(узел({ spend: 42 }), "spend")).toBe(42);
    expect(derive(узел({}), "нетТакого")).toBeNull();
  });

  it("свёртка складывает ровно ступени лидерборда и величины Меты", () => {
    /* Суммируемый набор выводится из каталога. Ступень, добавленная там,
       начинает складываться сама; пропавшая — краснит эту проверку. */
    const дети = [
      ad({ fb_id: "a", spend: 10, clicks: 2, sub: 3, contact: 2, checkout: 1, ftd: 1, rd: 0 }),
      ad({ fb_id: "b", spend: 5, clicks: 1, sub: 2, contact: 1, checkout: 1, ftd: 1, rd: 1 }),
    ];
    const [каб] = buildTree(дети);
    for (const m of FUNNEL_METRICS.filter((x) => x.leaderboard)) {
      expect((каб as unknown as Record<string, number>)[m.id], `${m.id} не сложилось`)
        .toBe(
          (дети[0] as unknown as Record<string, number>)[m.id]
          + (дети[1] as unknown as Record<string, number>)[m.id],
        );
    }
    expect(каб.spend).toBe(15);
    expect(каб.clicks).toBe(3);
  });

  it("сумма, которой не из чего сложиться, — null, а не 0", () => {
    const [каб] = buildTree([
      ad({ fb_id: "a", sub: null, ftd: null }),
      ad({ fb_id: "b", sub: null, ftd: null }),
    ]);
    expect(каб.sub).toBeNull();
    expect(каб.ftd).toBeNull();
    // И цена, выведенная из такой суммы, тоже не ноль.
    expect(derive(каб, "cpsub")).toBeNull();
  });
});
