/* Пресеты старого HTML-билдера — теперь только тест-фикстуры.
 *
 * Из UI встроенные пресеты убраны, но парити-тесты продолжают гонять через них
 * buildSpec/buildText: это единственная страховка, что панель собирает спеку
 * байт-в-байт как web/zaliv_builder.html. Значения править нельзя — иначе
 * тесты начнут сверять новое с новым и сторожить перестанут.
 */

import type { Form } from "../types";

export const PRESETS: Record<string, Partial<Form>> = {
  "DZ лиды · spx (MeDuA6aeP)": {
    profile: "k1epd0wv", acctMode: "all_active", nCamp: 1, nAdset: 5, nAd: 1,
    objective: "OUTCOME_LEADS", convLoc: "WEBSITE", pixel: "auto", event: "LEAD",
    attribution: "1d_click_1d_view", budgetLevel: "campaign", daily: 70, geo: "DZ",
    ageMin: 25, ageMax: 55, device: "mobile", plats: ["facebook", "instagram"],
    positions: "feed, story, reels", page: "rotate", link: "https://yrigafo.com/l/XJTEH",
    activate: "everything", specialCat: "финансы",
    nmCamp: "[GEO]--[ACT]--[RAND5][RAND5]", nmAdset: "ads--[ACT_LAST4]--[RAND5]",
    nmAd: "ad--[ACT_LAST4]--[RAND5]", videoLines: "", creoCta: "SUBSCRIBE",
  },
  "DZ лиды · hiu (6/7 MB)": {
    profile: "k1ecjt33", acctMode: "all_active", nCamp: 1, nAdset: 5, nAd: 1,
    objective: "OUTCOME_LEADS", convLoc: "WEBSITE", pixel: "auto", event: "LEAD",
    attribution: "1d_click_1d_view", budgetLevel: "campaign", daily: 70, geo: "DZ",
    ageMin: 25, ageMax: 55, device: "mobile", plats: ["facebook", "instagram"],
    positions: "feed, story, reels", page: "rotate", link: "https://yrigafo.com/l/XJTEH",
    activate: "everything", specialCat: "финансы",
    nmCamp: "[GEO]--[ACT]--[RAND5][RAND5]", nmAdset: "ads--[ACT_LAST4]--[RAND5]",
    nmAd: "ad--[ACT_LAST4]--[RAND5]", videoLines: "", creoCta: "SUBSCRIBE",
  },
  "S2D · IG-визиты · rodion": {
    profile: "k1f15y8n", acctMode: "all_active", nCamp: 1, nAdset: 12, nAd: 1,
    objective: "OUTCOME_TRAFFIC", convLoc: "INSTAGRAM_PROFILE", pixel: "", event: "",
    budgetLevel: "adset", daily: 5, geo: "UA", ageMin: 23, ageMax: 35, gender: "female",
    device: "mobile", plats: ["instagram"], positions: "", page: "auto",
    link: "", activate: "campaigns", specialCat: "",
    nmCamp: "s2d-[ACT]-C[C]", nmAdset: "A[N]- [RAND5]", nmAd: "AD[N]-[RAND5]",
    creoSrc: "file", staticAsVideo: false, videoLines: "", creoCta: "SHOP_NOW",
  },
};
