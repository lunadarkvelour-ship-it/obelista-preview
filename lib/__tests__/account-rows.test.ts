import { describe, it, expect } from "vitest";
import { accountRows, otherOwners } from "@/lib/account-rows";
import { freshProfiles } from "@/lib/staleness";
import type { Snapshot } from "@/lib/types";

/* Кабинет — сущность, соц — способ его увидеть.
 *
 * Лист строился произведением профиль×каб: на живом снапшоте 13.08 это 209
 * строк на 138 кабинетов. Чинить простым `unique(act_id)` нельзя — движок
 * резолвит кабы внутри профиля, и строка, потерявшая рабочего соца, меняет баг
 * «видно дважды» на баг «залив не идёт».
 *
 * Слепок с живых данных: act_1574869187497859 числился за пятью соцами при
 * одном живом; k1f15y8n и k1fn9qb1 были в антике, но без токена — то есть
 * несвежие и при этом НЕ выбывшие.
 */

const СЕЙЧАС = Date.parse("2026-08-13T00:06:00+02:00");
const СВЕЖО = "2026-08-13T00:06:00+02:00";
const ВЧЕРА = "2026-08-12T09:08:00+02:00";

const снап = (profiles: Snapshot["profiles"]): Snapshot => ({
  generated_at: СВЕЖО,
  profiles,
});

describe("свежесть — это не существование", () => {
  it("свежий сбор виден, вчерашний нет", () => {
    const s = снап({
      свежий: { collected_at: СВЕЖО, accounts: [] },
      вчерашний: { collected_at: ВЧЕРА, accounts: [] },
      безметки: { accounts: [] },
    });
    expect([...freshProfiles(s, СЕЙЧАС)]).toEqual(["свежий"]);
  });

  it("несвежий соц, который есть в антике, выбывшим не считается", () => {
    // k1f15y8n / k1fn9qb1: в антике есть, токена прилы нет, приезжают из
    // файловой половины склейки. Посчитать их выбывшими = спрятать их кабы.
    const s = снап({ k1f15y8n: { collected_at: ВЧЕРА, accounts: [{ id: "act_1", name: "каб" }] } });
    const rows = accountRows(s, { present: new Set(["k1f15y8n"]), now: СЕЙЧАС });
    expect(rows[0].owners[0].present).toBe(true);
    expect(rows[0].owners[0].fresh).toBe(false);
  });

  it("антик не ответил — никого не объявляем выбывшим", () => {
    const s = снап({ p1: { collected_at: ВЧЕРА, accounts: [{ id: "act_1", name: "каб" }] } });
    expect(accountRows(s, { present: null, now: СЕЙЧАС })[0].owners[0].present).toBeNull();
  });
});

describe("схлопывание кабинетов", () => {
  const пятеро = () => {
    const каб = { id: "act_1574869187497859", name: "MeDuA6aeP 31/7-16" };
    return снап({
      k1ffja5h: { label: "MeDuA6aeP 6/8 spx", collected_at: СВЕЖО, accounts: [каб] },
      k1f8exx4: { label: "выбыл", collected_at: ВЧЕРА, accounts: [каб] },
      k1fakkde: { label: "выбыл", collected_at: ВЧЕРА, accounts: [каб] },
      k1fgahnf: { label: "выбыл", collected_at: ВЧЕРА, accounts: [каб] },
      k1fhk1yb: { label: "выбыл", collected_at: ВЧЕРА, accounts: [каб] },
    });
  };

  it("один каб на пяти соцах даёт одну строку и пять владельцев", () => {
    const rows = accountRows(пятеро(), {
      present: new Set(["k1ffja5h"]),
      oauth: new Set(["k1ffja5h"]),
      now: СЕЙЧАС,
    });
    expect(rows).toHaveLength(1);
    expect(rows[0].owners).toHaveLength(5);
    expect(rows[0].profile).toBe("k1ffja5h");
    expect(otherOwners(rows[0]).every((o) => o.present === false)).toBe(true);
  });

  it("выбывший из антика не становится главным, даже если подключён", () => {
    // Токен в базе переживает уход профиля из антика: k1fhk1yb ушёл 11.08, а
    // его строка в `token` осталась. Лить с несуществующего профиля нельзя.
    const каб = { id: "act_1", name: "каб" };
    const s = снап({
      призрак_с_токеном: { collected_at: СВЕЖО, accounts: [каб] },
      живой_без_токена: { collected_at: ВЧЕРА, accounts: [каб] },
    });
    const rows = accountRows(s, {
      present: new Set(["живой_без_токена"]),
      oauth: new Set(["призрак_с_токеном"]),
      now: СЕЙЧАС,
    });
    expect(rows[0].profile).toBe("живой_без_токена");
  });

  it("среди живых главным становится подключённый, а не первый по алфавиту", () => {
    const каб = { id: "act_1", name: "каб" };
    const s = снап({
      aaa_без_токена: { collected_at: СВЕЖО, accounts: [каб] },
      zzz_с_токеном: { collected_at: СВЕЖО, accounts: [каб] },
    });
    const rows = accountRows(s, {
      present: new Set(["aaa_без_токена", "zzz_с_токеном"]),
      oauth: new Set(["zzz_с_токеном"]),
      now: СЕЙЧАС,
    });
    expect(rows[0].profile).toBe("zzz_с_токеном");
  });

  it("данные берутся у самого свежего владельца, а не у главного", () => {
    // Главный выбран по годности к заливу. Показывать его вчерашние цифры
    // только поэтому — то же враньё, против которого весь модуль.
    const s = снап({
      льём_отсюда: { collected_at: ВЧЕРА, accounts: [{ id: "act_1", name: "старое имя", status: "ACTIVE" }] },
      собрано_свежее: { collected_at: СВЕЖО, accounts: [{ id: "act_1", name: "новое имя", status: "DISABLED" }] },
    });
    const rows = accountRows(s, {
      present: new Set(["льём_отсюда", "собрано_свежее"]),
      oauth: new Set(["льём_отсюда"]),
      now: СЕЙЧАС,
    });
    expect(rows[0].profile).toBe("льём_отсюда");
    expect(rows[0].acc.name).toBe("новое имя");
    expect(rows[0].acc.status).toBe("DISABLED");
  });

  it("разные кабы не склеиваются", () => {
    const s = снап({
      p1: { collected_at: СВЕЖО, accounts: [{ id: "act_1", name: "а" }, { id: "act_2", name: "б" }] },
    });
    expect(accountRows(s, { now: СЕЙЧАС })).toHaveLength(2);
  });

  it("кабинет без id остаётся отдельной строкой, а не растворяется", () => {
    const s = снап({
      p1: { collected_at: СВЕЖО, accounts: [{ id: "", name: "битый" } as never] },
      p2: { collected_at: СВЕЖО, accounts: [{ id: "", name: "другой битый" } as never] },
    });
    expect(accountRows(s, { now: СЕЙЧАС })).toHaveLength(2);
  });

  it("also_on добавляет соца, которого нет в обходе профилей", () => {
    const s = снап({
      p1: {
        collected_at: СВЕЖО,
        accounts: [{ id: "act_1", name: "каб", also_on: [{ profile: "p_чужой", label: "второй вход" }] }],
      },
    });
    const rows = accountRows(s, { present: new Set(["p1", "p_чужой"]), now: СЕЙЧАС });
    expect(rows).toHaveLength(1);
    expect(otherOwners(rows[0]).map((o) => o.profile)).toEqual(["p_чужой"]);
  });

  it("also_on не плодит владельца, если соц уже найден обходом", () => {
    const каб = { id: "act_1", name: "каб", also_on: [{ profile: "p2" }] };
    const s = снап({
      p1: { collected_at: СВЕЖО, accounts: [каб] },
      p2: { collected_at: СВЕЖО, accounts: [{ id: "act_1", name: "каб" }] },
    });
    expect(accountRows(s, { now: СЕЙЧАС })[0].owners).toHaveLength(2);
  });

  it("пустой снапшот не роняет", () => {
    expect(accountRows(null)).toEqual([]);
    expect(accountRows({ profiles: {} })).toEqual([]);
  });
});
