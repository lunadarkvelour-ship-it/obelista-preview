import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  BILLING_STATES,
  GRACE_DAYS,
  INVOICE_STEPS,
  NOT_CONNECTED_CONTEXT,
  PROVIDER,
  REMINDER_DAYS_BEFORE,
  RESTRICTED_KEEPS,
  RESTRICTED_STOPS,
  addCalendarMonths,
  addDays,
  billingAccessLine,
  billingHasAccess,
  billingState,
  billingStateDescription,
  billingStateLabel,
  billingStateTone,
  daysBetween,
  daysOfAccessLeft,
  graceEnd,
  invoiceReady,
  isDay,
  paidThroughFrom,
  reminderDue,
  renewalNotice,
  type BillingContext,
  type BillingTone,
} from "@/lib/billing";

/* Модель биллинга (#128). Переписана вместе с самим листом: провайдер теперь
 * ВЫБРАН — крипта через Cryptomus, — а раньше его не было вовсе. Что этот
 * файл обязан держать правдой:
 *
 *  1. `not_connected` перебивает всё: провайдер назван, ключей мерчанта нет,
 *     инвойс создать нечем. Это факт о продукте, а не о конкретной подписке.
 *  2. У крипты НЕТ автосписания, и модель обязана быть построена вокруг
 *     этого: ни `past_due` (сорванного списания не бывает), ни `canceled`
 *     (автопродления, которое отменяют, тоже) в наборе состояний нет.
 *  3. Срок — КАЛЕНДАРНЫЙ месяц с зажимом конца месяца и без накопления сдвига
 *     при продлениях. Ошибка здесь — это подаренные или отобранные дни.
 *  4. По истечении доступ ОГРАНИЧИВАЕТСЯ, а не пропадает молча: сначала
 *     напоминания, потом грейс, и только потом ограничение — и человеку
 *     названо, что перестало работать, а что осталось.
 *  5. Красные линии: ни одного поля ввода реквизитов на листе, и ни одного
 *     числа про деньги вне `lib/billing-plans.ts` — цену владелец правит одной
 *     строкой в одном файле.
 */

const СЕГОДНЯ = "2026-08-15";

/** Провайдер подключён, но подписки нет — из этого контекста тесты меняют по
 *  одному полю (тот же приём, что `ЕСТЬ_СЕРВЕР` в соседних файлах). */
const ЕСТЬ_ОПЛАТА: BillingContext = {
  ...NOT_CONNECTED_CONTEXT,
  merchantConfigured: true,
  today: СЕГОДНЯ,
};

describe("not_connected — провайдер выбран, ключей нет, и это перебивает всё", () => {
  it("шумный контекст с тарифом, оплаченным сроком и висящим инвойсом всё равно даёт not_connected", () => {
    const шум: BillingContext = {
      merchantConfigured: false,
      plan: "pro",
      paidThrough: "2026-12-31",
      trialEndsAt: "2026-09-01",
      invoicePending: true,
      today: СЕГОДНЯ,
    };
    expect(billingState(шум)).toBe("not_connected");
  });

  it("сегодня это состояние любого посетителя, и оно не «подписки нет»", () => {
    expect(billingState(NOT_CONNECTED_CONTEXT)).toBe("not_connected");
    expect(billingState(NOT_CONNECTED_CONTEXT)).not.toBe("no_subscription");
  });

  it("провайдер назван по имени, а причина говорит про ключи, а не «скоро»", () => {
    expect(PROVIDER.name).toBe("Cryptomus");
    expect(PROVIDER.configured).toBe(false);
    expect(PROVIDER.why).toMatch(/keys/i);
    expect(PROVIDER.why.length).toBeGreaterThan(60);
  });

  it("инвойс сегодня не создаётся, и решение с объяснением приходят из одного места", () => {
    const inv = invoiceReady();
    expect(inv.ready).toBe(false);
    expect(inv.why).toBe(PROVIDER.why);
    expect(invoiceReady({ ...PROVIDER, configured: true }).ready).toBe(true);
  });

  it("ограничивать сегодня нечего — строка про доступ не говорит «доступа нет»", () => {
    expect(billingAccessLine("not_connected")).not.toMatch(/no access/i);
  });
});

describe("у крипты нет автосписания — состояний про карту в модели нет", () => {
  it("семь состояний, и ровно те", () => {
    expect(BILLING_STATES).toEqual([
      "not_connected", "no_subscription", "trial", "active", "awaiting_payment", "grace", "restricted",
    ]);
  });

  it("ни past_due, ни canceled: сорваться нечему и отменять нечего", () => {
    expect(BILLING_STATES).not.toContain("past_due");
    expect(BILLING_STATES).not.toContain("canceled");
  });

  it("тексты активного состояния и триала прямо говорят, что само ничего не спишется", () => {
    expect(billingStateDescription("active")).toMatch(/no auto-charge/i);
    expect(billingStateDescription("trial")).toMatch(/no auto-charge|cannot charge/i);
  });
});

describe("порядок проверок — оплата важнее триала, срок важнее ожидания сети", () => {
  it("оплаченный срок идёт — active, даже если триал ещё не кончился", () => {
    const ctx: BillingContext = { ...ЕСТЬ_ОПЛАТА, paidThrough: "2026-09-01", trialEndsAt: "2026-08-20" };
    // Заплативший досрочно — платящий клиент, и «твой триал кончается» ему врёт.
    expect(billingState(ctx)).toBe("active");
  });

  it("триала хватает, пока он не кончился", () => {
    expect(billingState({ ...ЕСТЬ_ОПЛАТА, trialEndsAt: "2026-08-20" })).toBe("trial");
  });

  it("последний день срока ещё оплачен, следующий — уже грейс", () => {
    expect(billingState({ ...ЕСТЬ_ОПЛАТА, paidThrough: СЕГОДНЯ })).toBe("active");
    expect(billingState({ ...ЕСТЬ_ОПЛАТА, paidThrough: "2026-08-14" })).toBe("grace");
  });

  it("грейс кончился — restricted, а не «пропало»", () => {
    const ctx: BillingContext = { ...ЕСТЬ_ОПЛАТА, paidThrough: addDays(СЕГОДНЯ, -GRACE_DAYS - 1) };
    expect(billingState(ctx)).toBe("restricted");
  });

  it("грейс важнее висящего инвойса: пока доступ жив, человеку важнее срок, а не сеть", () => {
    const ctx: BillingContext = { ...ЕСТЬ_ОПЛАТА, paidThrough: "2026-08-14", invoicePending: true };
    expect(billingState(ctx)).toBe("grace");
  });

  it("инвойс висит, а доступа уже нет — awaiting_payment вместо restricted", () => {
    const ctx: BillingContext = {
      ...ЕСТЬ_ОПЛАТА,
      paidThrough: addDays(СЕГОДНЯ, -GRACE_DAYS - 1),
      invoicePending: true,
    };
    expect(billingState(ctx)).toBe("awaiting_payment");
  });

  it("ожидание сети САМО доступа не даёт — иначе месяц стоил бы одного нажатия", () => {
    expect(billingHasAccess("awaiting_payment")).toBe(false);
  });

  it("подписки не было вовсе — no_subscription", () => {
    expect(billingState(ЕСТЬ_ОПЛАТА)).toBe("no_subscription");
  });

  it("кривая дата от сервера не роняет лист и не выдаёт доступ молча", () => {
    const ctx: BillingContext = { ...ЕСТЬ_ОПЛАТА, paidThrough: "31-12-2026" };
    expect(() => billingState(ctx)).not.toThrow();
    expect(billingState(ctx)).toBe("no_subscription");
    expect(billingHasAccess(billingState(ctx))).toBe(false);
  });

  it("без «сегодня» доступ тоже не выдаётся молча", () => {
    const ctx: BillingContext = { ...ЕСТЬ_ОПЛАТА, today: "", paidThrough: "2026-09-01" };
    expect(billingState(ctx)).toBe("restricted");
  });
});

describe("календарный месяц — зажим конца и отсутствие накопленного сдвига", () => {
  it("31 января плюс месяц — конец февраля, а не третье марта", () => {
    expect(addCalendarMonths("2026-01-31", 1)).toBe("2026-02-28");
    expect(addCalendarMonths("2024-01-31", 1)).toBe("2024-02-29");
  });

  it("обычная дата переносится день в день", () => {
    expect(addCalendarMonths("2026-08-15", 1)).toBe("2026-09-15");
    expect(addCalendarMonths("2026-12-15", 1)).toBe("2027-01-15");
  });

  it("сдвиг НЕ накапливается: второй месяц считается от якоря, а не от прошлого конца", () => {
    // Иначе 31 января → 28 февраля → 28 марта, и к декабрю человек, платящий
    // 31-го, оплачивает 28-е.
    expect(addCalendarMonths("2026-01-31", 2)).toBe("2026-03-31");
    expect(paidThroughFrom("2026-01-31", 13)).toBe("2027-02-28");
  });

  it("месяц — не тридцать суток: у февраля их меньше, у августа больше", () => {
    expect(daysBetween("2026-02-01", addCalendarMonths("2026-02-01", 1))).toBe(28);
    expect(daysBetween("2026-08-01", addCalendarMonths("2026-08-01", 1))).toBe(31);
  });

  it("даты разбираются как есть, без часового пояса браузера", () => {
    expect(isDay("2026-08-15")).toBe(true);
    expect(isDay("2026-02-30")).toBe(false);
    expect(isDay("15.08.2026")).toBe(false);
    expect(isDay(null)).toBe(false);
    expect(addDays("2026-12-31", 1)).toBe("2027-01-01");
    expect(daysBetween("2026-08-15", "2026-08-14")).toBe(-1);
  });
});

describe("напоминания и грейс — до отключения, а не после", () => {
  it("напоминаний три и все ДО конца срока", () => {
    expect([...REMINDER_DAYS_BEFORE].sort((a, b) => b - a)).toEqual([7, 3, 1]);
    for (const d of REMINDER_DAYS_BEFORE) expect(d).toBeGreaterThan(0);
  });

  it("напоминание срабатывает ровно на своих остатках, а не каждый день", () => {
    expect(reminderDue(7)).toBe(true);
    expect(reminderDue(3)).toBe(true);
    expect(reminderDue(1)).toBe(true);
    expect(reminderDue(5)).toBe(false);
    expect(reminderDue(0)).toBe(false);
  });

  it("текст напоминания приходит из модели и называет остаток и ручное продление", () => {
    const ctx: BillingContext = { ...ЕСТЬ_ОПЛАТА, paidThrough: addDays(СЕГОДНЯ, 3) };
    const t = renewalNotice(ctx)!;
    expect(t).toMatch(/^3 days/);
    expect(t).toMatch(/no auto-charge/i);
  });

  it("в обычный день ничего не напоминаем — шум убивает напоминание", () => {
    expect(renewalNotice({ ...ЕСТЬ_ОПЛАТА, paidThrough: addDays(СЕГОДНЯ, 5) })).toBeNull();
  });

  it("в грейсе текст есть всегда и говорит, сколько дней осталось до ограничения", () => {
    const ctx: BillingContext = { ...ЕСТЬ_ОПЛАТА, paidThrough: addDays(СЕГОДНЯ, -1) };
    expect(billingState(ctx)).toBe("grace");
    const t = renewalNotice(ctx)!;
    expect(t).toMatch(/grace|limited/i);
    expect(daysOfAccessLeft(ctx)).toBe(GRACE_DAYS - 1);
  });

  it("грейс отсчитывается от конца оплаченного срока", () => {
    expect(graceEnd("2026-08-31")).toBe(addDays("2026-08-31", GRACE_DAYS));
    expect(GRACE_DAYS).toBeGreaterThan(0);
  });

  it("остаток дней считается по тому же факту, что и состояние", () => {
    expect(daysOfAccessLeft({ ...ЕСТЬ_ОПЛАТА, paidThrough: addDays(СЕГОДНЯ, 10) })).toBe(10);
    expect(daysOfAccessLeft({ ...ЕСТЬ_ОПЛАТА, trialEndsAt: addDays(СЕГОДНЯ, 2) })).toBe(2);
    expect(daysOfAccessLeft(ЕСТЬ_ОПЛАТА)).toBeNull();
  });
});

describe("доступ ограничивается, а не пропадает молча", () => {
  it("restricted честно говорит, что доступ ограничен, а не удалён", () => {
    expect(billingAccessLine("restricted")).toMatch(/limited, not deleted/i);
    expect(billingStateDescription("restricted")).toMatch(/nothing is deleted/i);
  });

  it("названо и что остаётся, и что перестаёт работать", () => {
    expect(RESTRICTED_KEEPS.length).toBeGreaterThan(0);
    expect(RESTRICTED_STOPS.length).toBeGreaterThan(0);
    // Уйти с данными нельзя запретить за неоплату — это не рычаг.
    expect(RESTRICTED_KEEPS.join(" ")).toMatch(/export/i);
    expect(RESTRICTED_STOPS.join(" ")).toMatch(/collection/i);
  });

  it("грейс сохраняет доступ, ограничение — нет", () => {
    expect(billingHasAccess("grace")).toBe(true);
    expect(billingHasAccess("restricted")).toBe(false);
  });
});

describe("семь состояний — подписи, объяснения, тон, доступ", () => {
  it("у каждого своя короткая подпись", () => {
    const подписи = BILLING_STATES.map(billingStateLabel);
    expect(new Set(подписи).size).toBe(BILLING_STATES.length);
    for (const l of подписи) expect(l.length).toBeGreaterThan(0);
  });

  it("у каждого своё объяснение, и оно говорит, что делать", () => {
    const тексты = BILLING_STATES.map(billingStateDescription);
    expect(new Set(тексты).size).toBe(BILLING_STATES.length);
    for (const t of тексты) expect(t.length).toBeGreaterThan(40);
  });

  it("предупреждение — только у тех, где что-то требуется или уже ограничено; ошибки нет нигде", () => {
    expect(billingStateTone("not_connected")).toBe("warning");
    expect(billingStateTone("grace")).toBe("warning");
    expect(billingStateTone("restricted")).toBe("warning");
    expect(billingStateTone("active")).toBe("normal");
    expect(billingStateTone("trial")).toBe("normal");
    expect(billingStateTone("no_subscription")).toBe("normal");
    expect(billingStateTone("awaiting_payment")).toBe("normal");
    for (const s of BILLING_STATES) expect(billingStateTone(s)).not.toBe("error" as never);
  });

  it("на уровне типа: BillingTone не расширить вариантом error без правки этого файла", () => {
    // @ts-expect-error — ни одно состояние не поломка, варианта "error" нет
    const запрещённый: BillingTone = "error";
    expect(String(запрещённый)).toBe("error");
  });

  it("доступ определён у всех семи", () => {
    expect(BILLING_STATES.map(billingHasAccess)).toEqual([
      false, false, true, true, false, true, false,
    ]);
  });

  it("строка про доступ совпадает с фактом везде, кроме трёх особых состояний", () => {
    for (const s of BILLING_STATES) {
      if (s === "not_connected" || s === "grace" || s === "restricted") continue;
      expect(billingAccessLine(s)).toBe(billingHasAccess(s) ? "Access continues." : "No access.");
    }
  });
});

describe("шаги оплаты — экран ожидания показывает их до того, как появятся ключи", () => {
  it("четыре шага, id уникальны, у каждого объяснение", () => {
    expect(INVOICE_STEPS.length).toBeGreaterThanOrEqual(3);
    expect(new Set(INVOICE_STEPS.map((s) => s.id)).size).toBe(INVOICE_STEPS.length);
    for (const s of INVOICE_STEPS) {
      expect(s.title.length).toBeGreaterThan(0);
      expect(s.description.length).toBeGreaterThan(30);
    }
  });

  it("шаги честны про то, что подтверждение сети не мгновенно и продления не будет", () => {
    const всё = INVOICE_STEPS.map((s) => s.description).join(" ");
    expect(всё).toMatch(/minutes, not seconds/i);
    expect(всё).toMatch(/no auto-renewal/i);
  });
});

/* --- Красные линии ------------------------------------------------------- */

const libSource = readFileSync(join(process.cwd(), "lib", "billing.ts"), "utf-8");
const plansSource = readFileSync(join(process.cwd(), "lib", "billing-plans.ts"), "utf-8");
const viewSource = readFileSync(
  join(process.cwd(), "components", "views", "BillingView.tsx"),
  "utf-8",
);

/** Слова, которыми называют поле ввода реквизитов, чем бы его ни завели. */
const CARD_FIELD_WORDS = /card ?number|\bcvc\b|\bcvv\b|cardholder|\bmm\s*\/\s*yy\b|expir(y|ation)\s*date|seed ?phrase|private ?key/i;

describe("на листе нет ни одного поля под реквизиты — ни карты, ни кошелька", () => {
  it("BillingView.tsx не поднимает ни <input>, ни <Input>", () => {
    expect(viewSource).not.toMatch(/<input\b/i);
    expect(viewSource).not.toMatch(/<Input\b/);
  });

  it("ни в листе, ни в модели нет слов, которыми называют реквизиты", () => {
    expect(viewSource).not.toMatch(CARD_FIELD_WORDS);
    expect(libSource).not.toMatch(CARD_FIELD_WORDS);
  });

  it("контекст биллинга не несёт полей, похожих на реквизит", () => {
    const плохие = ["card", "cvc", "cvv", "pan", "seed", "privkey"];
    expect(
      Object.keys(NOT_CONNECTED_CONTEXT).some((k) => плохие.some((s) => k.toLowerCase().includes(s))),
    ).toBe(false);
  });
});

/** Цена — знак валюты рядом с цифрой или число рядом со словом-периодом. */
const PRICE_LIKE = /\$\s?\d|\d\s?(usd|eur|\/\s?mo\b|\/\s?month\b|\/\s?year\b)|per\s+month|per\s+year/i;

describe("цена живёт ровно в одном файле — владелец правит одну строку", () => {
  it("в модели состояний цены нет", () => {
    expect(libSource).not.toMatch(PRICE_LIKE);
  });

  it("в вёрстке листа цены нет — она приезжает из billing-plans", () => {
    expect(viewSource).not.toMatch(PRICE_LIKE);
  });

  it("а в billing-plans она есть, и это единственное место", () => {
    expect(plansSource).toMatch(PRICE_LIKE);
  });
});

/** Исходник без комментариев. Нужен ровно одному тесту ниже: он ищет ЗАПРЕТ
 *  в коде, а комментарий, объясняющий этот же запрет словами, — не нарушение
 *  запрета, а его документация. Без вычистки тест заставлял бы не называть
 *  вещь своим именем в комментарии, то есть писать хуже. */
function безКомментариев(src: string): string {
  return src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:])\/\/.*$/gm, "$1");
}

describe("модель не спрашивает время сама", () => {
  it("в lib/billing.ts нет Date.now() и new Date() без аргументов — «сегодня» приходит снаружи", () => {
    // Иначе модель нельзя проверить тестом, не подделав часы, и первый же
    // тест про грейс начнёт зависеть от дня, в который его запустили.
    const код = безКомментариев(libSource);
    expect(код).not.toMatch(/Date\.now\(\)/);
    expect(код).not.toMatch(/new Date\(\s*\)/);
  });
});
