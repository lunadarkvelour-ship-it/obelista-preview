/* Что панель ЗНАЕТ о кабинете, когда рисует его строку в развороте крео.
 *
 * ПОЧЕМУ ОТДЕЛЬНЫЙ МОДУЛЬ, А НЕ ПОИСК ПО СНАПШОТУ НА МЕСТЕ
 *
 * До 15.08 строка кабинета в развороте брала имя и состояние ровно из ОДНОГО
 * источника — снапшота мака, который собирается через антидетект
 * (`CreativeTable.accIndex`). В облаке снапшота нет вовсе (решение 26 спеки), и
 * разворот показывал голый `act_1398031898947759` с серым кружком «неизвестно» —
 * при том, что имя кабинета приезжало в ТОМ ЖЕ ответе `/ads`, что и цифры
 * (`acc.name AS act_name`, `scripts/analytics_daemon.py:893`), и лежало
 * неиспользованным. Это и есть «шляпа вместо данных о кабинете» из #132: не
 * ошибка в данных, а выбранный не тот источник.
 *
 * Поэтому источников здесь ТРИ, и сведение их — отдельная чистая функция, а не
 * `?.` в разметке:
 *
 *   • `ads`      — `act_name`/`agency` из строк леса. Приезжает ВСЕГДА вместе с
 *                  деревом, одним запросом с цифрами: если на экране есть строка
 *                  кабинета, то есть и его имя. Единственный источник, который не
 *                  умеет отстать от таблицы.
 *   • `base`     — строки `account` из `GET /accounts`. Та же колонка `name`, но
 *                  здесь же живёт СОСТОЯНИЕ (`status`, `disable_reason`) и время
 *                  его снятия, которых у леса нет.
 *   • `snapshot` — состояние мака. Последний по очереди: он покрывает только те
 *                  кабинеты, которые видны с браузерных профилей оператора, и в
 *                  облаке его не бывает.
 *
 * НЕ ЗНАЕМ — ОТДЕЛЬНОЕ СОСТОЯНИЕ, А НЕ ЗНАЧЕНИЕ ПО УМОЛЧАНИЮ (#122). Кабинет, о
 * состоянии которого не спрашивал никто, получает `status: null`, а не «ACTIVE» и
 * не «DISABLED»: нарисовать живой там, где не проверяли, — то же враньё, что
 * нарисовать ноль вместо несобранного спенда. Поэтому у каждого поля едет и
 * `*_from` — кто это сказал: без него «имени нет» и «имя есть, но из снапшота
 * недельной давности» выглядят одинаково.
 */
import type { CloudAccount, CloudAccountRow } from "./cloud-accounts";
import type { Snapshot } from "./types";

/** Кто сказал. Порядок объявления — он же порядок доверия. */
export type FactSource = "base" | "ads" | "snapshot";

export interface AccountFact {
  act_id: string;
  /** Имя кабинета в Мете. `null` — не назвал ни один источник. */
  name: string | null;
  name_from: FactSource | null;
  /** Агентство, которому кабинет принадлежит. Есть только в лесу. */
  agency: string | null;
  /** Состояние словом Меты (`ACTIVE`, `DISABLED`, `UNSETTLED`…).
   *  `null` — НЕ СПРАШИВАЛИ, а не «всё хорошо». */
  status: string | null;
  status_from: FactSource | null;
  /** Когда состояние снимали. Только у базы: снапшот датирует профиль целиком,
   *  а не кабинет, и приписывать его дату кабинету значит выдумывать точность. */
  status_at: string | null;
  /** Причина отключения текстом — из базы, по-английски (`core/catalog.py`). */
  disable_reason: string | null;
}

/** Строка леса, из которой берётся имя. Ровно те поля, что нужны: тащить сюда
 *  весь `AdRow` значит требовать спенд и воронку там, где нужно имя. */
export interface AdNameRow {
  act_id: string;
  act_name?: string | null;
  agency?: string | null;
}

export interface FactSources {
  ads?: AdNameRow[] | null;
  base?: CloudAccount[] | null;
  snapshot?: Snapshot | null;
}

function empty(act_id: string): AccountFact {
  return {
    act_id,
    name: null, name_from: null,
    agency: null,
    status: null, status_from: null, status_at: null,
    disable_reason: null,
  };
}

/** Непустая строка или `null`. Мета отдаёт `''` там, где имени нет, а пустая
 *  строка в поле имени рисуется как строка без подписи — то же «не знаем», но
 *  выглядящее как знание. */
function str(v: unknown): string | null {
  const s = typeof v === "string" ? v.trim() : "";
  return s ? s : null;
}

/** Сведение источников в одну карту `act_id → факты`.
 *
 *  Поле заполняет ПЕРВЫЙ источник, у которого оно есть; следующие его не
 *  перетирают. Спорить источникам почти не о чем — имя у базы и у леса это одна
 *  и та же колонка `account.name`, — но когда лес отстал от базы на перезалив
 *  кабинета, права база: её строку пишет тот же обзор, что снимает спенд. */
export function accountFacts(src: FactSources): Map<string, AccountFact> {
  const out = new Map<string, AccountFact>();
  const at = (act_id: string) => {
    let f = out.get(act_id);
    if (!f) out.set(act_id, (f = empty(act_id)));
    return f;
  };

  for (const a of src.base || []) {
    if (!a?.act_id) continue;
    const f = at(a.act_id);
    const name = str(a.name);
    if (name) { f.name = name; f.name_from = "base"; }
    const status = str(a.status);
    if (status) {
      f.status = status;
      f.status_from = "base";
      f.status_at = str(a.status_checked_at);
    }
    f.disable_reason ??= str(a.disable_reason);
  }

  for (const r of src.ads || []) {
    if (!r?.act_id) continue;
    const f = at(r.act_id);
    const name = str(r.act_name);
    if (name && !f.name) { f.name = name; f.name_from = "ads"; }
    f.agency ??= str(r.agency);
  }

  for (const p of Object.values(src.snapshot?.profiles || {})) {
    for (const a of p?.accounts || []) {
      if (!a?.id) continue;
      const f = at(a.id);
      const name = str(a.name);
      if (name && !f.name) { f.name = name; f.name_from = "snapshot"; }
      const status = str(a.status);
      if (status && !f.status) { f.status = status; f.status_from = "snapshot"; }
      f.disable_reason ??= str(a.disable_reason);
    }
  }

  return out;
}

/* ── ЧИТАЕМОЕ ИМЯ СОЦА ────────────────────────────────────────────────────────
 *
 * `k1f9qbcs` — это id окна антидетекта, а не имя. В фильтре, в чипсах и на
 * строке кабинета он стоял голым, и человек, у которого профилей десяток,
 * выбирал соца по восьми случайным символам. Имя у нас есть в двух местах и
 * ровно то же самое, что он видит в антидетекте: `owners[].name` в ответе
 * `/accounts` и `profiles[id].label` в снапшоте мака.
 *
 * ИМЯ — ТОЛЬКО ПОКАЗ. Фильтр, выгрузка и `manage` продолжают ходить по id:
 * имена не уникальны (два профиля зовут одинаково постоянно), а id уникален,
 * и подменить его именем значит отобрать не тот срез. Поэтому здесь ДВЕ
 * функции, и обе возвращают строку для глаза, а не ключ: `profileDisplay` для
 * места, где id уже негде показать, и `profileHint` для подсказки, которая
 * обязана назвать id ВСЕГДА — иначе человек, нашедший строку глазами, не
 * сможет скопировать её id.
 */

export interface ProfileLabelSources {
  /** Строки `GET /accounts` — единственный источник, который есть в облаке. */
  base?: CloudAccountRow[] | null;
  /** Снапшот мака: `profiles[id].label`. В облаке его нет вовсе. */
  snapshot?: Snapshot | null;
}

/** Карта `profile_id → человеческое имя`. Порядок тот же, что у `accountFacts`:
 *  первый источник, у которого имя есть, и выигрывает.
 *
 *  Имя, РАВНОЕ id, в карту не кладём: это не имя, а тот же id, положенный в
 *  поле имени, и от него на экране не меняется ничего — зато `profileHint`
 *  начал бы печатать «k1a (k1a)». */
export function profileLabels(src: ProfileLabelSources): Map<string, string> {
  const out = new Map<string, string>();
  const put = (id: unknown, name: unknown) => {
    const pid = str(id);
    const label = str(name);
    if (!pid || !label || label === pid || out.has(pid)) return;
    out.set(pid, label);
  };

  for (const a of src.base || []) {
    for (const o of a?.owners || []) put(o?.profile_id, o?.name);
  }
  for (const [pid, p] of Object.entries(src.snapshot?.profiles || {})) {
    put(pid, p?.label);
  }
  return out;
}

/** Что показать вместо id. Имени нет — показываем id: пустая подпись у соца
 *  читалась бы как «соца нет», а он есть, просто безымянный. */
export function profileDisplay(
  id: string,
  labels?: ReadonlyMap<string, string> | null,
): string {
  return (id && labels?.get(id)) || id;
}

/** Подсказка на список соцев. Id стоит в ней ВСЕГДА, даже когда имя известно:
 *  подсказка — единственное место, откуда id ещё можно скопировать после того,
 *  как строка стала читаемой. */
export function profileHint(
  ids: readonly string[],
  labels?: ReadonlyMap<string, string> | null,
): string {
  return ids
    .map((id) => {
      const label = labels?.get(id);
      return label ? `${label} (${id})` : id;
    })
    .join(", ");
}

/** Подпись под кружок состояния — словами и с указанием, кто это сказал.
 *
 *  Отдельной функцией, потому что «неизвестно» обязано быть предложением, а не
 *  серым кружком без текста: серый читается как «нормально, просто бледно», и
 *  ровно так же читался бы ноль вместо несобранного спенда (#122). */
export function stateHint(f: AccountFact | undefined, act_id: string): string {
  if (!f?.status) {
    return `${act_id} — state unknown: nobody has checked this ad account. ` +
      `Not the same as “active”.`;
  }
  const кто = f.status_from === "base" ? "from the collector" : "from the local snapshot";
  const когда = f.status_at ? `, checked ${f.status_at}` : "";
  const почему = f.disable_reason ? ` · ${f.disable_reason}` : "";
  return `${act_id} — ${f.status} ${кто}${когда}${почему}`;
}
