/* Слепок бандла для контрактного теста движка.
 *
 *  Тест не проверяет — он ЗАПИСЫВАЕТ то, что панель реально отдаёт, в
 *  `tests/fixtures/panel_bundle.json`. Проверяет питоновский
 *  `tests/test_panel_bundle_contract.py`: он гоняет каждую спеку через
 *  `core.matrix.validate` — тот самый валидатор, через который спека проходит в
 *  `plan_upload`. Разрыв контракта между панелью и движком ловится тестами, а
 *  не заливом на живых кабах.
 *
 *  Почему слепок, а не общий код: панель на TypeScript, движок на Python, и
 *  единственный честный способ проверить их согласие — прогнать НАСТОЯЩИЙ
 *  артефакт панели через НАСТОЯЩИЙ валидатор движка.
 */
import { describe, expect, it } from "vitest";
import { writeFileSync, mkdirSync } from "node:fs";
import path from "node:path";
import {
  blankForm, buildBundle, bundleJson, bundleText, groupReady, missingOf, newGroup, TAG_BY_SOC,
} from "@/lib/groups";
import { snapshotStamp } from "@/lib/build-spec";
import type { BuildCtx, CabGroup, Form } from "@/lib/types";

const ctx: BuildCtx = {
  tags: { hiu: { prefix: "hiu--" }, spx: { prefix: "spx--" } },
  bind: {},
  profiles: [
    { id: "k1f9qbcs", label: "1/8 MediaBuyer3 hiuhiu", team: "keine" },
    { id: "k1ffja5h", label: "MeDuA6aeP 6/8 spx", team: "rodion" },
  ],
  catalogAll: {
    k1f9qbcs: [{ id: "act_2060387021243613", name: "Hiuhiu_Mediabuyer3_2.8_6" }],
    k1ffja5h: [{ id: "act_1364793938527800", name: "MeDuA6aeP 7/8- 10" }],
  },
  lichka: {},
  snapshot: { generated_at: "2026-08-07T17:40:00+02:00", profiles: {} },
};

function g(name: string, form: Partial<Form>, members: CabGroup["members"]): CabGroup {
  const base = newGroup(name, name, members);
  return { ...base, form: { ...blankForm(), ...form } };
}

/* Связки подобраны так, чтобы закрыть ветки валидатора, на которых он ругается:
   цель под пиксель и под лид-форму, ручные плейсменты и Advantage+, ABO и CBO,
   крео с кабинета и файлом, спец-категория, расписание, кап ставки. Если панель
   умеет собрать спеку, которую движок не примет, — она соберётся здесь. */
const GROUPS: CabGroup[] = [
  g(
    "сайт · пиксель · ручные плейсменты",
    {
      objective: "OUTCOME_LEADS", convLoc: "WEBSITE", event: "LEAD",
      attribution: "7d_click_1d_view",
      nCamp: 1, nAdset: 3, nAd: 2,
      budgetLevel: "adset", daily: 45,
      geo: "EG, DZ", ageMin: 21, ageMax: 55, gender: "male",
      device: "mobile", userOs: "android", osVer: "10",
      plcMode: "manual", plats: ["facebook", "instagram"],
      positions: "feed, story",
      page: "rotate", link: "https://bangleishin.com/l/QRdmv",
      creoSrc: "cab", videoLines: "dzilliastazhor1\ndzspy11\ndz7lip",
      creoCta: "SUBSCRIBE", creoPt: "текст объявления", creoHl: "заголовок",
      creoUrl: "utm_source=fb&sub1={{ad.id}}",
      tag: TAG_BY_SOC,
      activate: "campaigns+adsets",
      startTime: "2026-08-08T09:00", startLocal: true,
      /* Дословно из живой связки от 09.08 — до того как поле завели, эти
         строки лежали в `creatives[].file` рядом с `dz5` и `dz2`. Здесь они
         затем, чтобы питоновский контракт проверил ГЛАВНОЕ: движок такую
         спеку принимает и прозу как имя файла не читает. */
      notes: "Там 4 крео в папке from ffmpeg script\nпо 1 кампании на каб ставим",
    },
    [
      { profile: "k1f9qbcs", act: "act_2060387021243613", pixel: "1500774608234012" },
      // Каб другого агентства в той же группе: свой пиксель, лендинг и хвост.
      { profile: "k1f9qbcs", act: "act_1822792542023003", pixel: "1575609560601059",
        link: "https://other-agency.com/l/ZZ", tail: "utm_source=agB&sub1={{ad.id}}" },
      { profile: "k1ffja5h", act: "act_1364793938527800" },
    ]
  ),
  g(
    "лид-форма · Advantage+ · CBO с капом",
    {
      objective: "OUTCOME_LEADS", convLoc: "INSTANT_FORM", formId: "1234567890",
      nCamp: 2, nAdset: 1, nAd: 1,
      budgetLevel: "campaign", daily: 100,
      bidStrategy: "COST_CAP", cap: 7,
      geo: "BD", advAud: true,
      plcMode: "auto",
      page: "auto",
      creoSrc: "file", videoLines: "bangla18.mp4\nbangla23.mp4", staticAsVideo: true,
      creoCta: "SIGN_UP",
      tag: "spx",
      activate: "nothing",
    },
    [{ profile: "k1ffja5h", act: "act_1364793938527800" }]
  ),
  g(
    "спец-категория · один каб",
    {
      objective: "OUTCOME_SALES", convLoc: "WEBSITE", event: "PURCHASE",
      geo: "UA", daily: 20, ageMin: 25, ageMax: 45, gender: "female",
      page: "auto", link: "https://shop.example/offer",
      creoSrc: "cab", videoLines: "ua_static_1",
      creoCta: "SHOP_NOW",
      specialCat: "FINANCIAL_PRODUCTS_SERVICES",
      activate: "everything",
    },
    [{ profile: "k1f9qbcs", act: "act_2060387021243613" }]
  ),
  /* Заведомо недособранная группа. Нужна не для красоты: панель обязана назвать
     «не готово» РОВНО то, на чём споткнётся валидатор движка. Если она молчит,
     а валидатор ругается — оператор узнаёт о дырке из отказа plan_upload. */
  g(
    "недособранная — панель обязана предупредить",
    { geo: "", daily: 0, link: "", videoLines: "" },
    [{ profile: "k1f9qbcs", act: "act_2060387021243613" }]
  ),
];

describe("слепок бандла для контракта с движком", () => {
  it("пишет то, что панель реально отдаёт", () => {
    const items = buildBundle(GROUPS, ctx);
    expect(items.length).toBeGreaterThan(0);

    const out = {
      note: "СГЕНЕРИРОВАНО panel/lib/__tests__/bundle-fixture.test.ts — руками не править",
      json: bundleJson(items, snapshotStamp(ctx)),
      prompt: bundleText(GROUPS, ctx),
      // Вердикт панели по каждой группе — с ним питоновский тест сверяет, что
      // «готово» у панели означает «валидатор молчит», и наоборот.
      readiness: GROUPS.map((x) => ({
        group: x.name, ready: groupReady(x, null), missing: missingOf(x, null),
      })),
    };
    const dir = path.resolve(__dirname, "../../../tests/fixtures");
    mkdirSync(dir, { recursive: true });
    writeFileSync(path.join(dir, "panel_bundle.json"), JSON.stringify(out, null, 2) + "\n");
  });
});
