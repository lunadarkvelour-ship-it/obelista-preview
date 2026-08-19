// Reference data ported 1:1 from web/zaliv_builder.html (embedded defaults).
// User edits live in the Zustand persisted store and override these.

import type { Account, Form, Profile, Snapshot, TagDef } from "./types";

/** Пусто НАМЕРЕННО. Профили приходят из живого антидетекта через демон.
 *  Раньше тут лежали четыре зашитых id, и панель годами предлагала заливать с
 *  профилей, которых в антике давно нет. Зашитый id не переживает и смены
 *  вендора антидетекта: у того же человека там другой формат идентификатора. */
export const PROFILES: Profile[] = [];

/** Пусто НАМЕРЕННО: личка выводится из данных, см. lib/lichka.ts.
 *  Зашитый список рос молча — новый соц приносил новую личку, о которой панель
 *  не знала, и байер узнавал о ней по бану. */
export const LICHKA: Record<string, number> = {};

/** Пусто НАМЕРЕННО: теги агентств у каждого свои, добавляются в разделе
 *  «теги агентств» и живут в сторе. */
export const DEF_TAGS: Record<string, TagDef> = {};

/** Пусто НАМЕРЕННО: привязка «профиль → тег» задаётся юзером. */
export const DEF_BIND: Record<string, string> = {};

/** Пусто НАМЕРЕННО. Каталог кабинетов приезжает со снапшотом: через
 *  приложение по подключённым соцам, либо со старого моста. Зашитый каталог
 *  устаревал молча и уносил с собой чужие act_id. */
export const DEF_CATALOG: Record<string, Account[]> = {};

/** Default form values — matches old applyFullState() fallbacks. */
export const DEFAULT_FORM: Form = {
  profile: "",
  tag: "",
  acctMode: "all_active",
  nCamp: 1,
  nAdset: 1,
  nAd: 1,
  objective: "OUTCOME_LEADS",
  convLoc: "WEBSITE",
  pixel: "auto",
  event: "",
  formId: "",
  attribution: "",
  budgetLevel: "adset",
  daily: 0,
  bidStrategy: "LOWEST_COST_WITHOUT_CAP",
  cap: "",
  geo: "",
  ageMin: 18,
  ageMax: 65,
  gender: "all",
  device: "all",
  advAud: false,
  plcMode: "manual",
  plats: ["facebook", "instagram"],
  positions: "",
  page: "auto",
  link: "",
  videoLines: "",
  userOs: "all",
  osVer: "",
  creoSrc: "cab",
  staticAsVideo: false,
  creoCta: "SUBSCRIBE",
  creoPt: "",
  creoHl: "",
  creoUrl: "",
  nmCamp: "[GEO]--[ACT]--[RAND5][RAND5]",
  nmAdset: "ads--[ACT_LAST4]--[RAND5]",
  /* [CREO_NAME] в ХВОСТЕ имени объявления — не украшение, а единственное, по
     чему аналитика потом узнаёт крео. Атрибуция режет имя по `--` и берёт
     последний кусок (core/attrib.py:241-244): если там случайные пять
     символов, объявление не привязывается ни к чему и его расход навсегда
     оседает в «не опознан».

     Стоял ровно такой шаблон — `ad--[ACT_LAST4]--[RAND5]`, — и 08.08 он стоил
     четырнадцати объявлений и $193, которые лист аналитики не смог никому
     приписать. RAND5 остаётся перед именем: он нужен, чтобы имена не
     повторялись между кабами, но резать по нему уже нечего. */
  nmAd: "ad--[ACT_LAST4]--[RAND5]--[CREO_NAME]",
  activate: "nothing",
  startTime: "",
  startLocal: true,
  specialCat: "",
  notes: "",
};

/** Состояние, с которым панель открывается в чистом браузере.
 *
 * Пусто НАМЕРЕННО. Раньше тут лежал личный пресет одного человека: его гео,
 * его ссылка, его спец-категория и профиль, которого уже нет. Панель
 * открывается с нейтральной формой, а свои связки юзер сохраняет пресетами
 * через ⌘K. */
export const START_FORM: Partial<Form> = {};

/** Профили — только из снапшота. Зашитого списка больше нет: единственный
 *  честный источник это живой антик, а он приезжает снапшотом. */
export function mergeProfiles(snapshot: Snapshot | null): Profile[] {
  const snapProfiles = (snapshot?.profiles || {}) as Record<string, { label?: string; team?: string }>;
  return Object.keys(snapProfiles).map((id) => ({
    id,
    label: snapProfiles[id].label || id,
    team: snapProfiles[id].team || "",
  }));
}

