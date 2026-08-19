import { describe, expect, it } from "vitest";
import { matchAcc, parseAccQuery, unmatched } from "@/lib/acc-query";

/* Разбор вставленного списка кабинетов.
 *
 * Ошибка здесь молчит и стоит денег: список отберёт на один кабинет больше или
 * меньше, человек нажмёт «отметить найденные», и залив уйдёт не туда. Заметно
 * это станет по спенду через сутки.
 */

const acc = (id: string, name?: string) => ({ id, name });

describe("что считается списком", () => {
  it("одна строка — обычный поиск подстрокой", () => {
    const q = parseAccQuery("spx");
    expect(q.list).toBe(false);
    expect(matchAcc(q, acc("act_1", "MeDuA6aeP spx 7/8"), "k1a", "лейбл")).toBe(true);
  });

  it("две и больше — точный отбор", () => {
    expect(parseAccQuery("act_111\nact_222").list).toBe(true);
    expect(parseAccQuery("act_111, act_222").list).toBe(true);
  });

  it("пустой запрос пропускает всё", () => {
    const q = parseAccQuery("   ");
    expect(matchAcc(q, acc("act_9", "что угодно"), "k1a", "л")).toBe(true);
  });
});

describe("формы списка, которые приносят из работы", () => {
  const парк = [
    acc("act_1922799508390605", "MeDuA6aeP 10/8- 1"),
    acc("act_1299888485555951", "MeDuA6aeP 10/8- 2"),
    acc("act_1558103735693729", "MeDuA6aeP 10/8- 6"),
    acc("act_1712129746672454", "Hiuhiu_MediaBuyer3_10.8_1"),
    acc("act_9999999999999999", "Чужой кабинет"),
  ];
  const отобрать = (raw: string) => {
    const q = parseAccQuery(raw);
    return парк.filter((a) => matchAcc(q, a, "k1a", "лейбл")).map((a) => a.id);
  };

  it("только голые id", () => {
    expect(отобрать("1922799508390605\n1712129746672454")).toEqual([
      "act_1922799508390605", "act_1712129746672454",
    ]);
  });

  it("id с префиксом act_", () => {
    expect(отобрать("act_1299888485555951\nact_1558103735693729")).toEqual([
      "act_1299888485555951", "act_1558103735693729",
    ]);
  });

  it("только имена", () => {
    expect(отобрать("MeDuA6aeP 10/8- 1\nMeDuA6aeP 10/8- 2")).toEqual([
      "act_1922799508390605", "act_1299888485555951",
    ]);
  });

  it("имя и id вперемешку — как отдаёт копипаст из Ads Manager", () => {
    const raw = [
      "MeDuA6aeP 10/8- 1", "1922799508390605",
      "MeDuA6aeP 10/8- 6", "1558103735693729",
    ].join("\n");
    expect(отобрать(raw)).toEqual(["act_1922799508390605", "act_1558103735693729"]);
  });

  it("лишние пробелы и пустые строки не мешают", () => {
    expect(отобрать("  MeDuA6aeP   10/8- 1  \n\n\n  1712129746672454 ")).toEqual([
      "act_1922799508390605", "act_1712129746672454",
    ]);
  });

  it("регистр имени не важен", () => {
    expect(отобрать("meduA6AEP 10/8- 1\nMEDUA6AEP 10/8- 2")).toEqual([
      "act_1922799508390605", "act_1299888485555951",
    ]);
  });
});

describe("имя сверяется целиком, а не подстрокой", () => {
  it("«10/8- 1» не захватывает «10/8- 10»", () => {
    /* Тот самый молчаливый промах: список из десяти кабинетов отобрал бы
       одиннадцатый, и лишний каб уехал бы в залив вместе с остальными. */
    const парк = [
      acc("act_1", "MeDuA6aeP 10/8- 1"),
      acc("act_2", "MeDuA6aeP 10/8- 10"),
    ];
    const q = parseAccQuery("MeDuA6aeP 10/8- 1\nMeDuA6aeP 10/8- 2");
    const взяли = парк.filter((a) => matchAcc(q, a, "k1a", "л")).map((a) => a.id);
    expect(взяли).toEqual(["act_1"]);
  });

  it("а одиночный запрос по-прежнему ищет подстрокой", () => {
    const q = parseAccQuery("10/8-");
    expect(matchAcc(q, acc("act_2", "MeDuA6aeP 10/8- 10"), "k1a", "л")).toBe(true);
  });
});

describe("что не нашлось", () => {
  it("возвращает именно пропавшие строки, а не их число", () => {
    const q = parseAccQuery("1922799508390605\nMeDuA6aeP 10/8- 9\n555000111222333");
    const нет = unmatched(q, [acc("act_1922799508390605", "MeDuA6aeP 10/8- 1")]);
    expect(нет).toContain("555000111222333");
    expect(нет).toContain("medua6aep 10/8- 9");
    expect(нет).not.toContain("1922799508390605");
  });

  it("для одиночного поиска пусто — там нечему пропадать", () => {
    expect(unmatched(parseAccQuery("spx"), [])).toEqual([]);
  });
});

describe("что НЕ должно считаться идентификатором", () => {
  it("короткие числа остаются именем", () => {
    /* Иначе кабинет с именем «346» или «7/8» отобрался бы как id и не нашёлся
       бы никогда: сравнение id идёт по другому полю. */
    const q = parseAccQuery("346\n7/8");
    expect(q.ids.size).toBe(0);
    expect(q.names.has("346")).toBe(true);
  });

  it("имя с цифрами внутри — имя", () => {
    const q = parseAccQuery("MeDuA6aeP 10/8- 1\nMeDuA6aeP 10/8- 2");
    expect(q.ids.size).toBe(0);
    expect(q.names.size).toBe(2);
  });
});
