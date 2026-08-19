/* Какие поля формы относятся к какой секции.
 *
 * Нужно пресетам с областью: «сохранить только таргетинг и бюджет» — чтобы
 * пресет не тащил за собой профиль, выбранные кабы и ссылку на оффер.
 * Карта покрывает КАЖДОЕ поле Form ровно один раз; за этим следит тест
 * preset-scope.test.ts — иначе поле молча выпало бы из всех пресетов.
 */

import type { Form } from "./types";

export interface ScopeGroup {
  id: string;
  label: string;
  /** Поля формы. Пусто — секция хранит не форму, а своё состояние (кабы, группы). */
  fields: (keyof Form)[];
  /** Секция несёт выбранные кабы (picked). */
  carriesPicked?: boolean;
  /** Секция несёт хвост-группы (groups). */
  carriesGroups?: boolean;
}

export const SCOPE_GROUPS: ScopeGroup[] = [
  { id: "profile", label: "Profile and accounts", fields: ["profile", "tag", "acctMode"], carriesPicked: true },
  { id: "structure", label: "Structure", fields: ["nCamp", "nAdset", "nAd"] },
  { id: "goal", label: "Objective", fields: ["objective", "convLoc", "pixel", "event", "formId", "attribution"] },
  { id: "budget", label: "Budget", fields: ["budgetLevel", "daily", "bidStrategy", "cap"] },
  {
    id: "targeting",
    label: "Targeting",
    fields: ["geo", "ageMin", "ageMax", "gender", "device", "userOs", "osVer", "advAud"],
  },
  { id: "placements", label: "Placements", fields: ["plcMode", "plats", "positions"] },
  { id: "page", label: "Page and offer", fields: ["page", "link"] },
  {
    id: "creatives",
    label: "Creatives",
    fields: ["videoLines", "creoSrc", "staticAsVideo", "creoCta", "creoPt", "creoHl", "creoUrl"],
  },
  { id: "groups", label: "URL param groups", fields: [], carriesGroups: true },
  { id: "naming", label: "Naming", fields: ["nmCamp", "nmAdset", "nmAd"] },
  { id: "launch", label: "Launch", fields: ["activate", "startTime", "startLocal", "specialCat"] },
  /* Своя область, а не довесок к «Креативам» или «Запуску»: указания живут
     столько же, сколько конкретный залив («крео в папке from ffmpeg script»), а
     пресет переживает десятки заливов. В общей области чужая записка молча
     приезжала бы в новую связку. */
  { id: "notes", label: "Notes", fields: ["notes"] },
];

export const ALL_SCOPE_IDS = SCOPE_GROUPS.map((g) => g.id);

/** Поля формы, попадающие в пресет с такой областью. */
export function fieldsForScope(scope: string[]): (keyof Form)[] {
  const on = new Set(scope);
  return SCOPE_GROUPS.filter((g) => on.has(g.id)).flatMap((g) => g.fields);
}

export function scopeCarries(scope: string[], what: "picked" | "groups"): boolean {
  const on = new Set(scope);
  return SCOPE_GROUPS.some(
    (g) => on.has(g.id) && (what === "picked" ? g.carriesPicked : g.carriesGroups)
  );
}

/** Срез формы по области — то, что реально уедет в пресет. */
export function sliceForm(form: Form, scope: string[]): Partial<Form> {
  const out: Partial<Form> = {};
  for (const k of fieldsForScope(scope)) {
    // Индексный доступ по union-ключу: TS не сводит типы поля, но набор ключей
    // берётся из той же Form, так что значение всегда своего типа.
    (out as Record<string, unknown>)[k] = form[k];
  }
  return out;
}

/** Человеческая подпись области: «весь сетап» или список секций. */
export function scopeLabel(scope: string[] | undefined): string {
  if (!scope || scope.length === ALL_SCOPE_IDS.length) return "full setup";
  const names = SCOPE_GROUPS.filter((g) => scope.includes(g.id)).map((g) => g.label);
  return names.length ? names.join(", ") : "empty";
}
