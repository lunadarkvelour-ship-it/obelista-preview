/* Что панель знает о кабинете в развороте крео (#132).
 *
 * Проверяем ровно то, из-за чего владелец видел «шляпу»: имя кабинета лежало в
 * ответе `/ads` и не доезжало до экрана, потому что разметка спрашивала только
 * снапшот мака, которого в облаке нет. И второе: «не спрашивали» обязано
 * остаться «не спрашивали», а не превратиться в живой кабинет (#122).
 */
import { describe, expect, it } from "vitest";
import {
  accountFacts, profileDisplay, profileHint, profileLabels, stateHint,
} from "@/lib/analytics-accounts";
import { buildTree } from "@/lib/analytics-tree";
import type { AdRow } from "@/lib/analytics";
import type { Snapshot } from "@/lib/types";

function ad(over: Partial<AdRow> = {}): AdRow {
  return {
    fb_id: "ad_1",
    ad_name: "hiu--ad--7759--bangla24",
    creative: "bangla24",
    act_id: "act_1398031898947759",
    act_name: "Hiuhiu_MediaBuyer_3.8_2",
    agency: "hiu",
    campaign_id: "camp_1",
    campaign: "hiu--BD--camp",
    adset_id: "adset_1",
    adset: "hiu--adset--1",
    geo: "BD",
    attrib_method: "exact_job",
    attrib_confidence: 1,
    effective_status: "ACTIVE",
    socials: ["k1f9qbcs"],
    owner_profile: "k1f9qbcs",
    spend: 18.73,
    clicks: 597,
    sub: 0,
    contact: 0,
    checkout: 0,
    ftd: 0,
    rd: 0,
    ...over,
  };
}

const snap = (over: Record<string, unknown> = {}): Snapshot =>
  ({
    profiles: {
      k1f9qbcs: {
        accounts: [{ id: "act_1398031898947759", name: "Имя из снапшота", status: "ACTIVE" }],
      },
    },
    ...over,
  }) as unknown as Snapshot;

describe("узел кабинета несёт имя и агентство", () => {
  it("имя кабинета из строк леса доезжает до узла", () => {
    const [acct] = buildTree([ad()]);
    expect(acct.act_name).toBe("Hiuhiu_MediaBuyer_3.8_2");
    expect(acct.agency).toBe("hiu");
    // Подпись строки по-прежнему id: его копируют в manage и в Мету.
    expect(acct.label).toBe("act_1398031898947759");
  });

  it("каба нет в реестре — имени нет, а не пустая строка", () => {
    const [acct] = buildTree([ad({ act_name: null, agency: null })]);
    expect(acct.act_name).toBeNull();
    expect(acct.agency).toBeNull();
  });

  it("имя берётся из первой строки, где оно есть", () => {
    const [acct] = buildTree([
      ad({ fb_id: "ad_1", act_name: null }),
      ad({ fb_id: "ad_2", act_name: "Hiuhiu_MediaBuyer_3.8_2" }),
    ]);
    expect(acct.act_name).toBe("Hiuhiu_MediaBuyer_3.8_2");
  });
});

describe("accountFacts", () => {
  it("имя приезжает из леса, когда снапшота нет вовсе — это и есть облако", () => {
    const f = accountFacts({ ads: [{ act_id: "act_1", act_name: "Каб 1", agency: "hiu" }] });
    expect(f.get("act_1")).toMatchObject({
      name: "Каб 1", name_from: "ads", agency: "hiu",
    });
  });

  it("состояние из базы, имя из базы же — она главнее леса и снапшота", () => {
    const f = accountFacts({
      ads: [{ act_id: "act_1", act_name: "Старое имя" }],
      base: [{
        act_id: "act_1", name: "Новое имя", status: "UNSETTLED",
        status_checked_at: "2026-08-15T04:00:00+00:00",
      }],
      snapshot: snap(),
    });
    expect(f.get("act_1")).toMatchObject({
      name: "Новое имя", name_from: "base",
      status: "UNSETTLED", status_from: "base",
      status_at: "2026-08-15T04:00:00+00:00",
    });
  });

  it("снапшот доносит состояние, когда база о нём молчит", () => {
    const f = accountFacts({
      base: [{ act_id: "act_1398031898947759", name: "Каб" }],
      snapshot: snap(),
    });
    expect(f.get("act_1398031898947759")).toMatchObject({
      status: "ACTIVE", status_from: "snapshot", name: "Каб", name_from: "base",
    });
  });

  it("никто не спрашивал — состояние null, а НЕ «активен» (#122)", () => {
    const f = accountFacts({ ads: [{ act_id: "act_1", act_name: "Каб 1" }] });
    expect(f.get("act_1")!.status).toBeNull();
    expect(f.get("act_1")!.status_from).toBeNull();
  });

  it("пустая строка в имени — это не имя", () => {
    const f = accountFacts({
      ads: [{ act_id: "act_1", act_name: "  " }],
      base: [{ act_id: "act_1", name: "" }],
    });
    expect(f.get("act_1")!.name).toBeNull();
  });

  it("кабинет, которого нет ни в одном источнике, в карту не попадает", () => {
    const f = accountFacts({ ads: [{ act_id: "act_1", act_name: "Каб 1" }] });
    expect(f.get("act_2")).toBeUndefined();
  });
});

describe("stateHint", () => {
  it("про непроверенный кабинет говорит словами, а не молчит", () => {
    const t = stateHint(undefined, "act_1");
    expect(t).toContain("state unknown");
    expect(t).toContain("act_1");
  });

  it("называет состояние, источник и время замера", () => {
    const f = accountFacts({
      base: [{
        act_id: "act_1", status: "DISABLED", disable_reason: "Ad account disabled",
        status_checked_at: "2026-08-15T04:00:00+00:00",
      }],
    });
    const t = stateHint(f.get("act_1"), "act_1");
    expect(t).toContain("DISABLED");
    expect(t).toContain("from the collector");
    expect(t).toContain("2026-08-15T04:00:00+00:00");
    expect(t).toContain("Ad account disabled");
  });
});

/* ЧИТАЕМОЕ ИМЯ СОЦА (XR-25).
 *
 * `k1f9qbcs` в фильтре и на строке кабинета — это id окна антидетекта, а не
 * имя. Имя у нас есть в двух местах, и оба обязаны доехать: `owners[].name` из
 * `/accounts` (единственный источник в облаке) и `profiles[id].label` из
 * снапшота мака. Проверяем и обратное: имя НИГДЕ не заменяет id — оно только
 * добавляется, а id остаётся и в возврате, и в подсказке.
 */
describe("читаемое имя соца", () => {
  it("берёт имя из owners[].name ответа /accounts", () => {
    const m = profileLabels({
      base: [{ act_id: "act_1", owners: [{ profile_id: "k1a", name: "17/7 spx" }] }],
    });
    expect(m.get("k1a")).toBe("17/7 spx");
    expect(profileDisplay("k1a", m)).toBe("17/7 spx");
  });

  it("берёт имя из снапшота, когда база про соца молчит", () => {
    const snapshot = { profiles: { k1b: { label: "keine 3" } } } as Snapshot;
    const m = profileLabels({ base: [{ act_id: "act_1", owners: [] }], snapshot });
    expect(profileDisplay("k1b", m)).toBe("keine 3");
  });

  it("при споре побеждает база — тот же порядок доверия, что у accountFacts", () => {
    const m = profileLabels({
      base: [{ act_id: "act_1", owners: [{ profile_id: "k1a", name: "из базы" }] }],
      snapshot: { profiles: { k1a: { label: "из снапшота" } } } as Snapshot,
    });
    expect(m.get("k1a")).toBe("из базы");
  });

  it("пустое имя и имя, равное id, именем не считаются", () => {
    const m = profileLabels({
      base: [{
        act_id: "act_1",
        owners: [
          { profile_id: "k1a", name: "   " },
          { profile_id: "k1b", name: null },
          { profile_id: "k1c", name: "k1c" },
        ],
      }],
    });
    expect(m.has("k1a")).toBe(false);
    expect(m.has("k1b")).toBe(false);
    expect(m.has("k1c")).toBe(false);
    expect(profileDisplay("k1a", m)).toBe("k1a");
    expect(profileDisplay("k1c", m)).toBe("k1c");
  });

  it("незнакомый соц возвращается id дословно, а не пустой строкой", () => {
    const m = profileLabels({
      base: [{ act_id: "act_1", owners: [{ profile_id: "k1a", name: "17/7 spx" }] }],
    });
    expect(profileDisplay("k1неизвестный", m)).toBe("k1неизвестный");
    expect(profileDisplay("k1a", null)).toBe("k1a");
    expect(profileDisplay("k1a", undefined)).toBe("k1a");
  });

  it("подсказка держит КАЖДЫЙ id, даже когда имена известны все", () => {
    const m = profileLabels({
      base: [{
        act_id: "act_1",
        owners: [
          { profile_id: "k1a", name: "17/7 spx" },
          { profile_id: "k1b", name: "keine 3" },
        ],
      }],
    });
    const hint = profileHint(["k1a", "k1b", "k1c"], m);
    for (const id of ["k1a", "k1b", "k1c"]) expect(hint).toContain(id);
    expect(hint).toContain("17/7 spx (k1a)");
    expect(hint).toContain("keine 3 (k1b)");
    // Безымянный стоит голым id, а не «undefined (k1c)».
    expect(hint).not.toContain("undefined");
    expect(profileHint(["k1a"], null)).toBe("k1a");
  });
});
