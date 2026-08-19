// Form helpers: preset merge (with tag-from-bind) + resolveState (old readState() equivalent).

import type { Form, Group, ResolvedState } from "./types";

/** Merge a preset over a base form. When the preset omits `tag`, derive it from the
 * profile→tag binding — matches applyFullState()'s `s.tag ?? BIND[profile]` behaviour. */
export function mergePreset(base: Form, preset: Partial<Form>, bind: Record<string, string>): Form {
  const f: Form = { ...base, ...preset };
  if (preset.tag === undefined) f.tag = bind[f.profile] ?? "";
  return f;
}

/** Normalize raw form + per-profile picked/groups into the state consumed by builders. */
export function resolveState(form: Form, picked: string[], groups: Group[]): ResolvedState {
  return {
    profile: form.profile,
    tag: form.tag,
    acctMode: form.acctMode,
    picked: picked.slice(),
    groups: groups.map((g) => ({ ...g })),
    nCamp: Number(form.nCamp) || 1,
    nAdset: Number(form.nAdset) || 1,
    nAd: Number(form.nAd) || 1,
    objective: form.objective,
    convLoc: form.convLoc,
    pixel: form.pixel,
    event: form.event,
    formId: form.formId,
    attribution: form.attribution,
    budgetLevel: form.budgetLevel,
    daily: Number(form.daily) || 0,
    bidStrategy: form.bidStrategy,
    cap: Number(form.cap) || 0,
    geo: form.geo.split(",").map((x) => x.trim().toUpperCase()).filter(Boolean),
    ageMin: Number(form.ageMin),
    ageMax: Number(form.ageMax),
    gender: form.gender,
    device: form.device,
    advAud: form.advAud,
    plcMode: form.plcMode,
    plats: form.plats.slice(),
    positions: form.positions.split(",").map((x) => x.trim()).filter(Boolean),
    page: form.page,
    link: form.link,
    videos: form.videoLines.split("\n").map((x) => x.trim()).filter(Boolean),
    userOs: form.userOs,
    osVer: form.osVer.trim(),
    creoSrc: form.creoSrc,
    staticAsVideo: form.staticAsVideo,
    creoCta: form.creoCta,
    creoPt: form.creoPt,
    creoHl: form.creoHl,
    creoUrl: form.creoUrl,
    nmCamp: form.nmCamp,
    nmAdset: form.nmAdset,
    nmAd: form.nmAd,
    activate: form.activate,
    startTime: form.startTime,
    startLocal: form.startLocal,
    specialCat: form.specialCat,
    /* Через `|| ""`, а не напрямую: поле добавлено позже остальных, и в
       localStorage лежат формы групп, собранные до него. Пустая строка там
       означает ровно то же, что и раньше, — указаний нет; падение на
       `undefined.trim()` означало бы, что панель не открылась вовсе. */
    notes: (form.notes || "").trim(),
  };
}
