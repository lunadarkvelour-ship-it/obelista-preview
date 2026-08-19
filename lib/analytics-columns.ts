/**
 * Каталог колонок лидерборда.
 *
 * Порядок здесь — порядок в таблице, независимо от порядка включения: иначе
 * таблица перетасовывается под руками при каждом клике в выборе колонок.
 *
 * Группы — те, которыми думает байер: деньги, воронка, конверсии, охват.
 * Не «метрики» и «показатели», а «сколько стоило» и «сколько дошло».
 *
 * ЧТО ЭТА КОЛОНКА ЗНАЧИТ — РЕШАЕТ НЕ ЭТОТ ФАЙЛ. Состав воронки, её подписи,
 * расшифровки, вид и пары «что делим на что» живут в общем каталоге
 * `lib/funnel-metrics` — том же, из которого их читают «Кампании». Здесь
 * остаётся ровно то, что принадлежит ЭКРАНУ этого листа: в каком порядке
 * колонки стоят, в какой они группе и какой ширины. Раньше подписи стояли и
 * тут, и там, и «одинаковые метрики на двух листах» держались на том, что
 * никто не опечатался.
 */
import {
  FUNNEL_BY_ID, FUNNEL_DERIVED_BY_ID,
  type FunnelCostId, type FunnelRatioId, type LeaderboardFunnelId,
} from "./funnel-metrics";

export type ColKey =
  | "spend" | "clicks" | "ads" | "ads_with_ftd" | "geos"
  | LeaderboardFunnelId | FunnelCostId | FunnelRatioId;

export type ColKind = "money" | "int" | "pct" | "text";

export interface ColDef {
  key: ColKey;
  title: string;
  hint?: string;
  group: "деньги" | "воронка" | "конверсии" | "охват";
  kind: ColKind;
  width: number;
}

/** Колонка ступени воронки: подпись и расшифровка — из общего каталога, группа
 *  и ширина — здешние. `kind: "int"` здесь свой намеренно: на лидерборде
 *  ступени всегда штучные (выручки на нём нет), а вид метрики каталога шире. */
function шаг(key: LeaderboardFunnelId, width: number): ColDef {
  const m = FUNNEL_BY_ID[key];
  return { key, title: m.title, hint: m.hint, group: "воронка", kind: "int", width };
}

/** Колонка производной (цена или отношение) — оттуда же. */
function произв(
  key: FunnelCostId | FunnelRatioId,
  group: ColDef["group"],
  width: number,
): ColDef {
  const d = FUNNEL_DERIVED_BY_ID[key];
  return {
    key,
    title: d.title,
    ...(d.hint ? { hint: d.hint } : {}),
    group,
    kind: d.kind,
    width,
  };
}

/* `group` — это КЛЮЧ каталога, а не подпись: по нему ColumnPicker отбирает
   колонки, а на экран выводит свою английскую подпись (GROUP_LABEL там же).
   Поэтому значения групп остаются как есть, переводятся только title и hint. */
export const COLUMNS: ColDef[] = [
  { key: "spend", title: "Spend", group: "деньги", kind: "money", width: 92 },
  произв("cpftd", "деньги", 86),
  произв("cprd", "деньги", 84),
  произв("cpsub", "деньги", 84),
  произв("cpcon", "деньги", 84),
  произв("cpcheck", "деньги", 92),

  шаг("ftd", 68),
  шаг("rd", 62),
  шаг("checkout", 72),
  шаг("contact", 74),
  шаг("sub", 78),

  произв("sub_to_ftd", "конверсии", 80),
  произв("sub_to_rd", "конверсии", 74),
  произв("sub_to_checkout", "конверсии", 78),
  произв("sub_to_contact", "конверсии", 82),

  { key: "ads", title: "Ads", hint: "ads with this creative in the window", group: "охват", kind: "int", width: 76 },
  { key: "ads_with_ftd", title: "with FTD", hint: "of those, brought at least one deposit", group: "охват", kind: "int", width: 72 },
  { key: "clicks", title: "Clicks", group: "охват", kind: "int", width: 80 },
  произв("clicks_per_ftd", "охват", 82),
  { key: "geos", title: "Geo", group: "охват", kind: "text", width: 84 },
];

export const BY_KEY = Object.fromEntries(COLUMNS.map((c) => [c.key, c])) as
  Record<ColKey, ColDef>;

/** Включить колонку, не ломая ручную раскладку.
 *
 *  Порядок колонок принадлежит юзеру: он переставляет их прямо в шапке. Раньше
 *  включение пересобирало список из каталога, и одно нажатие в выборе колонок
 *  стирало всю перестановку. Поэтому новая колонка встаёт туда, где ей место по
 *  каталогу ОТНОСИТЕЛЬНО уже показанных, а взаимный порядок остальных не
 *  трогается вовсе. */
export function withColumn(visible: ColKey[], key: ColKey): ColKey[] {
  if (visible.includes(key)) return visible;
  const rank = (k: ColKey) => COLUMNS.findIndex((c) => c.key === k);
  const at = visible.findIndex((k) => rank(k) > rank(key));
  const out = visible.slice();
  out.splice(at < 0 ? out.length : at, 0, key);
  return out;
}

/** Переставить колонку `key` на позицию `to`. Вынесено из компонента, чтобы
 *  перестановку можно было проверить тестом, а не только руками в браузере. */
export function moveColumn(visible: ColKey[], key: ColKey, to: number): ColKey[] {
  const from = visible.indexOf(key);
  if (from < 0 || to < 0 || to >= visible.length || from === to) return visible;
  const out = visible.slice();
  out.splice(to, 0, out.splice(from, 1)[0]);
  return out;
}

/** Что видно из коробки. Порядок задан юзером и держится на одном правиле:
 *  за каждой ступенью воронки СРАЗУ идёт её цена. Подп → CPSub, Конт → CPCon,
 *  Чек → CPCheck, FTD → CPFTD, РД → CPRD. Так пара «сколько» и «почём» читается
 *  одним движением глаз, а не поиском по таблице. Дальше конверсии от подписки
 *  вниз по воронке, и в конце — сколько объявлений принесли хотя бы деп.
 *
 *  «Объяв» и «Гео» из коробки убраны намеренно: они про раскладку, а не про
 *  результат, и включаются выбором колонок. */
export const DEFAULT_VISIBLE: ColKey[] = [
  "spend",
  "sub", "cpsub",
  "contact", "cpcon",
  "checkout", "cpcheck",
  "ftd", "cpftd",
  "rd", "cprd",
  "sub_to_contact", "sub_to_checkout", "sub_to_ftd", "sub_to_rd",
  "ads_with_ftd",
];

/* Версия в ключе. Раскладка лежит в браузере, и без версии новый порядок по
   умолчанию не доехал бы ни до кого, кто хоть раз открывал лист: сохранённый
   старый список всегда перебивает дефолт. Меняем версию — сохранённое от
   прошлой раскладки перестаёт учитываться ровно один раз. */
export const LS_KEY = "laundry-analytics-columns-v2";
const KEY = LS_KEY;

export function loadVisible(): ColKey[] {
  if (typeof window === "undefined") return DEFAULT_VISIBLE;
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return DEFAULT_VISIBLE;
    const got = JSON.parse(raw);
    if (!Array.isArray(got) || !got.length) return DEFAULT_VISIBLE;
    // Фильтруем по каталогу: колонку могли переименовать или убрать, и
    // сохранённый ключ из прошлой версии не должен ломать таблицу.
    const ok = got.filter((k) => k in BY_KEY) as ColKey[];
    return ok.length ? ok : DEFAULT_VISIBLE;
  } catch {
    return DEFAULT_VISIBLE;
  }
}

export function saveVisible(keys: ColKey[]) {
  try {
    window.localStorage.setItem(KEY, JSON.stringify(keys));
  } catch {
    /* приватный режим — не повод падать */
  }
}
