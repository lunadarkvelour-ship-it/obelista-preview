import { describe, it, expect } from "vitest";
import { ageWords, staleLine, staleSocials } from "@/lib/staleness";
import type { Snapshot } from "@/lib/types";

/* Панель обязана называть соц, который не собрался.
 *
 * 11.08 сбор по соцу падал, кабинеты подставлялись из прошлого файла, а метка
 * времени бралась от времени попытки — и старые данные выглядели свежими. Пять
 * пошаренных кабинетов «не появлялись», хотя Мета их отдавала.
 */

const СЕЙЧАС = Date.parse("2026-08-11T11:32:00+02:00");

const снапшот = (profiles: Snapshot["profiles"]): Snapshot => ({
  generated_at: "2026-08-11T11:32:00+02:00",
  profiles,
});

describe("несобравшиеся соцы", () => {
  it("соц с ошибкой попадает в список, здоровый — нет", () => {
    const s = снапшот({
      k1упал: {
        label: "keine 6/8",
        collect_error: "Мета отказала: тяжёлая страница",
        collected_at: "2026-08-11T09:14:00+02:00",
        accounts: [{ id: "act_1", name: "старый" }],
      },
      k1живой: {
        label: "keine 7/8",
        collect_error: "",
        collected_at: "2026-08-11T11:32:00+02:00",
        accounts: [{ id: "act_2", name: "свежий" }],
      },
    });

    const stale = staleSocials(s);
    expect(stale.map((x) => x.profile)).toEqual(["k1упал"]);
    expect(stale[0].accounts).toBe(1);
    expect(stale[0].error).toContain("тяжёлая страница");
  });

  it("всё собралось — список пуст, плашки не будет", () => {
    expect(staleSocials(снапшот({ k1a: { collect_error: "", accounts: [] } }))).toEqual([]);
  });

  it("снапшота нет вовсе — не падаем и не пугаем", () => {
    expect(staleSocials(null)).toEqual([]);
    expect(staleSocials(undefined)).toEqual([]);
  });

  it("старый снапшот без новых полей считается здоровым", () => {
    /* Снапшот, записанный до этой правки, лежит в localStorage у всех. Полей
       collect_error/collected_at в нём нет — и это НЕ повод рисовать тревогу:
       иначе после обновления панель у всех закричит на ровном месте. */
    const s = снапшот({ k1a: { accounts: [{ id: "act_1", name: "старый" }] } });
    expect(staleSocials(s)).toEqual([]);
  });
});

describe("строка для человека", () => {
  it("называет соц, число кабинетов и возраст данных", () => {
    const line = staleLine(
      {
        profile: "k1ffja5h",
        label: "keine 6/8",
        error: "токен протух",
        collectedAt: "2026-08-11T09:14:00+02:00",
        accounts: 36,
      },
      СЕЙЧАС,
    );

    expect(line).toContain("k1ffja5h");
    expect(line).toContain("36 ad accounts");
    expect(line).toContain("2 h ago");
  });

  it("время неизвестно — говорим об этом, а не выдумываем", () => {
    expect(ageWords(undefined, СЕЙЧАС)).toBe("unknown time");
    expect(ageWords("мусор", СЕЙЧАС)).toBe("unknown time");
  });
});
