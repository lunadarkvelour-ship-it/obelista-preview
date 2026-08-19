/* Сведение двух источников в ОДНУ строку листа кабинетов (иссус #121).
 *
 * Почему это проверяется отдельно и подробно. До 15.08 источников было два и
 * листов было два: снапшот мака рисовал один экран, база — другой, а страница
 * выбирала между ними по наличию снапшота. Теперь выбор снят, и вся его цена
 * переехала сюда: если сведение ошибётся, ошибётся ЕДИНСТВЕННЫЙ лист, и заметить
 * это будет негде.
 *
 * Проверяем не «работает ли merge», а то, чем он врёт незаметно: раздваивает
 * кабинет, теряет соцев, показывает сумму в сто раз не ту, выдаёт «не знаем» за
 * ноль.
 */
import { describe, expect, it } from "vitest";
import {
  bmGroups, limitCell, money, snapshotMoney, unifiedAccounts,
  type CloudAccount,
} from "@/lib/cloud-accounts";
import type { AccountOwner, AccountRow } from "@/lib/account-rows";
import type { SnapshotAccount } from "@/lib/types";

const соц = (p: Partial<AccountOwner> & { profile: string }): AccountOwner => ({
  label: "", present: true, fresh: true, oauth: false, ...p,
});

const снап = (acc: Partial<SnapshotAccount> & { id: string },
              owners: AccountOwner[] = [соц({ profile: "k1a" })]): AccountRow => ({
  acc: { name: "", ...acc } as SnapshotAccount,
  profile: owners[0]?.profile || "",
  profileLabel: owners[0]?.label || owners[0]?.profile || "",
  owners,
});

describe("кабинет — первичная сущность: одна строка, сколько бы источников ни было", () => {
  it("тот же каб из снапшота и из базы даёт ОДНУ строку", () => {
    const rows = unifiedAccounts(
      [снап({ id: "act_777", name: "MB3 · hiu · 04" })],
      [{ act_id: "act_777", name: "MB3 · hiu · 04", status: "ACTIVE" }],
    );
    expect(rows).toHaveLength(1);
    expect(rows[0].inSnapshot && rows[0].inCloud).toBe(true);
  });

  it("`act_` не считается частью тождества", () => {
    /* Снапшот и база пишут префикс по-разному, и без нормализации общий каб
       раздваивается — ровно тот дефект, из-за которого счётчик «всего» врал на
       число пересечений. */
    const rows = unifiedAccounts(
      [снап({ id: "act_777" })],
      [{ act_id: "777", status: "ACTIVE" }],
    );
    expect(rows).toHaveLength(1);
    expect(rows[0].status).toBe("ACTIVE");
  });

  it("общий каб на трёх соцах остаётся одной строкой и держит всех соцев", () => {
    const owners = [соц({ profile: "k1a", oauth: true }), соц({ profile: "k1b" }),
                    соц({ profile: "k1c", present: false })];
    const rows = unifiedAccounts([снап({ id: "act_1" }, owners)], []);
    expect(rows).toHaveLength(1);
    expect(rows[0].owners.map((o) => o.profile)).toEqual(["k1a", "k1b", "k1c"]);
    expect(rows[0].profile).toBe("k1a");
  });

  it("кабинет, которого нет в снапшоте, не прячется", () => {
    /* В облаке так выглядит ВЕСЬ парк. Показать только пересечение значило бы
       нарисовать пустой лист при полной базе. */
    const rows = unifiedAccounts([], [{ act_id: "act_9" }]);
    expect(rows).toHaveLength(1);
    expect(rows[0].profile).toBeNull();
    expect(rows[0].pixels).toEqual([]);
  });

  it("кабинет, которого нет в базе, тоже не прячется", () => {
    const rows = unifiedAccounts([снап({ id: "act_8" })], []);
    expect(rows.map((r) => r.act_id)).toEqual(["act_8"]);
  });
});

describe("деньги: один формат на лист, и он минорный", () => {
  it("«1.96 USD» разбирается на число и валюту", () => {
    expect(snapshotMoney("1.96 USD")).toEqual({ value: 1.96, currency: "USD" });
    expect(snapshotMoney(81.66)).toEqual({ value: 81.66, currency: null });
    expect(snapshotMoney(undefined)).toEqual({ value: null, currency: null });
  });

  it("сумма снапшота становится минорными единицами и печатается верно", () => {
    /* Наивный `Number("1.96 USD")` даёт NaN, а `1.96 * 100` в двоичной дроби —
       195.99999999999997. И то и другое видно только глазами и только на живых
       данных, поэтому проверка здесь. */
    const rows = unifiedAccounts([снап({ id: "act_1", spent: "1.96 USD" })], []);
    expect(rows[0].amount_spent).toBe(196);
    expect(money(rows[0].amount_spent, rows[0].currency)).toBe("$1.96");
  });

  it("значение базы побеждает, но НОЛЬ базы не подменяется снапшотом", () => {
    /* Ноль и «не приехало» — разные вещи. `balance = 0` объясняет, почему встал
       залив; подставить вместо него вчерашние 800 значит соврать дважды. */
    const rows = unifiedAccounts(
      [снап({ id: "act_1", balance: "800 USD", spent: "10 USD" })],
      [{ act_id: "act_1", currency: "USD", balance: 0 }],
    );
    expect(rows[0].balance).toBe(0);
    /* А то, чего у базы нет вовсе, остаётся от снапшота — иначе сведение
       превратилось бы в затирание. */
    expect(rows[0].amount_spent).toBe(1000);
  });

  it("валюта без сотых пересчёту не подлежит", () => {
    const rows = unifiedAccounts(
      [снап({ id: "act_1", spent: "61300000 VND", currency: "VND" })],
      [{ act_id: "act_1", currency: "VND" }],
    );
    expect(rows[0].amount_spent).toBe(61_300_000);
  });
});

describe("дневной лимит и предел трат не сливаются в одну величину", () => {
  it("оба живут рядом и подписаны по-разному", () => {
    /* `spend_cap` — потолок за всё время (его отдаёт база), дневной лимит
       приезжает только со снапшота: токеном приложения `adtrust_dsl` не
       снимается вовсе. Подписать потолок «в день» значит соврать в цифре, по
       которой планируют открут. */
    const rows = unifiedAccounts(
      [снап({ id: "act_1", limit: 81.66, currency: "USD" })],
      [{ act_id: "act_1", currency: "USD", spend_cap: 250_000 }],
    );
    expect(rows[0].daily_limit).toBe(8166);
    expect(rows[0].spend_cap).toBe(250_000);
    expect(limitCell(rows[0])).toMatchObject({ text: "$81.66", suffix: "daily" });
  });

  it("без дневного лимита ячейка показывает потолок и говорит, что он не дневной", () => {
    const rows = unifiedAccounts([], [{ act_id: "act_1", currency: "USD", spend_cap: 250_000 }]);
    expect(limitCell(rows[0])).toMatchObject({ text: "$2,500.00", suffix: "lifetime" });
  });

  it("ноль у Меты значит «предел не задан», и это не прочерк", () => {
    const rows = unifiedAccounts([], [{ act_id: "act_1", spend_cap: 0 }]);
    expect(limitCell(rows[0])).toMatchObject({ text: "not set", unset: true, suffix: null });
  });
});

describe("чего у источника нет — того он и не утверждает", () => {
  it("пиксели и лички приезжают только со снапшота", () => {
    const rows = unifiedAccounts(
      [снап({ id: "act_1", name: "Raaj Khan", pixels: [{ id: "px1", name: "hiu" }] })],
      [{ act_id: "act_1" }],
      { personal: { act_1: 1 } },
    );
    expect(rows[0].pixels).toHaveLength(1);
    expect(rows[0].personal).toBe(true);
  });

  it("свежесть строки — от базы, а без неё от самого свежего сбора соцев", () => {
    const owners = [соц({ profile: "k1a", collectedAt: "2026-08-11T22:05:00Z" }),
                    соц({ profile: "k1b", collectedAt: "2026-08-14T09:12:00Z" })];
    const только = unifiedAccounts([снап({ id: "act_1" }, owners)], []);
    expect(только[0].status_checked_at).toBe("2026-08-14T09:12:00Z");

    const обе = unifiedAccounts(
      [снап({ id: "act_1" }, owners)],
      [{ act_id: "act_1", status_checked_at: "2026-08-15T01:00:00Z" }],
    );
    expect(обе[0].status_checked_at).toBe("2026-08-15T01:00:00Z");
  });

  it("статус базы поверх статуса снапшота, но пустота базы ничего не стирает", () => {
    const rows = unifiedAccounts(
      [снап({ id: "act_1", status: "ACTIVE" }), снап({ id: "act_2", status: "ACTIVE" })],
      [{ act_id: "act_1", status: "DISABLED", disable_reason: "ad policy" },
       { act_id: "act_2" }],
    );
    expect(rows.map((r) => r.status)).toEqual(["DISABLED", "ACTIVE"]);
    expect(rows[0].disable_reason).toBe("ad policy");
  });
});

describe("Business Manager у двух источников зовётся по-разному", () => {
  it("имя из снапшота и id из базы дают ОДНУ группу, а не две", () => {
    /* У снапшота БМ приезжает одним полем — именем; у базы есть и id. Без карты
       «имя → id» один и тот же Business Manager разъезжался на две группы, и это
       читалось как два разных БМ с одинаковым названием. */
    const rows = unifiedAccounts(
      [снап({ id: "act_2", business: "Zenith Media Group" })],
      [{ act_id: "act_1", bm_id: "1178", bm_name: "Zenith Media Group", currency: "USD" }],
    );
    const groups = bmGroups(rows, "USD");
    expect(groups).toHaveLength(1);
    expect(groups[0].accounts.map((a) => a.act_id).sort()).toEqual(["act_1", "act_2"]);
  });
});

describe("сводка считается по сведённому списку", () => {
  it("«всего» — число кабинетов, а не число строк источников", () => {
    const rows = unifiedAccounts(
      [снап({ id: "act_1" }), снап({ id: "act_2" })],
      [{ act_id: "act_1" }, { act_id: "act_3" }] as CloudAccount[],
    );
    expect(rows).toHaveLength(3);
  });
});
