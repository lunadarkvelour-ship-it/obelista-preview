import { describe, expect, it } from "vitest";
import {
  PLANS,
  TRIALS,
  planById,
  planPriceLine,
  planSocialsLine,
  trialById,
} from "@/lib/billing-plans";

/* Тарифы и триалы (#128). Цены здесь — ПРЕДЛОЖЕНИЕ владельцу, названное им
 * устно ночью 15.08, и они правятся одной строкой. Тест держит не сами
 * числа как истину (иначе правка цены станет правкой теста), а то, что
 * делает сетку честной:
 *
 *  — тарифов ровно три и они различаются потолком, а не только ценой;
 *  — то, что тариф обещает, но продукт ещё не умеет, ПОМЕЧЕНО, а не спрятано;
 *  — у каждого тарифа названо и чего в нём нет;
 *  — два триала недоступны сегодня по РАЗНЫМ причинам, и обе названы.
 */

describe("три тарифа, и различаются они не только ценой", () => {
  it("id уникальны, цены положительные и растут вместе с потолком", () => {
    expect(PLANS).toHaveLength(3);
    expect(new Set(PLANS.map((p) => p.id)).size).toBe(3);
    for (const p of PLANS) expect(p.priceUsdMonthly).toBeGreaterThan(0);
    const цены = PLANS.map((p) => p.priceUsdMonthly);
    expect([...цены].sort((a, b) => a - b)).toEqual(цены);
  });

  it("у каждого есть имя, фраза «кому это» и список того, что включено", () => {
    for (const p of PLANS) {
      expect(p.name.trim().length).toBeGreaterThan(0);
      expect(p.tagline.length).toBeGreaterThan(20);
      expect(p.features.length).toBeGreaterThan(0);
    }
  });

  it("потолок по соцам растёт: один — несколько — сколько нужно команде", () => {
    const [solo, pro, team] = PLANS;
    expect(solo.socials).toBe(1);
    expect(pro.socials).toBeGreaterThan(1);
    expect(team.socials).toBeNull();
    expect(planSocialsLine(solo)).toMatch(/one social profile/i);
    expect(planSocialsLine(pro)).toMatch(/up to/i);
    expect(planSocialsLine(team)).toMatch(/team/i);
  });

  it("автоправил в младшем тарифе нет, и это сказано, а не подразумевается", () => {
    const solo = planById("solo");
    expect(solo.missing.join(" ")).toMatch(/automation rules/i);
    expect(solo.features.some((f) => /automation rules/i.test(f.text))).toBe(false);
    expect(planById("pro").features.some((f) => /automation rules/i.test(f.text))).toBe(true);
  });

  it("у старшего тарифа команда и приглашения есть", () => {
    expect(planById("team").features.some((f) => /team|invite/i.test(f.text))).toBe(true);
  });

  it("неизвестный тариф — исключение, а не молчаливая подмена первым", () => {
    // Подменить тариф значит подменить цену: пусть падает здесь.
    expect(() => planById("gold" as never)).toThrow();
  });
});

describe("обещанное, но ненаписанное — помечено, а не спрятано", () => {
  it("трекеры, CRM и медиатека честно стоят как ещё не готовые", () => {
    const ненаписанное = PLANS.flatMap((p) => p.features.filter((f) => !f.built)).map((f) => f.text);
    expect(ненаписанное.length).toBeGreaterThan(0);
    const всё = ненаписанное.join(" ").toLowerCase();
    expect(всё).toMatch(/tracker/);
    expect(всё).toMatch(/crm/);
    expect(всё).toMatch(/library/);
  });

  it("то, что продукт умеет сегодня — залив, аналитика, облачный сбор — помечено готовым", () => {
    const готовое = PLANS.flatMap((p) => p.features.filter((f) => f.built)).map((f) => f.text.toLowerCase());
    expect(готовое.join(" ")).toMatch(/upload/);
    expect(готовое.join(" ")).toMatch(/analytics/);
    expect(готовое.join(" ")).toMatch(/cloud collection/);
  });
});

describe("цена — одно число и один формат", () => {
  it("строка цены собирается из числа тарифа, а не пишется руками", () => {
    for (const p of PLANS) expect(planPriceLine(p)).toContain(String(p.priceUsdMonthly));
    expect(planPriceLine(planById("solo"))).toMatch(/^\$\d+ \/ month$/);
  });

  it("формат один на все тарифы", () => {
    const формы = PLANS.map((p) => planPriceLine(p).replace(/\d+/g, "N"));
    expect(new Set(формы).size).toBe(1);
  });
});

describe("два триала, и недоступны они по разным причинам", () => {
  it("карточный длиннее и с привязкой, криптовый короче и без предоплаты", () => {
    const card = trialById("card");
    const crypto = trialById("crypto");
    expect(card.days).toBeGreaterThan(crypto.days);
    expect(card.requires).toMatch(/card/i);
    expect(crypto.requires).toMatch(/nothing up front|no prepayment/i);
  });

  it("оба сегодня недоступны, и причины РАЗНЫЕ: юрлицо против ключей мерчанта", () => {
    for (const t of TRIALS) expect(t.available).toBe(false);
    expect(trialById("card").why).toMatch(/legal entity/i);
    expect(trialById("crypto").why).toMatch(/merchant account|keys/i);
    expect(trialById("card").why).not.toBe(trialById("crypto").why);
  });

  it("криптовый триал не превращается в оплату сам — у крипты нет автосписания", () => {
    expect(trialById("crypto").ending).toMatch(/no auto-charge/i);
    // А карточный превращается, и это сказано прямо: разница между ними —
    // механика оплаты, а не щедрость.
    expect(trialById("card").ending).toMatch(/automatically/i);
  });

  it("неизвестный триал — исключение", () => {
    expect(() => trialById("free" as never)).toThrow();
  });
});
