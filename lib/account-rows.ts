/* Кабинет — сущность, соц — способ его увидеть.
 *
 * Лист «Кабинеты» строился плоским произведением профиль×каб, и один и тот же
 * кабинет давал столько строк, сколько соцев его видят. Замер на живом
 * снапшоте 13.08: 209 строк на 138 кабинетов — 71 лишняя, и ровно на столько
 * же врал счётчик «всего».
 *
 * Дубли почти целиком призрачные: во всех 71 случае живой владелец был ровно
 * один, а остальные — профили, выбывшие из антика. Связи копятся и никогда не
 * помечаются мёртвыми (`act_1574869187497859` числился за пятью соцами при
 * одном живом).
 *
 * Поэтому схлопываем по `act_id`, а соцев держим списком. Главный соц выбирается
 * не как попало: движок резолвит кабы ВНУТРИ профиля (`core/uploader.py:
 * resolve_profile`), на чужом отвечает «Кабинеты не найдены», а `GroupMember` —
 * это пара (соц, каб). Схлопнуть строку, потеряв рабочего соца, значит поменять
 * баг «видно дважды» на баг «залив не идёт».
 *
 * Три признака соца РАЗНЫЕ, и смешивать их нельзя — это и была исходная болезнь:
 *   • существует     — знает Обелиста; сегодня её единственный источник
 *                      это список антидетекта на машине оператора (`in_antik`),
 *                      и когда его нет, признак не «ложь», а «подтвердить
 *                      некому» (`lib/antik-profiles`);
 *   • подключён      — есть токен прилы, с него можно лить;
 *   • свежий         — его данные собраны недавно.
 * `k1f15y8n` и `k1fn9qb1` 13.08 были в антике, но без токена и потому несвежие.
 * Посчитать их выбывшими значило бы спрятать живые кабинеты.
 */
import type { Snapshot, SnapshotAccount } from "./types";
import { freshProfiles } from "./staleness";

export interface AccountOwner {
  /** id профиля в антике. */
  profile: string;
  /** Человеческое имя; пусто — покажем id. */
  label: string;
  /** Когда данные этого соца собрались. */
  collectedAt?: string;
  /** Есть ли профиль в антике. `null` — списка профилей нет, и мы НЕ ЗНАЕМ:
   *  объявить соца выбывшим из-за закрытого антидетекта нельзя. */
  present: boolean | null;
  /** Данные соца свежие. */
  fresh: boolean;
  /** Соц подключён к приложению — с него можно лить. */
  oauth: boolean;
  provider?: string;
  providerProfileId?: string;
  snapshotRevision?: string;
}

export interface AccountRow {
  acc: SnapshotAccount;
  /** Соц, от имени которого работаем: с него льём. */
  profile: string;
  profileLabel: string;
  /** Все соцы, с которых кабинет виден. Главный первым. */
  owners: AccountOwner[];
  provider?: string;
  providerProfileId?: string;
  snapshotRevision?: string;
  snapshotGeneratedAt?: string;
}

/** Насколько соц годится в главные. Меньше — лучше.
 *
 *  Порядок не вкусовой. Выбывший из антика идёт в конец всегда: лить с
 *  несуществующего профиля нельзя, сколько бы у него ни было токенов — токен в
 *  базе переживает уход профиля. Дальше решает подключение (без него залива нет
 *  вовсе), и лишь потом свежесть.
 */
function вес(o: AccountOwner): number {
  return (o.present === false ? 8 : 0) + (o.oauth ? 0 : 2) + (o.fresh ? 0 : 1);
}

/** Свежее — раньше. Пустая метка последняя: «не знаю когда» — не довод. */
function свежее(a: AccountOwner, b: AccountOwner): number {
  const x = a.collectedAt || "";
  const y = b.collectedAt || "";
  if (x === y) return a.profile.localeCompare(b.profile);
  if (!x) return 1;
  if (!y) return -1;
  return x < y ? 1 : -1;
}

export interface RowsOpts {
  /** Профили, которые есть в антике. `undefined`/`null` — антик не ответил,
   *  и никого не помечаем выбывшим. */
  present?: Set<string> | null;
  /** Профили с живым токеном прилы. */
  oauth?: Set<string> | null;
  now?: number;
  maxAgeH?: number;
}

/** Кабинеты парка, по одной строке на кабинет. */
export function accountRows(
  snap: Snapshot | null | undefined,
  opts: RowsOpts = {},
): AccountRow[] {
  const profiles = snap?.profiles || {};
  const свежие = freshProfiles(snap, opts.now, opts.maxAgeH);
  const { present, oauth } = opts;

  const владелец = (pid: string, label?: string): AccountOwner => ({
    profile: pid,
    label: label || profiles[pid]?.label || "",
    collectedAt: profiles[pid]?.collected_at,
    present: present ? present.has(pid) : null,
    fresh: свежие.has(pid),
    oauth: oauth ? oauth.has(pid) : false,
    provider: snap?.provider,
    providerProfileId: pid,
    snapshotRevision: snap?.snapshot_revision,
  });

  const строки = new Map<string, AccountRow>();
  for (const pid of Object.keys(profiles)) {
    const p = profiles[pid];
    const accs = p.accounts || [];
    for (let i = 0; i < accs.length; i++) {
      const acc = accs[i];
      // Кабинет без id склеивать не с чем: у него нет тождества. Оставляем
      // отдельной строкой, чтобы битая запись была видна, а не растворилась.
      const key = acc?.id ? `act:${acc.id}` : `broken:${pid}:${i}`;
      const было = строки.get(key);
      if (!было) {
        строки.set(key, {
          acc,
          profile: pid,
          profileLabel: p.label || pid,
          owners: [владелец(pid)],
          provider: snap?.provider,
          providerProfileId: pid,
          snapshotRevision: snap?.snapshot_revision,
          snapshotGeneratedAt: snap?.generated_at,
        });
        continue;
      }
      if (!было.owners.some((o) => o.profile === pid)) было.owners.push(владелец(pid));
    }
  }

  /* `also_on` демон считает отдельным проходом и только по данным приложения.
     Сойтись с обходом выше он обязан, но расхождение двух реестров — это и есть
     болезнь, которую мы лечим, поэтому берём объединение, а не верим одному. */
  for (const row of строки.values()) {
    for (const a of row.acc.also_on || []) {
      if (!a?.profile || row.owners.some((o) => o.profile === a.profile)) continue;
      row.owners.push(владелец(a.profile, a.label));
    }
  }

  const out: AccountRow[] = [];
  for (const row of строки.values()) {
    row.owners.sort((a, b) => вес(a) - вес(b) || свежее(a, b));
    const главный = row.owners[0];
    if (главный) {
      row.profile = главный.profile;
      row.profileLabel = главный.label || главный.profile;
      row.providerProfileId = главный.providerProfileId || главный.profile;
    }
    /* Данные — от САМОГО СВЕЖЕГО владельца, а не от главного. Главный выбран
       по годности к заливу, и это другой вопрос: показывать вчерашний статус
       кабинета только потому, что именно с этого соца мы льём, значит врать
       ровно тем способом, против которого весь этот файл. */
    if (row.acc?.id) {
      const свежий = [...row.owners].sort(свежее)[0];
      const копия = (profiles[свежий?.profile]?.accounts || []).find(
        (a) => a?.id === row.acc.id,
      );
      if (копия) row.acc = копия;
    }
    out.push(row);
  }
  return out;
}

/** Соцы этой строки, кроме главного — то, что показывает бейдж «виден ещё с». */
export function otherOwners(row: AccountRow): AccountOwner[] {
  return row.owners.filter((o) => o.profile !== row.profile);
}
