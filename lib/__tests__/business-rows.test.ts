import { describe, it, expect } from "vitest";
import { businessRows } from "@/lib/business-rows";
import type { AccountRow, AccountOwner } from "@/lib/account-rows";
import type { SnapshotAccount } from "@/lib/types";

/* Зачем этот тест существует.
 *
 * Лист «Agencies» — та же коллекция кабинетов, что и «Кабинеты», только
 * собранная по Business Manager, и вся его честность (иссус #35 «панель не
 * врёт») держится на нескольких решениях, которые рефакторинг легко тихо
 * ломает:
 *  - имя БМ не парсится и не нормализуется, кроме обрезки краевых пробелов —
 *    закупочная партия в имени остаётся как есть, а не «улучшается»;
 *  - кабинет без БМ не теряется и не притворяется группой с пустым именем;
 *  - числовой `business` — это id, а не имя, и это обязано быть видно в
 *    данных, которые уйдут в UI;
 *  - деньги в снапшоте приезжают то числом, то строкой с валютой, и сумма по
 *    группе обязана считать оба вида одинаково — иначе половина группы
 *    молча выпадает из спенда;
 *  - но РАЗНЫЕ валюты (не только разный формат одной) в эту сумму смешиваться
 *    не должны: курса нет, и наврать числом хуже, чем честно не сложить;
 *  - «бан» и «биллинг» — разные факты про кабинет, и статус обязан попадать
 *    ровно в одну из известных корзин или в `other`, а не в `banned` по
 *    умолчанию только потому, что он не `ACTIVE`.
 * Сломай любое из этого — и лист либо врёт цифрами, либо прячет кабинеты.
 */

function owner(profile: string): AccountOwner {
  return { profile, label: profile, present: true, fresh: true, oauth: true };
}

/** Собирает `AccountRow`, как будто он уже прошёл через `accountRows()`
 *  (схлопывание дублей). Группировке нужен именно готовый ряд, а не сырой
 *  снапшот — так и тестируем. */
function row(acc: Partial<SnapshotAccount> & { id: string }, profile = "p1"): AccountRow {
  return {
    acc: acc as SnapshotAccount,
    profile,
    profileLabel: profile,
    owners: [owner(profile)],
  };
}

describe("группировка по business и итоги по группе", () => {
  it("складывает кабинеты одного БМ в одну группу и считает все итоги", () => {
    const rows = [
      row({
        id: "act_1",
        business: "BM Vip 6859",
        status: "ACTIVE",
        spent: "10.50 USD",
        limit: 50,
        funding: "Visa · 1234",
        pixels: [{ id: "px1" }],
      }),
      row({
        id: "act_2",
        business: "BM Vip 6859",
        status: "DISABLED",
        spent: "5.25 USD",
        limit: 20,
        pixels: [{ id: "px1" }, { id: "px2" }],
      }),
    ];
    const groups = businessRows(rows);
    expect(groups).toHaveLength(1);
    const g = groups[0];
    expect(g.business).toBe("BM Vip 6859");
    expect(g.noBusiness).toBe(false);
    expect(g.cabs).toBe(2);
    expect(g.live).toBe(1);
    expect(g.banned).toBe(1);
    expect(g.billing).toBe(0);
    expect(g.other).toBe(0);
    expect(g.spendUsd).toBeCloseTo(15.75);
    expect(g.limitUsd).toBe(70);
    expect(g.excludedCurrencyCabs).toBe(0);
    expect(g.excludedCurrencies).toEqual([]);
    expect(g.withCard).toBe(1);
    expect(g.pixels).toBe(2); // px1 общий на двух кабах, px2 — свой
  });

  it("разные БМ не смешиваются в одну группу", () => {
    const rows = [
      row({ id: "act_1", business: "Barnes George 06 08 2026 14 20 22" }),
      row({ id: "act_2", business: "Fundvibe Group 82252" }),
    ];
    expect(businessRows(rows)).toHaveLength(2);
  });

  it("деньги-число и деньги-строка с валютой считаются в сумме одинаково", () => {
    const rows = [
      row({ id: "act_1", business: "x", spent: 10 }),
      row({ id: "act_2", business: "x", spent: "5.5 USD" }),
      row({ id: "act_3", business: "x", spent: undefined }),
    ];
    expect(businessRows(rows)[0].spendUsd).toBeCloseTo(15.5);
  });
});

/* Ревью #50: два блокера, оба подтверждены на живом снапшоте.
 *
 *  1. `spend += moneyNum(...)` без единого обращения к `SnapshotAccount.currency`
 *     складывало доллары с донгами как одно число — живой каб с
 *     `currency=VND` сегодня спасает только нулевой спенд. Курсов нет и
 *     придумывать их нельзя, поэтому чужая валюта не входит в сумму, а
 *     считается отдельно (`excludedCurrencyCabs`/`excludedCurrencies`).
 *  2. `banned = rows.length - live` считало биллинг (`UNSETTLED`, 8 кабов на
 *     живом снапшоте) баном — раскрытая группа сама себе противоречила:
 *     шапка «бан», а точка статуса кабинета красит его жёлтым «биллинг»
 *     (`health-bits.tsx: statusMeta`). Теперь три известные корзины и
 *     четвёртая про запас считаются СЛОЖЕНИЕМ, а не выводом остатка. */

describe("валюта — разные валюты не складываются в одну сумму", () => {
  it("кабинет другой валюты исключается из spendUsd/limitUsd и учитывается отдельно", () => {
    const rows = [
      row({ id: "act_1", business: "x", spent: "10 USD", limit: 50, currency: "USD" }),
      // Живой случай 13.08: каб с currency=VND. Числа настоящие — донги,
      // не доллары; курса USD/VND (порядка 25000:1) у нас нет.
      row({ id: "act_2", business: "x", spent: 49000, limit: 100000, currency: "VND" }),
    ];
    const g = businessRows(rows)[0];
    expect(g.spendUsd).toBe(10);
    expect(g.limitUsd).toBe(50);
    expect(g.excludedCurrencyCabs).toBe(1);
    expect(g.excludedCurrencies).toEqual(["VND"]);
  });

  it("несколько чужих валют — все перечислены и отсортированы, ни одна не потеряна", () => {
    const rows = [
      row({ id: "act_1", business: "x", spent: 1, currency: "VND" }),
      row({ id: "act_2", business: "x", spent: 1, currency: "EUR" }),
      row({ id: "act_3", business: "x", spent: 1, currency: "VND" }),
    ];
    const g = businessRows(rows)[0];
    expect(g.excludedCurrencyCabs).toBe(3);
    expect(g.excludedCurrencies).toEqual(["EUR", "VND"]); // отсортировано, без дублей
    /* Сложить было НЕЧЕГО — и это `null`, а не ноль. Ноль означал бы «в
       основной валюте не тратили», хотя в основной валюте тут нет ни одного
       кабинета. */
    expect(g.spendUsd).toBe(null);
  });

  it("без указанной валюты считается основной — тот же дефолт, что и весь остальной UI", () => {
    // Большинство кабинетов паркуются без явного currency в снапшоте; считать
    // их «неизвестной валютой» и выкидывать из суммы значило бы обнулить
    // тотал почти всем группам, хотя реально это доллары.
    const rows = [row({ id: "act_1", business: "x", spent: "10 USD" })];
    const g = businessRows(rows)[0];
    expect(g.spendUsd).toBe(10);
    expect(g.excludedCurrencyCabs).toBe(0);
  });

  it("регистр и пробелы в currency не мешают сравнению с основной валютой", () => {
    const rows = [row({ id: "act_1", business: "x", spent: 10, currency: " usd " })];
    const g = businessRows(rows)[0];
    expect(g.spendUsd).toBe(10);
    expect(g.excludedCurrencyCabs).toBe(0);
  });
});

/* Итог агентства НАСЛЕДУЕТ незнание строк, а не превращает его в ноль (#122).
 *
 * Нашла эту форму чужая ловушка (`totals-inherit-silence.test.ts`), и она была
 * ровно той, на которую час назад ругался владелец в аналитике: строки честно
 * говорят «не собрано», а итог под ними показывает 0. Итог читают ПОСЛЕДНИМ и
 * на нём останавливаются — ноль в выводе отменяет честность всех строк разом.
 */
describe("непарсящаяся сумма не превращается в ноль", () => {
  it("группа, где сумму не дал никто, отдаёт null, а не 0", () => {
    const rows = [
      row({ id: "act_1", business: "x", spent: undefined }),
      row({ id: "act_2", business: "x", spent: "—" }),
    ];
    const g = businessRows(rows)[0];
    expect(g.spendUsd).toBe(null);
    /* И сказано, сколько строк не сложилось: итог, в котором часть строк
       пропущена, выглядит полным. */
    expect(g.spendUnknown).toBe(2);
  });

  it("частичный случай: сумма считается, а неполнота названа числом", () => {
    const rows = [
      row({ id: "act_1", business: "x", spent: "10 USD", limit: 50 }),
      row({ id: "act_2", business: "x", spent: undefined, limit: undefined }),
    ];
    const g = businessRows(rows)[0];
    expect(g.spendUsd).toBe(10);
    expect(g.spendUnknown).toBe(1);
    expect(g.limitUsd).toBe(50);
    expect(g.limitUnknown).toBe(1);
  });

  it("ноль остаётся нулём: посчитанный ноль и несложенное — разные вещи", () => {
    const g = businessRows([row({ id: "act_1", business: "x", spent: 0 })])[0];
    expect(g.spendUsd).toBe(0);
    expect(g.spendUnknown).toBe(0);
  });

  it("группа без единой суммы уходит ВНИЗ, а не встаёт как нулевая", () => {
    /* Ноль — это факт («не тратили»), а null значит «сложить было нечего».
       Поставить их рядом значит утверждать про вторую то же, что про первую. */
    const groups = businessRows([
      row({ id: "act_1", business: "нечего складывать", spent: undefined }),
      row({ id: "act_2", business: "ноль", spent: 0 }),
      row({ id: "act_3", business: "деньги", spent: 5 }),
    ]);
    expect(groups.map((g) => g.business)).toEqual(["деньги", "ноль", "нечего складывать"]);
  });
});

describe("статусы — живые/бан/биллинг раздельно, без вычитания остатка", () => {
  it("ACTIVE — live, DISABLED — banned, UNSETTLED — billing, и они не путаются", () => {
    const rows = [
      row({ id: "act_1", business: "x", status: "ACTIVE" }),
      row({ id: "act_2", business: "x", status: "DISABLED" }),
      row({ id: "act_3", business: "x", status: "UNSETTLED" }),
    ];
    const g = businessRows(rows)[0];
    expect(g.live).toBe(1);
    expect(g.banned).toBe(1);
    expect(g.billing).toBe(1);
    expect(g.other).toBe(0);
  });

  it("IN_GRACE_PERIOD — та же корзина billing, что и UNSETTLED", () => {
    const rows = [row({ id: "act_1", business: "x", status: "IN_GRACE_PERIOD" })];
    const g = businessRows(rows)[0];
    expect(g.billing).toBe(1);
    expect(g.banned).toBe(0);
  });

  it("незнакомый или будущий статус уходит в other, а не молча в banned", () => {
    const rows = [row({ id: "act_1", business: "x", status: "SOME_STATUS_META_MIGHT_ADD_TOMORROW" })];
    const g = businessRows(rows)[0];
    expect(g.banned).toBe(0);
    expect(g.billing).toBe(0);
    expect(g.other).toBe(1);
  });

  it("PENDING_RISK_REVIEW (та же тональность, что билинг, но другой ярлык) — тоже other, не billing", () => {
    const rows = [row({ id: "act_1", business: "x", status: "PENDING_RISK_REVIEW" })];
    const g = businessRows(rows)[0];
    expect(g.billing).toBe(0);
    expect(g.other).toBe(1);
  });

  it("четыре корзины в сумме всегда равны cabs — сложением, а не вычитанием", () => {
    const rows = [
      row({ id: "act_1", business: "x", status: "ACTIVE" }),
      row({ id: "act_2", business: "x", status: "DISABLED" }),
      row({ id: "act_3", business: "x", status: "UNSETTLED" }),
      row({ id: "act_4", business: "x", status: "PENDING_RISK_REVIEW" }),
      row({ id: "act_5", business: "x" }), // статус вовсе не задан
    ];
    const g = businessRows(rows)[0];
    expect(g.live + g.banned + g.billing + g.other).toBe(g.cabs);
  });
});

describe("кабинеты без БМ", () => {
  it("уходят в отдельную группу, а не пропадают и не сливаются с именованными", () => {
    const rows = [
      row({ id: "act_1", business: "BM Vip 6859" }),
      row({ id: "act_2" }), // business вовсе не задан
    ];
    const groups = businessRows(rows);
    const noBiz = groups.find((g) => g.noBusiness);
    expect(noBiz).toBeDefined();
    expect(noBiz!.cabs).toBe(1);
    expect(noBiz!.rows[0].acc.id).toBe("act_2");
    expect(groups.find((g) => !g.noBusiness && g.business === "BM Vip 6859")).toBeDefined();
  });

  it("пустая строка и одни пробелы не создают группу-призрак — обе уходят в «без БМ»", () => {
    const rows = [
      row({ id: "act_1", business: "" }),
      row({ id: "act_2", business: "   " }),
    ];
    const groups = businessRows(rows);
    expect(groups).toHaveLength(1);
    expect(groups[0].noBusiness).toBe(true);
    expect(groups[0].business).toBe("");
    expect(groups[0].cabs).toBe(2);
  });

  it("группа без БМ идёт последней, даже если её спенд больше всех остальных", () => {
    const rows = [
      row({ id: "act_1", business: "BM Vip 6859", spent: "1 USD" }),
      row({ id: "act_2", spent: "999 USD" }), // без business
    ];
    const groups = businessRows(rows);
    expect(groups[groups.length - 1].noBusiness).toBe(true);
  });

  it("нет кабинетов без БМ — группы «без БМ» вовсе нет в списке", () => {
    const rows = [row({ id: "act_1", business: "BM Vip 6859" })];
    expect(businessRows(rows).some((g) => g.noBusiness)).toBe(false);
  });
});

describe("числовой business — это id, а не имя", () => {
  it("строка из одних цифр помечается isId", () => {
    const rows = [row({ id: "act_1", business: "100002904722102" })];
    expect(businessRows(rows)[0].isId).toBe(true);
  });

  it("имя с буквами isId не ставит, даже если внутри есть цифры", () => {
    const rows = [row({ id: "act_1", business: "BM Vip 6859" })];
    expect(businessRows(rows)[0].isId).toBe(false);
  });
});

describe("сортировка групп", () => {
  it("по спенду убывания по умолчанию", () => {
    const rows = [
      row({ id: "act_1", business: "дешёвый", spent: "10 USD" }),
      row({ id: "act_2", business: "дорогой", spent: "500 USD" }),
      row({ id: "act_3", business: "средний", spent: "100 USD" }),
    ];
    const order = businessRows(rows).map((g) => g.business);
    expect(order).toEqual(["дорогой", "средний", "дешёвый"]);
  });
});

it("пустой список кабинетов не роняет группировку", () => {
  expect(businessRows([])).toEqual([]);
});
