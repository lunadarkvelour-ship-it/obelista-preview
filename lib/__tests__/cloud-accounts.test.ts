import { describe, expect, it } from "vitest";
import {
  DASH, bmGroups, cloudTotals, disableReasonText, dominantCurrency, flatAccounts,
  fundingText, limitCell, minorFactor, money, statusCode, statusText,
  type CloudAccount,
} from "../cloud-accounts";

const каб = (over: Partial<CloudAccount> & { act_id: string }): CloudAccount => ({
  currency: "USD",
  ...over,
});

describe("деньги приходят минорными единицами", () => {
  it("делит на сто ровно один раз", () => {
    expect(money(1234, "USD")).toBe("$12.34");
    expect(money(18500, "USD")).toBe("$185.00");
  });

  it("НЕ делит валюту, у которой минимальная единица и есть единица", () => {
    // 1234 иены — это 1234 иены, а не 12.34. Делить их на сто значит показать
    // сумму в сто раз меньше настоящей.
    expect(minorFactor("JPY")).toBe(1);
    expect(money(1234, "JPY")).toBe("¥1,234");
  });

  it("ноль печатается цифрой, а прочерк достаётся только null", () => {
    // Ноль — самый важный факт из всех: «денег на кабе не осталось» объясняет,
    // почему встал залив. Прочерк на его месте читался бы как «не знаем».
    expect(money(0, "USD")).toBe("$0.00");
    expect(money(null, "USD")).toBe(DASH);
    expect(money(undefined, "USD")).toBe(DASH);
  });

  it("без валюты не подставляет доллар", () => {
    // «$185» у кабинета в донгах — не округление, а другая сумма.
    expect(money(18500, null)).toBe("185.00");
  });

  it("незнакомую валюту Intl печатает сам, кодом вместо знака", () => {
    // Трёхбуквенный код Intl принимает любой, даже несуществующий, и ставит его
    // на место знака. Исключения тут НЕ БУДЕТ — проверено, а не предположено:
    // первая редакция теста ждала своего запасного формата и поймала на том,
    // что запасная ветка на этом входе мёртвая.
    //
    // Пробел между кодом и числом — НЕРАЗРЫВНЫЙ, его ставит сам Intl, и это
    // правильно: код валюты не должен отрываться от суммы переносом строки.
    // Сравниваем с ним же явно, а не «почти таким же» обычным пробелом —
    // иначе тест падает на невидимой глазом разнице.
    expect(money(1234, "ZZZ")).toBe("ZZZ\u00A012.34");
  });

  it("сломанный код валюты не роняет весь лист", () => {
    // `currency` — свободная TEXT-колонка; мусор в ней Intl отвергает
    // исключением, и без запасной ветки оно вынесло бы рендер всей таблицы,
    // а не одну ячейку. Вот вход, на котором эта ветка действительно работает.
    expect(money(1234, "US")).toBe("12.34 US");
  });
});

describe("поля, у которых два имени", () => {
  it("код статуса читается ровно под ОДНИМ именем", () => {
    // Второе имя (метино account_status) читалось «на случай расхождения на
    // стыке» — и это было неправильно: чтение двух имён не защищает от
    // рассинхрона, а прячет его. Пусть лучше поле окажется пустым, и это будет
    // видно сразу. Контракт держит ПМ.
    expect(statusCode(каб({ act_id: "act_1", status_code: 2 }))).toBe(2);
    expect(statusCode(каб({ act_id: "act_1" }))).toBeNull();
    expect(statusCode({ act_id: "act_1", account_status: 2 } as never)).toBeNull();
  });

  it("статус без слова показывается кодом, а не прячется", () => {
    // Незнакомый статус значит «Мета завела новый» — человек должен его увидеть.
    expect(statusText(каб({ act_id: "act_1", status: "ACTIVE" }))).toBe("ACTIVE");
    expect(statusText(каб({ act_id: "act_1", status_code: 42 }))).toBe("status 42");
    expect(statusText(каб({ act_id: "act_1" }))).toBeNull();
  });

  it("причина бана: код 0 значит «причины нет», а не «reason 0»", () => {
    expect(disableReasonText(каб({ act_id: "a", disable_reason: "ad policy" })))
      .toBe("ad policy");
    expect(disableReasonText(каб({ act_id: "a", disable_reason_code: 0 }))).toBeNull();
    expect(disableReasonText(каб({ act_id: "a", disable_reason_code: 12 })))
      .toBe("reason 12");
  });

  it("оплата: пусто значит «карты нет»", () => {
    expect(fundingText(каб({ act_id: "a", funding_display_string: "Visa · 1234" })))
      .toBe("Visa · 1234");
    expect(fundingText(каб({ act_id: "a", funding_type: "CREDIT_CARD" })))
      .toBe("CREDIT_CARD");
    expect(fundingText(каб({ act_id: "a" }))).toBeNull();
  });
});

describe("группировка по Business Manager", () => {
  /* `status_checked_at` стоит у всех намеренно: без него кабинет считается
     неопрошенным, и «нет карты» про него не утверждается вовсе — см. describe
     «не знаем — отдельное состояние агрегата». Здесь проверяется другое, поэтому
     набор говорит «состояние снимали». */
  const СНЯТО = "2026-08-14T09:00:00+00:00";
  const rows: CloudAccount[] = [
    каб({ act_id: "act_1", bm_id: "100", bm_name: "Alpha", amount_spent: 5000,
          status: "ACTIVE", funding_display_string: "Visa · 1111", status_checked_at: СНЯТО }),
    каб({ act_id: "act_2", bm_id: "100", bm_name: "Alpha", amount_spent: 20000,
          status: "DISABLED", status_checked_at: СНЯТО }),
    каб({ act_id: "act_3", bm_id: "200", bm_name: "Alpha", amount_spent: 1000,
          status: "PENDING_CLOSURE", status_checked_at: СНЯТО }),
    каб({ act_id: "act_4", amount_spent: 99900, status: "ACTIVE", status_checked_at: СНЯТО }),
  ];

  it("группирует по id, а не по имени: одинаковые имена — разные БМ", () => {
    const groups = bmGroups(rows);
    const alpha = groups.filter((g) => g.bmId === "100" || g.bmId === "200");
    expect(alpha).toHaveLength(2);
    expect(alpha.map((g) => g.bmId).sort()).toEqual(["100", "200"]);
  });

  it("ТЁЗКИ РАЗЛИЧИМЫ НА ЭКРАНЕ: к одинаковому имени дописан id (#166)", () => {
    /* Жалоба владельца: подряд четыре группы «BM NQ», четыре «2020», три «BM TK
       VAN 1» — с разным составом и без единого способа их различить.
       Замер по базе 15.08 (ВСЕ 268 кабинетов парка): имя «2020» носят 31 разный
       Business Manager, «BM NQ» — 23. Группировка была верной, а заголовок —
       нет, и вина на заголовке. */
    const groups = bmGroups(rows);
    const alpha = groups.filter((g) => g.title.startsWith("Alpha"));
    expect(alpha).toHaveLength(2);
    expect(new Set(alpha.map((g) => g.title)).size).toBe(2);
    for (const g of alpha) expect(g.title).toContain(g.bmId!);
  });

  it("ОДИНОЧНОЙ группе id НЕ дописывается — это был бы шум", () => {
    /* Отрицательный контроль: лечение не должно разрастись на весь экран.
       Различать надо только тех, кого спутали бы. */
    const один = bmGroups(rows.filter((a) => a.bm_id !== "200"));
    const alpha = один.filter((g) => g.bmId === "100");
    expect(alpha).toHaveLength(1);
    expect(alpha[0].title).toBe("Alpha");
  });

  it("кабинеты без БМ уходят в хвост и не сливаются с чужой группой", () => {
    const groups = bmGroups(rows);
    const last = groups[groups.length - 1];
    expect(last.noBm).toBe(true);
    expect(last.accounts.map((a) => a.act_id)).toEqual(["act_4"]);
    // ...даже когда спенда в ней больше всех: 999.00 против 250.00 у Alpha/100.
    expect(last.spent).toBe(99900);
  });

  it("группы идут по потраченному — в ОДНОЙ валюте листа", () => {
    // Сравнивать деньги можно, когда валюта одна: 250.00 у bm 100 против 10.00 у
    // bm 200. Кабинеты в чужой валюте в эту сумму не входят вовсе (см. ниже),
    // поэтому сравнение всегда идёт между сопоставимыми числами.
    const groups = bmGroups(rows).filter((g) => !g.noBm);
    expect(groups.map((g) => g.bmId)).toEqual(["100", "200"]);
  });

  it("валюта с крупными минорными единицами НЕ всплывает наверх", () => {
    // Замер на предпросмотре: группа в донгах (61 300 000 минорных единиц —
    // около $2 400) вставала выше группы на $1 227 просто потому, что у донга
    // минорных единиц больше. Порядок, который выглядит как «где больше денег»
    // и им не является, врёт молча. Теперь донги в сумму не идут совсем —
    // основная валюта листа тут доллар, — и сравнивать нечего.
    const groups = bmGroups([
      каб({ act_id: "act_vnd", bm_id: "vnd", bm_name: "Nam Viet",
            currency: "VND", amount_spent: 61_300_000 }),
      каб({ act_id: "act_usd1", bm_id: "usd", bm_name: "Zenith",
            currency: "USD", amount_spent: 100_000 }),
      каб({ act_id: "act_usd2", bm_id: "usd", bm_name: "Zenith",
            currency: "USD", amount_spent: 22_700 }),
    ]);
    expect(groups.map((g) => g.bmId)).toEqual(["usd", "vnd"]);
  });

  it("имя из одних цифр помечается как id, а не выдаётся за название", () => {
    // «5510» в заголовке читается как название компании, хотя это тот же id,
    // положенный Метой в поле имени.
    const [g] = bmGroups([каб({ act_id: "act_5", bm_id: "5510", bm_name: "5510" })]);
    expect(g.title).toBe("5510");
    expect(g.isId).toBe(true);
  });

  it("настоящее имя id-шкой не метится", () => {
    const [g] = bmGroups([каб({ act_id: "act_6", bm_id: "1178", bm_name: "Zenith" })]);
    expect(g.isId).toBe(false);
  });

  it("кабинеты внутри группы — тоже по потраченному", () => {
    const g = bmGroups(rows).find((x) => x.bmId === "100")!;
    expect(g.accounts.map((a) => a.act_id)).toEqual(["act_2", "act_1"]);
  });

  it("id вместо имени помечается, а не выдаётся за имя", () => {
    const [g] = bmGroups([каб({ act_id: "act_9", bm_id: "777" })]);
    expect(g.title).toBe("777");
    expect(g.isId).toBe(true);
  });

  it("статусы считаются ЕДИНОЙ развилкой: PENDING_CLOSURE — мёртвый", () => {
    // Своего списка мёртвых здесь нет намеренно: отклонённый PR однажды завёл
    // такой, и PENDING_CLOSURE проходил в залив как живой.
    const g = bmGroups(rows).find((x) => x.bmId === "200")!;
    expect(g.counts.disabled).toBe(1);
    expect(g.counts.active).toBe(0);
  });

  it("считает кабинеты без карты", () => {
    const g = bmGroups(rows).find((x) => x.bmId === "100")!;
    expect(g.noCard).toBe(1);
  });

  it("строку без act_id не берёт: её нечем отождествить", () => {
    expect(bmGroups([{ act_id: "" } as CloudAccount])).toEqual([]);
    expect(bmGroups(null)).toEqual([]);
  });
});

describe("лист считается в ОДНОЙ валюте, чужие не подмешиваются", () => {
  // Владелец 14.08: валюты кроме доллара в работе не нужны. Это про приоритет, а
  // не разрешение показать донги как доллары, поэтому основная валюта выбирается
  // счётом кабинетов, складывается только она, а прочие считаются поштучно.
  const rows: CloudAccount[] = [
    каб({ act_id: "act_1", bm_id: "1", bm_name: "Mixed", amount_spent: 10000,
          currency: "USD" }),
    каб({ act_id: "act_2", bm_id: "1", bm_name: "Mixed", amount_spent: 900_000,
          currency: "EUR" }),
    каб({ act_id: "act_3", bm_id: "1", bm_name: "Mixed", amount_spent: 5000,
          currency: "USD" }),
  ];

  it("основная валюта — та, в которой больше кабинетов", () => {
    expect(dominantCurrency(rows)).toBe("USD");
    expect(dominantCurrency([])).toBe("USD");
  });

  it("в сумму идёт только основная валюта, чужие считаются штуками", () => {
    const [g] = bmGroups(rows);
    // 150.00, а не 9150.00: 900 000 евроцентов сюда не входят и не конвертируются.
    expect(g.spent).toBe(15000);
    expect(g.otherCurrency).toBe(1);
    expect(money(g.spent, "USD")).toBe("$150.00");
  });

  it("итог по листу молчать об этом не имеет права", () => {
    const t = cloudTotals(bmGroups(rows));
    expect(t.spent).toBe(15000);
    expect(t.otherCurrency).toBe(1);
  });

  it("одна валюта — никакой оговорки", () => {
    const [g] = bmGroups([
      каб({ act_id: "act_a", bm_id: "1", bm_name: "Solo", amount_spent: 100 }),
      каб({ act_id: "act_b", bm_id: "1", bm_name: "Solo", amount_spent: 900 }),
    ]);
    expect(g.otherCurrency).toBe(0);
    expect(g.accounts.map((a) => a.act_id)).toEqual(["act_b", "act_a"]);
  });
});

describe("плоский список", () => {
  // Решение владельца 14.08: группировка по БМ — переключатель, а не единственный
  // вид. Без группировки это просто строки, по потраченному.
  const rows: CloudAccount[] = [
    каб({ act_id: "act_small", bm_id: "1", bm_name: "A", amount_spent: 100 }),
    каб({ act_id: "act_none", bm_id: "2", bm_name: "B" }),
    каб({ act_id: "act_big", amount_spent: 90_000 }),
    каб({ act_id: "act_zero", bm_id: "1", bm_name: "A", amount_spent: 0 }),
  ];

  it("собирает все строки, независимо от БМ, по потраченному", () => {
    expect(flatAccounts(rows).map((a) => a.act_id))
      .toEqual(["act_big", "act_small", "act_zero", "act_none"]);
  });

  it("чужая валюта уходит в конец, а не встаёт первой по своему числу", () => {
    // Замер на смотрелке: вьетнамский кабинет на пару тысяч долларов встал первой
    // строкой плоского списка — 61 300 000 донгов обогнали 91 500 центов. Донг и
    // цент сравнивать нечем, курса нет; значит место таким строкам в хвосте.
    const порядок = flatAccounts([
      каб({ act_id: "act_vnd", currency: "VND", amount_spent: 61_300_000 }),
      каб({ act_id: "act_usd_big", currency: "USD", amount_spent: 91_500 }),
      каб({ act_id: "act_usd_small", currency: "USD", amount_spent: 100 }),
    ]).map((a) => a.act_id);
    expect(порядок).toEqual(["act_usd_big", "act_usd_small", "act_vnd"]);
  });

  it("то же правило действует и внутри группы", () => {
    const [g] = bmGroups([
      каб({ act_id: "act_vnd", bm_id: "1", bm_name: "A", currency: "VND",
            amount_spent: 61_300_000 }),
      каб({ act_id: "act_usd", bm_id: "1", bm_name: "A", currency: "USD",
            amount_spent: 91_500 }),
    ]);
    expect(g.accounts.map((a) => a.act_id)).toEqual(["act_usd", "act_vnd"]);
  });

  it("ноль стоит выше «не знаем»: ноль это факт, пусто — нет", () => {
    const порядок = flatAccounts(rows).map((a) => a.act_id);
    expect(порядок.indexOf("act_zero")).toBeLessThan(порядок.indexOf("act_none"));
  });

  it("не роняется на пустоте и не тащит строки без act_id", () => {
    expect(flatAccounts(null)).toEqual([]);
    expect(flatAccounts([{ act_id: "" } as CloudAccount])).toEqual([]);
  });
});

describe("«не знаем» — отдельное состояние агрегата, а не ноль", () => {
  // Разбор живого сервера: статуса нет ни у одного кабинета из 261, и шапка
  // показывала «0 active · 0 disabled · 6 no card» — то есть складывала пустоту
  // как факт. Ячейки были честны, агрегат врал, а читают первым его.
  const пусто: CloudAccount[] = [
    каб({ act_id: "act_1", bm_id: "1", bm_name: "A" }),
    каб({ act_id: "act_2", bm_id: "1", bm_name: "A" }),
  ];

  it("статус, которого не снимали, попадает в unknown, а не в «ноль живых»", () => {
    const t = cloudTotals(bmGroups(пусто));
    expect(t.counts.unknown).toBe(2);
    expect(t.counts.active).toBe(0);
    expect(t.counts.disabled).toBe(0);
  });

  it("«нет карты» не приписывается тем, кого не опрашивали", () => {
    // Пустое поле оплаты у неопрошенного кабинета значит «не знаем», а не «карты
    // нет»; сложенное в счётчик, оно давало «нет карты на всём парке» при живых
    // картах у целого профиля.
    const t = cloudTotals(bmGroups(пусто));
    expect(t.noCard).toBe(0);
    expect(t.cardUnknown).toBe(2);
  });

  it("опрошенный кабинет без карты считается именно как «нет карты»", () => {
    const t = cloudTotals(bmGroups([
      каб({ act_id: "act_1", bm_id: "1", bm_name: "A", status: "ACTIVE",
            status_checked_at: "2026-08-14T09:00:00+00:00" }),
    ]));
    expect(t.noCard).toBe(1);
    expect(t.cardUnknown).toBe(0);
  });
});

describe("итог по листу", () => {
  it("группа «без БМ» в счёт Business Manager-ов не идёт", () => {
    const groups = bmGroups([
      каб({ act_id: "act_1", bm_id: "1", bm_name: "A", status: "ACTIVE",
            status_checked_at: "2026-08-14T09:00:00+00:00" }),
      каб({ act_id: "act_2", status: "UNSETTLED",
            status_checked_at: "2026-08-14T09:00:00+00:00" }),
    ]);
    const t = cloudTotals(groups);
    expect(t.accounts).toBe(2);
    expect(t.businesses).toBe(1);
    expect(t.counts.active).toBe(1);
    expect(t.counts.billing).toBe(1);
    expect(t.noCard).toBe(2);
  });
});

describe("лимит трат и дневной лимит — разные вещи", () => {
  const note = "app token does not return the daily limit (adtrust_dsl)";

  it("ноль значит «предел не задан», и это не прочерк", () => {
    const c = limitCell(каб({ act_id: "a", spend_cap: 0, daily_limit_note: note }));
    expect(c.text).toBe("not set");
    expect(c.unset).toBe(true);
  });

  it("отсутствие поля значит «не знаем» — прочерк", () => {
    const c = limitCell(каб({ act_id: "a", daily_limit_note: note }));
    expect(c.text).toBe(DASH);
    expect(c.unset).toBe(false);
  });

  it("значение показывается суммой в валюте кабинета", () => {
    const c = limitCell(каб({ act_id: "a", spend_cap: 50000, currency: "USD" }));
    expect(c.text).toBe("$500.00");
  });

  it("отказ по ДНЕВНОМУ лимиту живёт подсказкой, а не значением ячейки", () => {
    // Слить их в одну ячейку значило бы сказать «предел не задан» там, где на
    // самом деле «дневной лимит этим путём не измеряется».
    for (const cap of [null, 0, 50000]) {
      const c = limitCell(каб({ act_id: "a", spend_cap: cap, daily_limit_note: note }));
      expect(c.hint).toBe(note);
      expect(c.text).not.toContain("adtrust");
    }
  });
});
