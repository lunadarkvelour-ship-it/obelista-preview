/* Витрина `obelista.com` (#134).
 *
 * Приоритет качества у самой страницы владелец назвал НИЗКИМ — «около
 * заглушечно», — и тест это уважает: он не проверяет ни вида, ни красоты, ни
 * порядка разделов. Он держит ровно три вещи, ошибка в каждой из которых стоит
 * денег или репутации, а не вкуса:
 *
 *   1. ЦЕНА В ОДНОМ МЕСТЕ. Витрина и лист биллинга обязаны брать число из
 *      `@/lib/billing-plans`. Написанное руками «$19» на витрине разъедется с
 *      биллингом в первый же день, когда владелец поправит одно из двух, — и
 *      обнаружит это клиент, которому выставили не то, что обещали.
 *   2. ПОЗИЦИЯ ПРО ВОРОНКУ СКАЗАНА ОТКРЫТО. Владелец потребовал говорить её
 *      прямо, а не прятать мелким шрифтом. Такое требование выветривается
 *      первым при следующей переписке текстов — сторож не даст.
 *   3. ДВЕРЬ ЕСТЬ. Вход и регистрация ведут в панель: страница, с которой
 *      некуда нажать, продаёт ноль независимо от текста.
 */
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import Landing from "@/app/landing/page";
import { PLANS, TRIALS, planPriceLine } from "@/lib/billing-plans";

const html = renderToStaticMarkup(createElement(Landing));

describe("витрина рисуется и говорит то, ради чего заведена", () => {
  it("все три тарифа с ценами, и цена приезжает из модели", () => {
    for (const p of PLANS) {
      expect(html).toContain(p.name);
      expect(html).toContain(planPriceLine(p));
    }
  });

  it("оба триала названы со своими сроками и условиями входа", () => {
    for (const t of TRIALS) {
      expect(html).toContain(t.title);
      expect(html).toContain(`${t.days} days`);
      expect(html).toContain(t.requires);
    }
  });

  it("триал, который сегодня начать нельзя, не обещан доступным", () => {
    /* Оба `available: false` — оплата не подключена. Условия показываем,
       возможность начать — нет: страница, зовущая нажать то, чего нет, теряет
       человека ровно в тот момент, когда он согласился. */
    if (TRIALS.some((t) => !t.available)) {
      expect(html).toMatch(/not open yet/i);
    }
  });

  it("пункт тарифа, за которым ещё нет кода, подписан прямо на витрине", () => {
    if (PLANS.some((p) => p.features.some((f) => !f.built))) {
      expect(html).toMatch(/not built yet/i);
    }
  });

  it("позиция про воронку сказана открытым текстом", () => {
    expect(html).toContain("Connect your funnel data");
    expect(html).toMatch(/do not recommend using this/i);
    // И довод, а не голое требование: почему без неё нельзя.
    expect(html).toMatch(/half (the|a) picture/i);
  });

  it("сказано, чем это лучше рук в Ads Manager", () => {
    expect(html).toContain("Ads Manager");
    expect(html).toMatch(/by hand/i);
  });

  it("вход и регистрация ведут в панель", () => {
    expect(html).toContain("Log in");
    expect(html).toContain("Sign up");
    expect(html).toContain("app.obelista.com/login");
  });

  it("юрссылки достижимы — без них не подать ни верификацию, ни App Review", () => {
    for (const href of ["/privacy", "/terms", "/data-request"]) {
      expect(html).toContain(`href="${href}"`);
    }
  });
});

describe("второго источника цены на витрине нет", () => {
  /* Смотрим на КОД без комментариев: в шапке `Pricing.tsx` цены названы
     числами намеренно — там объяснено, что они предложение владельца, а не его
     решение, и запретить их в комментарии значило бы запретить это объяснить. */
  const код = (f: string) =>
    readFileSync(f, "utf-8")
      .replace(/\/\*[\s\S]*?\*\//g, "")
      .replace(/^\s*\/\/.*$/gm, "");
  const файлы = ["app/landing/page.tsx", "components/landing/Pricing.tsx"];

  it("ни одна цена не написана в вёрстке руками", () => {
    /* Отрицательный контроль: как только кто-то впишет «$39» прямо в разметку,
       тест покраснеет — а не тогда, когда владелец поменяет цену и заметит
       расхождение через месяц по счёту клиента. */
    for (const f of файлы) {
      for (const p of PLANS) {
        expect(код(f)).not.toContain(`$${p.priceUsdMonthly}`);
      }
    }
  });

  it("длины триалов тоже не продублированы", () => {
    for (const f of файлы) {
      for (const t of TRIALS) {
        expect(код(f)).not.toContain(`${t.days} days`);
      }
    }
  });
});
