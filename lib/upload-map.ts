/* Описание секций для листа «Аплоад»: сводка строкой для карты и список полей
 * для операций над целой секцией.
 *
 *  Сводка нужна ровно затем, чтобы карта показывала СОДЕРЖИМОЕ, а не «настроено
 *  / не настроено»: разницу между группами глазом ловят по значениям. Поля
 *  перечислены явно, потому что «выровнять по большинству» обязано переносить
 *  секцию целиком — перенести половину полей хуже, чем не переносить ничего.
 */

import { GOAL } from "./constants";
import { TAG_BY_SOC } from "./groups";
import type { Form } from "./types";

export interface SectionDef {
  id: string;
  /** Номер секции в конструкторе — он же порядок шагов. */
  idx: string;
  label: string;
  /** Одна строка о том, зачем секция. Показывается над полями в редакторе. */
  why: string;
  keys: (keyof Form)[];
  summary: (f: Form) => { v: string; n?: string };
}

const list = (s: string) => s.split(",").map((x) => x.trim()).filter(Boolean);
const lines = (s: string) => s.split("\n").map((x) => x.trim()).filter(Boolean);

const ACT: Record<string, string> = {
  nothing: "everything paused",
  campaigns: "campaigns only",
  "campaigns+adsets": "campaigns and ad sets",
  everything: "everything on",
};
const ACT_NOTE: Record<string, string> = {
  nothing: "no spend",
  campaigns: "no spend",
  "campaigns+adsets": "ads paused",
  everything: "spend starts now",
};
const GENDER: Record<string, string> = { all: "any gender", male: "male", female: "female" };
const DEVICE: Record<string, string> = { all: "all devices", mobile: "mobile only", desktop: "desktop only" };

export const SECTIONS: SectionDef[] = [
  {
    id: "goal",
    idx: "01",
    label: "Objective",
    why: "What Meta optimizes for and where it counts the conversion. The pixel lives on the Ad accounts step — every account has its own.",
    // Пикселя здесь нет намеренно: он принадлежит кабинету, а не связке, и
    // живёт в CABS_STEP. Останься он в keys — «выровнять по большинству»
    // переписывало бы группам мёртвое поле формы, которое никто не показывает.
    keys: ["objective", "convLoc", "event", "formId", "attribution"],
    summary: (f) => ({
      v: GOAL[f.objective + "|" + f.convLoc] || "not supported",
      n: f.event,
    }),
  },
  {
    id: "structure",
    idx: "02",
    label: "Structure",
    why: "How many objects the engine creates on each ad account in the group.",
    keys: ["nCamp", "nAdset", "nAd"],
    summary: (f) => {
      const nCamp = Number(f.nCamp) || 1;
      const nAdset = Number(f.nAdset) || 1;
      const nAd = Number(f.nAd) || 1;
      return {
        v: `${nCamp} × ${nAdset} × ${nAd}`,
        n: `${nCamp * (1 + nAdset + nAdset * nAd)} objects per account`,
      };
    },
  },
  {
    id: "budget",
    idx: "03",
    label: "Budget",
    why: "Budget level and bid strategy.",
    keys: ["budgetLevel", "daily", "bidStrategy", "cap"],
    summary: (f) => ({
      v: `$${Number(f.daily) || 0}`,
      n: `${f.budgetLevel === "adset" ? "ad set · ABO" : "campaign · CBO"}`,
    }),
  },
  {
    id: "targeting",
    idx: "04",
    label: "Targeting",
    why: "Who sees the ads. A special category on Launch overrides age to 18-65.",
    keys: ["geo", "ageMin", "ageMax", "gender", "device", "userOs", "osVer", "advAud"],
    summary: (f) => ({
      v: `${list(f.geo).join("/") || "no geo"} · ${f.ageMin}-${f.ageMax}`,
      n: [GENDER[f.gender], DEVICE[f.device], f.advAud ? "Advantage+" : ""].filter(Boolean).join(" · "),
    }),
  },
  {
    id: "placements",
    idx: "05",
    label: "Placements",
    why: "Where ads run. Positions are written only for the selected platforms.",
    keys: ["plcMode", "plats", "positions"],
    summary: (f) =>
      f.plcMode === "auto"
        ? { v: "Advantage+ (auto)" }
        : { v: f.plats.join(" + ") || "no platforms selected", n: list(f.positions).join(" / ") },
  },
  {
    id: "page",
    idx: "06",
    label: "Page and offer",
    why: "Which page the ads run from and where the ad leads.",
    keys: ["page", "link"],
    summary: (f) => ({ v: f.page || "auto", n: f.link }),
  },
  {
    id: "creatives",
    idx: "07",
    label: "Creatives",
    why: "Files rotate across ad sets. URL params are appended to every creative in the group.",
    keys: ["creoSrc", "videoLines", "creoCta", "creoPt", "creoHl", "creoUrl", "staticAsVideo"],
    summary: (f) => {
      const n = lines(f.videoLines).length;
      return {
        v: n ? `${n} ${n === 1 ? "file" : "files"}` : "none selected",
        n: [f.creoCta, f.creoUrl ? `URL params ${tailMacros(f.creoUrl)}` : "no URL params"].filter(Boolean).join(" · "),
      };
    },
  },
  {
    id: "naming",
    idx: "08",
    label: "Naming",
    why: "Agency tag and macros. The engine substitutes the macros: [GEO], [ACT], [RAND5], [CREO_NAME].",
    keys: ["tag", "nmCamp", "nmAdset", "nmAd"],
    summary: (f) => ({
      v: f.nmCamp || "not set",
      n: f.tag === TAG_BY_SOC ? "tag per profile" : f.tag ? `tag ${f.tag}` : "",
    }),
  },
  {
    id: "launch",
    idx: "09",
    label: "Launch",
    why: "Everything is created paused. Here you decide what to turn on after verification.",
    keys: ["activate", "startTime", "startLocal", "specialCat"],
    summary: (f) => ({
      v: ACT[f.activate] || f.activate,
      /* Само значение specialCat не переводим: оно уезжает в спеку как
         special_ad_categories (build-spec.ts:141). */
      n: [ACT_NOTE[f.activate], f.specialCat ? `special category ${f.specialCat}` : ""]
        .filter(Boolean)
        .join(" · "),
    }),
  },
  {
    id: "notes",
    idx: "10",
    label: "Notes",
    why: "What to tell the model in your own words. Travels as a separate spec key; the engine does not execute it.",
    keys: ["notes"],
    /* В сводке — первая строка, а не «есть / нет»: карта показывает СОДЕРЖИМОЕ,
       и разницу между группами ловят глазом по значению. Остальные строки
       считаем отдельно — иначе длинная записка порвала бы строку карты. */
    summary: (f) => {
      const ls = lines(f.notes || "");
      const rest = ls.length - 1;
      return {
        v: ls[0] || "none",
        n: ls.length > 1 ? `+${rest} ${rest === 1 ? "line" : "lines"}` : "",
      };
    },
  },
];

function tailMacros(tail: string): string {
  const n = (tail.match(/\{\{/g) || []).length;
  return n ? `+${n} ${n === 1 ? "macro" : "macros"}` : "no macros";
}

/** Ключ секции для сравнения групп между собой. */
export function sectionKey(sec: SectionDef, f: Form): string {
  return JSON.stringify(sec.keys.map((k) => f[k]));
}

/** Значения секции, которые встречаются у большинства групп.
 *  null — если групп меньше двух или единого большинства нет. */
export function majoritySection(sec: SectionDef, forms: Form[]): Partial<Form> | null {
  if (forms.length < 2) return null;
  const count = new Map<string, number>();
  for (const f of forms) {
    const k = sectionKey(sec, f);
    count.set(k, (count.get(k) || 0) + 1);
  }
  let best = "";
  let bestN = 0;
  let tie = false;
  for (const [k, n] of count) {
    if (n > bestN) {
      best = k;
      bestN = n;
      tie = false;
    } else if (n === bestN) tie = true;
  }
  if (tie || bestN < 2) return null;
  const src = forms.find((f) => sectionKey(sec, f) === best);
  if (!src) return null;
  const patch: Partial<Form> = {};
  for (const k of sec.keys) (patch as Record<string, unknown>)[k] = src[k];
  return patch;
}

/** Шаг «Кабинеты» — состав группы и пиксель по каждому кабинету.
 *
 *  Живёт ОТДЕЛЬНО от SECTIONS намеренно. SECTIONS — это фасеты формы, и по ним
 *  строятся строки карты: там сравниваются значения групп между собой. Состав
 *  кабинетов сравнивать нечем, у каждой группы он свой по определению, и пустая
 *  строка в карте только мешала бы. Поэтому карта берёт SECTIONS, а редактор —
 *  EDITOR_STEPS.
 *
 *  Первым шагом потому, что пиксель принадлежит кабинету, а не связке: в одной
 *  группе живут кабы разных агентств, и общего пикселя им не хватает. Здесь же
 *  он и ЕДИНСТВЕННЫЙ раз выбирается — поле на шаге «Цель» для группы скрыто
 *  (`FormScopeValue.scope`), иначе одно значение задавалось бы в двух местах. */
export const CABS_STEP: SectionDef = {
  id: "cabs",
  idx: "00",
  label: "Ad accounts",
  why: "Group members and what each account overrides: pixel, link, URL params. Empty means the same as the bundle; empty pixel means auto — the first pixel of that account.",
  keys: [],
  summary: () => ({ v: "" }),
};

export const EDITOR_STEPS: SectionDef[] = [CABS_STEP, ...SECTIONS];
