/**
 * Личные рекламные кабинеты Facebook — те, что заводятся сами вместе с
 * аккаунтом. Заливаться в них нельзя: они не агентские, банятся мгновенно и
 * тянут за собой профиль.
 *
 * Раньше это был список из трёх act_id, вписанный руками. Список рос молча:
 * новый соц — новая личка, о которой панель не знает, и байер узнаёт о ней по
 * бану. Плюс чужому человеку такой список бесполезен вовсе.
 *
 * Теперь признак выводится из данных. Личный кабинет Мета называет именем
 * самого пользователя, и это единственная пара, которая совпадает: имя
 * кабинета == имя аккаунта FB. Совпадение считаем без учёта регистра и лишних
 * пробелов — Мета иногда отдаёт имя с хвостом.
 *
 * Работает на снапшоте через приложение: там `label` профиля — это настоящее
 * имя аккаунта FB. На старом браузерном снапшоте в label лежит подпись профиля
 * из антика («17/7 spx»), совпадений не будет, и это честнее, чем угадывать.
 */
import type { Snapshot } from "./types";

const norm = (s: string | undefined | null) =>
  (s || "").trim().toLowerCase().replace(/\s+/g, " ");

export function personalAccounts(snapshot: Snapshot | null): Record<string, number> {
  const out: Record<string, number> = {};
  const profiles = (snapshot?.profiles || {}) as Record<
    string,
    { label?: string; accounts?: Array<{ id?: string; name?: string }> }
  >;
  for (const pid in profiles) {
    const who = norm(profiles[pid].label);
    if (!who) continue;
    for (const a of profiles[pid].accounts || []) {
      if (a.id && norm(a.name) === who) out[a.id] = 1;
    }
  }
  return out;
}
