/**
 * Где живут правила, пока панель не подключена к движку.
 *
 * ЗАГОЛОВОК ЗДЕСЬ ДО 16.08 ЗВУЧАЛ ИНАЧЕ — «пока сервера нет», и рядом стояло
 * «серверного воркера не существует физически, ручки под правила в демоне тоже
 * нет». Правдой это быть перестало: движок написан (`core/rules.py`, #141), а
 * ручки `/rules` и `/rules/log` в демоне есть
 * (`scripts/analytics_daemon.py:2435,2440`). Правда — то, что ПАНЕЛЬ их не
 * зовёт ни разу: подключение листа к движку не сделано и остаётся отдельной
 * работой. Пока её нет, выбор ниже действует без изменений.
 *
 * Вариантов было три, и выбран третий:
 *
 *  1. Ничего не хранить, лист только объясняет — так было до 15.08. Честно,
 *     но проверить фразой-конструктором нечего: сохранить некуда.
 *  2. Нарисовать выдуманные правила фикстурой — так делать нельзя: панель уже
 *     показывала «подключён» на мёртвом токене, и стоило это доверия ко всем
 *     цифрам разом.
 *  3. Хранить НАСТОЯЩИЕ правила человека в его же браузере и сказать об этом
 *     прямо. Правило, которое он собрал, — не выдумка, оно его. Врать здесь
 *     нечему при одном условии: лист обязан говорить, что это черновики в
 *     браузере, а не строки на сервере, и что сработать они не могут.
 *
 * Отсюда `STORAGE_NOTE` — не украшение, а часть контракта хранилища: текст
 * лежит рядом с кодом, который делает его правдой, и не может остаться на
 * экране, когда правила поедут на сервер.
 *
 * УДАЛЕНИЯ В ЭТОМ ФАЙЛЕ НЕТ. Ни правил, ни объектов Меты. Владелец 15.08
 * сказал дословно: «УДАЛЯТЬ НИКОГДА — ни кнопки, ни кода, ни на всякий
 * случай». Правило выключают, а не стирают: выключенное видно списком и
 * объясняет, почему когда-то было заведено, а стёртое не объясняет ничего.
 * Тест `rules-store.test.ts` проверяет, что в модуле нет ни одной функции с
 * `delete`/`remove` в имени — чтобы «на всякий случай» не появилось само.
 */

import type { Rule, RuleRunContext } from "./rules";

/** Ключ в localStorage. С версией в имени: когда правила поедут на сервер,
 *  старый ключ будет видно и можно будет перенести, а не молча потерять. */
export const RULES_STORAGE_KEY = "obelista.rules.v1";

/** Единственная строка, которой лист объясняет природу хранилища. */
export const STORAGE_NOTE =
  "Rules are saved in this browser only. There is no server to run them yet, so nothing here can pause or resume anything.";

/* --- Чистые операции над списком ------------------------------------------ */

/** Следующий id — детерминированно, без `Math.random` и без времени.
 *  Случайность в id означала бы, что тест на добавление невозможно написать
 *  без моков, а сам список нельзя сравнить с ожидаемым целиком. */
export function nextRuleId(list: readonly Rule[]): string {
  const max = list.reduce((acc, r) => {
    const n = Number(/^r(\d+)$/.exec(r.id)?.[1] ?? 0);
    return Number.isFinite(n) && n > acc ? n : acc;
  }, 0);
  return `r${max + 1}`;
}

export function addRule(list: readonly Rule[], rule: Rule): Rule[] {
  return [...list, rule];
}

/** Правка существующего правила. Возвращает НОВЫЙ список — тот же id, новые
 *  поля; `enabled` берётся из старого правила, если новое его не несёт:
 *  правка условия не должна незаметно включать выключенное правило. */
export function replaceRule(list: readonly Rule[], rule: Rule): Rule[] {
  return list.map((r) => (r.id === rule.id ? { ...rule, enabled: rule.enabled ?? r.enabled } : r));
}

export function setRuleEnabled(list: readonly Rule[], id: string, enabled: boolean): Rule[] {
  return list.map((r) => (r.id === id ? { ...r, enabled } : r));
}

/* --- Контекст без движка ---------------------------------------------------
 *
 * `RuleRunContext` описывает то, что вокруг правила меняется само: жив ли
 * движок, годна ли цель, что намерили. Сегодня движка нет НИ У ОДНОГО
 * правила, и это не приближение, а факт: `engineRunning: false` здесь —
 * единственный честный ответ, а не заглушка «пока так».
 *
 * `runnable: true` — тоже не выдумка, а разделение вопросов: цель годна,
 * если у каба есть живой путь тушения (токен + видимость с подключённого
 * соца, контур #35). Проверять это некому до появления ручки, и правило,
 * помеченное `unrunnable` без проверки, соврало бы в другую сторону — как
 * будто мы что-то знаем о цели. Поэтому годность утверждается, а неработа
 * объясняется отсутствием движка — тем, что действительно известно.
 */
export function stubRunContext(): RuleRunContext {
  return { engineRunning: false, runnable: true };
}

/* --- Журнал -----------------------------------------------------------------
 *
 * Форма записи ПЕРЕЕХАЛА в `rules-log.ts` вместе со словами и правилами отката.
 * Здесь её больше нет намеренно: тип, объявленный в двух файлах, — это два
 * контракта под одним именем, и разъезжаются они молча. Файл про хранилище
 * знает про журнал ровно ничего.
 */

/* --- Хранилище ------------------------------------------------------------ */

/** Мини-интерфейс вместо `Storage` целиком: тест подсовывает объект из трёх
 *  строк, а не поднимает jsdom ради `localStorage` (окружение тестов панели —
 *  node, см. `vitest.config.ts`). */
export interface RulesStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

/** Хранилище браузера, если оно есть. `null` на сервере Next — и это не
 *  ошибка: страница рисуется и без него, просто пустой. */
export function browserStorage(): RulesStorage | null {
  try {
    return typeof window === "undefined" ? null : window.localStorage;
  } catch {
    // Приватный режим Safari умеет бросать на самом обращении к localStorage.
    return null;
  }
}

/** Чтение с проверкой. Мусор в ключе (чужая версия, обрезанный JSON, правка
 *  руками) не должен ронять лист: пустой список честнее белого экрана. */
export function loadRules(storage: RulesStorage | null = browserStorage()): Rule[] {
  if (!storage) return [];
  let raw: string | null = null;
  try {
    raw = storage.getItem(RULES_STORAGE_KEY);
  } catch {
    return [];
  }
  if (!raw) return [];
  try {
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(isRule);
  } catch {
    return [];
  }
}

export function saveRules(list: readonly Rule[], storage: RulesStorage | null = browserStorage()): void {
  if (!storage) return;
  try {
    storage.setItem(RULES_STORAGE_KEY, JSON.stringify(list));
  } catch {
    /* Квота или запрет записи. Терять экран из-за этого нельзя: правила
       останутся в памяти вкладки и просто не переживут перезагрузку. */
  }
}

/** Страж для данных, пришедших не из TypeScript. Проверяет форму, а не
 *  правдоподобие: id и условие обязаны быть на месте, иначе строка не
 *  правило, а обломок. */
function isRule(v: unknown): v is Rule {
  if (!v || typeof v !== "object") return false;
  const r = v as Record<string, unknown>;
  const c = r.condition as Record<string, unknown> | undefined;
  return (
    typeof r.id === "string" &&
    typeof r.targetId === "string" &&
    (r.action === "pause" || r.action === "resume") &&
    typeof r.enabled === "boolean" &&
    !!c &&
    typeof c.value === "number" &&
    typeof c.windowHours === "number"
  );
}
