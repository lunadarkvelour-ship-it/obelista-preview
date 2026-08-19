/* Промпт, который уезжает в Claude Desktop, обязан ГОВОРИТЬ правило, а не
 * подразумевать его.
 *
 * Спеку иногда собирает не панель, а модель — и тогда крео уезжают хешами, а
 * нейминг без [CREO_NAME]. Поля image_hash / video_id в схеме тула долго стояли
 * вообще без описания, в отличие от соседнего file с тремя строками: модель
 * видела принятое поле и складывала туда id из Ads Manager. 08.08 так ушло
 * 14 объявлений и $193, которых аналитика не смогла связать ни с одним крео.
 */
import { describe, expect, it } from "vitest";
import { buildTextBody } from "@/lib/build-spec";
import { bundleText } from "@/lib/groups";
import { DEFAULT_FORM, DEF_CATALOG, PROFILES, LICHKA } from "@/lib/seed";
import { resolveState } from "@/lib/form";
import type { BuildCtx } from "@/lib/types";

const ctx: BuildCtx = {
  tags: { spx: { prefix: "spx--" } }, profiles: PROFILES,
  catalogAll: DEF_CATALOG, lichka: LICHKA, snapshot: null,
};

const state = (over: Partial<typeof DEFAULT_FORM> = {}) =>
  resolveState({ ...DEFAULT_FORM, tag: "spx", videoLines: "dz5", geo: "BD",
                 daily: 10, link: "https://x.y", ...over }, [], []);

describe("текст связки", () => {
  it("печатает нейминг ТЕМ ЖЕ значением, что уедет в спеку", () => {
    /* Иначе текст обещает одно, а JSON несёт другое, и первым это заметит
       юзер в Мете. */
    const t = buildTextBody(state({ nmAd: "ad--[RAND5]" }), null, ctx);
    expect(t).toContain('объявления "spx--ad--[RAND5]--[CREO_NAME]"');
  });

  it("правило про имя крео сказано словами", () => {
    const t = buildTextBody(state(), null, ctx);
    expect(t).toContain("[CREO_NAME]");
    expect(t).toContain("не опознан");
  });

  it("говорит задавать крео именами, а не хешами", () => {
    const t = buildTextBody(state(), null, ctx);
    expect(t).toMatch(/не хешами и не id/);
  });
});

describe("протокол бандла", () => {
  const группа = () => ({
    id: "g1", name: "г",
    members: [{ profile: "k1epd0wv", act: "act_1" }],
    form: { ...DEFAULT_FORM, tag: "spx", videoLines: "dz5", geo: "BD",
            daily: "10", link: "https://x.y" },
  }) as never;

  it("нулевым шагом стоит проверка инварианта", () => {
    /* Она должна быть ДО plan_upload: после залива чинить нечего. */
    const t = bundleText([группа()], ctx);
    const шаг0 = t.indexOf("0. Проверь");
    const шаг1 = t.indexOf("1. plan_upload");
    expect(шаг0).toBeGreaterThan(-1);
    expect(шаг0).toBeLessThan(шаг1);
  });

  it("велит остановиться, а не чинить самому", () => {
    const t = bundleText([группа()], ctx);
    expect(t).toMatch(/ОСТАНОВИСЬ.*чинить надо в панели|чинить надо в панели/s);
  });
});
