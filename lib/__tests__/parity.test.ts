import { describe, it, expect } from "vitest";
import { DEFAULT_FORM, DEF_CATALOG, PROFILES, LICHKA } from "@/lib/seed";

/* Теги и привязки «профиль → тег» — фикстура теста, а не поставляемые дефолты.
   Панель теперь приезжает пустой: свои агентства юзер заводит сам. Механизм
   «тег берётся из привязки, если пресет его не задал» от этого никуда не
   делся, и проверять его надо — но на своих данных, а не на чьих-то. */
const DEF_TAGS = { spx: { prefix: "spx--" }, hiu: { prefix: "hiu--" } };
const DEF_BIND = { k1epd0wv: "spx", k1ecjt33: "hiu", k1etmpye: "hiu", k1f15y8n: "" };
import { PRESETS } from "./fixtures";
import { mergePreset, resolveState } from "@/lib/form";
import { buildAll } from "@/lib/build-spec";
import { specToState } from "@/lib/spec-to-state";
import type { BuildCtx } from "@/lib/types";

const ctx: BuildCtx = {
  tags: DEF_TAGS, profiles: PROFILES, catalogAll: DEF_CATALOG, lichka: LICHKA, snapshot: null,
};

function specForPreset(name: keyof typeof PRESETS) {
  const form = mergePreset(DEFAULT_FORM, PRESETS[name], DEF_BIND);
  const s = resolveState(form, [], []);
  return buildAll(s, ctx).specs[0];
}

describe("preset → spec parity", () => {
  it("tag is derived from bind when preset omits it", () => {
    const form = mergePreset(DEFAULT_FORM, PRESETS["DZ лиды · spx (MeDuA6aeP)"], DEF_BIND);
    expect(form.tag).toBe("spx");
  });

  it("DZ лиды · spx builds the exact expected spec", () => {
    expect(specForPreset("DZ лиды · spx (MeDuA6aeP)")).toEqual({
      profiles: ["k1epd0wv"],
      accounts: "all_active",
      structure: "1-5-1",
      objective: "OUTCOME_LEADS",
      conversion: { location: "WEBSITE", pixel: "auto", event: "LEAD" },
      attribution: "1d_click_1d_view",
      budget: { level: "campaign", daily_usd: 70 },
      targeting: { geo: ["DZ"], age: [25, 55], gender: "all", custom: { device_platforms: ["mobile"] } },
      /* Единственное место, где паритет со старым билдером сломан НАМЕРЕННО.
         Пресет просит «feed, story, reels» — старый билдер писал эту строку в
         обе платформы как есть, и такую спеку FB отвергает: у него лента `feed`
         только на Facebook (на Instagram — `stream`), а рилсы `reels` только на
         Instagram (на Facebook — `facebook_reels`). Стоило это двух заливов
         целиком: 28.07 — 16 кабов / 48 отказов, 29.07 — 10 кабов / 30 отказов,
         ноль созданных объектов. Паритет с поведением, которое гарантированно
         падает, ценности не имеет. */
      placements: {
        platforms: ["facebook", "instagram"],
        facebook_positions: ["feed", "story", "facebook_reels"],
        instagram_positions: ["stream", "story", "reels"],
      },
      page: "rotate",
      link: "https://yrigafo.com/l/XJTEH",
      creatives: [],
      naming: {
        campaign: "spx--[GEO]--[ACT]--[RAND5][RAND5]",
        adset: "spx--ads--[ACT_LAST4]--[RAND5]",
        // Хвост [CREO_NAME] дописывает buildSpec: без него аналитика не
        // связала бы объявление ни с одним крео (см. lib/naming-guard.ts).
        ad: "spx--ad--[ACT_LAST4]--[RAND5]--[CREO_NAME]",
      },
      activate: "everything",
      special_ad_categories: ["финансы"],
    });
  });

  it("S2D · IG-визиты · rodion builds an ABO IG-profile spec", () => {
    const spec = specForPreset("S2D · IG-визиты · rodion");
    expect(spec.budget).toEqual({ level: "adset", daily_usd: 5 });
    expect(spec.structure).toBe("1-12-1");
    expect(spec.objective).toBe("OUTCOME_TRAFFIC");
    expect(spec.conversion).toEqual({ location: "INSTAGRAM_PROFILE" });
    // фулл инста: только IG, позиции не задаём — FB отдаёт весь IG-инвентарь.
    // facebook_positions НЕ должен появляться на IG-онли заливе.
    expect(spec.placements).toEqual({ platforms: ["instagram"] });
    // статика идёт картинкой: конвертации в видео НЕТ
    expect(spec).not.toHaveProperty("static_as_video");
    expect(spec).not.toHaveProperty("special_ad_categories");
  });

  /* Версия ОС уходит в Мету passthrough — валидатор движка её не смотрит, и
     промах виден только отказом адсета. В живом заливе работала форма
     `iOS_ver_14.0_and_above`, поэтому целое число дополняем до дробного. */
  it("версия ОС приводится к виду, который принимает FB", () => {
    const base = mergePreset(DEFAULT_FORM, PRESETS["S2D · IG-визиты · rodion"], DEF_BIND);
    const spec = buildAll(resolveState({ ...base, userOs: "iOS", osVer: "14" }, ["act_1"], []), ctx).specs[0];
    expect(spec.targeting.custom.user_os).toEqual(["iOS_ver_14.0_and_above"]);
    const dotted = buildAll(resolveState({ ...base, userOs: "iOS", osVer: "16.4" }, ["act_1"], []), ctx).specs[0];
    expect(dotted.targeting.custom.user_os).toEqual(["iOS_ver_16.4_and_above"]);
  });

  it("user_os targeting: OS alone and OS with min version", () => {
    const base = mergePreset(DEFAULT_FORM, PRESETS["S2D · IG-визиты · rodion"], DEF_BIND);
    const noOs = buildAll(resolveState(base, ["act_1"], []), ctx).specs[0];
    expect(noOs.targeting.custom).toEqual({ device_platforms: ["mobile"] });

    const ios = { ...base, userOs: "iOS", osVer: "" };
    const s1 = buildAll(resolveState(ios, ["act_1"], []), ctx).specs[0];
    expect(s1.targeting.custom).toEqual({ device_platforms: ["mobile"], user_os: ["iOS"] });

    const iosVer = { ...base, userOs: "iOS", osVer: "14.0" };
    const s2 = buildAll(resolveState(iosVer, ["act_1"], []), ctx).specs[0];
    expect(s2.targeting.custom.user_os).toEqual(["iOS_ver_14.0_and_above"]);
  });

  it("creoSrc=file emits file: creatives, static_as_video only when asked", () => {
    const base = mergePreset(DEFAULT_FORM, PRESETS["S2D · IG-визиты · rodion"], DEF_BIND);
    const withCreo = { ...base, videoLines: "rod1.png\nrod2.png" };
    const spec = buildAll(resolveState(withCreo, ["act_1"], []), ctx).specs[0];
    expect(spec.creatives).toEqual([
      { file: "rod1.png", cta: "SHOP_NOW" },
      { file: "rod2.png", cta: "SHOP_NOW" },
    ]);
    expect(spec).not.toHaveProperty("static_as_video");

    const asVideo = { ...withCreo, staticAsVideo: true };
    const spec2 = buildAll(resolveState(asVideo, ["act_1"], []), ctx).specs[0];
    expect(spec2.static_as_video).toBe(true);
  });

  it("all presets round-trip through specToState → build unchanged", () => {
    /* Одно намеренное исключение из «без потерь»: имя объявления.
       Импорт ЛЕЧИТ шаблон без [CREO_NAME] в хвосте — иначе чужая спека вносит
       в панель нейминг, по которому аналитика потом не свяжет расход ни с
       одним крео (core/attrib.py:241-244 режет имя по `--` и берёт последний
       кусок). Фикстуры здесь сознательно оставлены со СТАРЫМ шаблоном, чтобы
       это лечение проверялось, а не обходилось. */
    (Object.keys(PRESETS) as (keyof typeof PRESETS)[]).forEach((name) => {
      const spec = specForPreset(name);
      const { form: imported, picked } = specToState(spec, DEF_TAGS);
      const form2 = { ...DEFAULT_FORM, ...imported };
      const s2 = resolveState(form2, picked || [], []);
      const spec2 = buildAll(s2, ctx).specs[0];

      const nm1 = (spec.naming || {}) as Record<string, string>;
      const nm2 = (spec2.naming || {}) as Record<string, string>;
      expect(nm2.ad, name).toMatch(/\[CREO_NAME\]$/);
      if (!/\[CREO_NAME\]$/.test(nm1.ad || "")) {
        // Вылечили: остальная часть шаблона обязана остаться прежней.
        expect(nm2.ad, name).toBe(nm1.ad + "--[CREO_NAME]");
      } else {
        expect(nm2.ad, name).toBe(nm1.ad);
      }
      expect({ ...spec2, naming: null }).toEqual({ ...spec, naming: null });
    });
  });

  it("key order matches the original builder for JSON identity", () => {
    const spec = specForPreset("DZ лиды · spx (MeDuA6aeP)");
    expect(Object.keys(spec)).toEqual([
      "profiles", "accounts", "structure", "objective", "conversion", "attribution",
      "budget", "targeting", "placements", "page", "link", "creatives", "naming",
      "activate", "special_ad_categories",
    ]);
  });
});
