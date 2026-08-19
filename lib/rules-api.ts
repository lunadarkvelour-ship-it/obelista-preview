/**
 * Стык панели с движком автоправил (#141).
 *
 * ФОРМА ВЗЯТА ИЗ `rules.ts`, А НЕ ИЗ ПАМЯТИ, и это не общая фраза. Когда я
 * спрашивал контракт, я написал по памяти `targetKind` и `condition.op` —
 * движок нашёл оба расхождения за секунду, потому что его тест читает
 * НАСТОЯЩИЙ `panel/lib/rules.ts`, а не список имён. В файле это `scope` и
 * `condition.comparator`. Поэтому здесь нет ни одного переименования: типы
 * приходят из `./rules`, и разъехаться им не с чем.
 *
 * УДАЛЕНИЯ НЕТ НИ ОДНОГО, и это взаимно: у движка нет ни пути, ни функции, у
 * панели нет вызова. Слово владельца дословно — «удалять никогда: ни кнопки,
 * ни кода, ни на всякий случай». Правило выключают; выключенное объясняет,
 * почему когда-то было заведено, а стёртое не объясняет ничего.
 *
 * ОТКАТ ПРИНИМАЕТ id ЗАПИСИ ЖУРНАЛА, А НЕ ПРАВИЛА. Ошибиться здесь легко —
 * оба «id», оба строки, — и цена ошибки не «ничего не произошло», а откат
 * чужого действия. Поэтому у функции имя, которое невозможно прочитать иначе.
 */

import { API_BASE } from "./analytics";
import type { Rule, RuleRunContext } from "./rules";
import type { RuleLogEntry } from "./rules-log";

export const RULES_API = {
  list: "/rules",
  log: "/rules/log",
  save: "/rules/save",
  toggle: "/rules/toggle",
  undo: "/rules/undo",
} as const;

/** Правило вместе с тем, что вокруг него меняется само. */
export interface RuleWithRun {
  rule: Rule;
  run: RuleRunContext;
}

export interface RulesSnapshot {
  /** Тот самый признак, ради которого лист перестанет извиняться за браузер.
   *  Приходит на ВЕСЬ ответ, а не по правилу: воркер один. */
  engineRunning: boolean;
  rules: RuleWithRun[];
}

async function зов(path: string, body?: unknown): Promise<Record<string, unknown>> {
  const r = await fetch(API_BASE + path, {
    method: body === undefined ? "GET" : "POST",
    credentials: "include",
    cache: "no-store",
    headers: body === undefined ? undefined : { "Content-Type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const data = (await r.json().catch(() => ({}))) as Record<string, unknown>;
  /* Текст отказа отдаём наверх как есть: движок отвечает 400 человеческой
     фразой (например про окно не кратное суткам), и пересказывать её своими
     словами значит однажды пересказать неверно. */
  if (!r.ok || data["ok"] === false) {
    throw new Error(String(data["error"] || data["code"] || `HTTP ${r.status}`));
  }
  return data;
}

/** Строка правила из ответа. Форму не переписываем — проверяем, что она есть.
 *  Обломок (чужая версия, обрезанный ответ) выбрасывается молча: половина
 *  правила на экране опаснее его отсутствия, потому что выглядит правилом. */
function правило(v: unknown): RuleWithRun | null {
  if (!v || typeof v !== "object") return null;
  const o = v as Record<string, unknown>;
  const c = o["condition"] as Record<string, unknown> | undefined;
  if (typeof o["id"] !== "string" || !c) return null;
  if (typeof c["windowHours"] !== "number" || typeof c["value"] !== "number") return null;
  const run = (o["run"] && typeof o["run"] === "object" ? o["run"] : {}) as RuleRunContext;
  const { run: _, ...rule } = o;
  return { rule: rule as unknown as Rule, run };
}

export function readRules(data: Record<string, unknown>): RulesSnapshot {
  const list = Array.isArray(data["rules"]) ? data["rules"] : [];
  return {
    /* `!== false` было бы неверно: отсутствие поля здесь значит «старый
       демон», а старый демон воркера не имеет. Ошибка в эту сторону дешевле —
       лист скажет, что движка нет, там, где он есть, и человек это заметит
       сразу; обратная ошибка обещает работу, которой нет. */
    engineRunning: data["engineRunning"] === true,
    rules: list.map(правило).filter((x): x is RuleWithRun => x !== null),
  };
}

export function readLog(data: Record<string, unknown>): RuleLogEntry[] {
  const list = Array.isArray(data["actions"]) ? data["actions"] : [];
  return list.filter((v): v is RuleLogEntry => {
    if (!v || typeof v !== "object") return false;
    const o = v as Record<string, unknown>;
    return typeof o["id"] === "string" && typeof o["ruleId"] === "string"
      && typeof o["at"] === "string" && typeof o["value"] === "number";
  });
}

export const rulesApi = {
  list: async (): Promise<RulesSnapshot> => readRules(await зов(RULES_API.list)),
  log: async (limit = 50): Promise<RuleLogEntry[]> =>
    readLog(await зов(`${RULES_API.log}?limit=${limit}`)),
  /** Создать ИЛИ изменить: id необязателен, решает движок. Двух ручек нет
   *  намеренно — «создать» и «изменить» различались бы только наличием поля, а
   *  два пути к одному состоянию расходятся. */
  save: async (rule: Rule | Omit<Rule, "id">): Promise<Rule> =>
    (await зов(RULES_API.save, rule))["rule"] as Rule,
  toggle: async (id: string, enabled: boolean): Promise<void> => {
    await зов(RULES_API.toggle, { id, enabled });
  },
  /** ОТКАТ ЗАПИСИ ЖУРНАЛА. `logEntryId`, а не `ruleId`: перепутать легко, а
   *  цена — откат чужого действия. */
  undoLogEntry: async (logEntryId: string): Promise<void> => {
    await зов(RULES_API.undo, { id: logEntryId });
  },
};
