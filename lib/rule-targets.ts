/**
 * Каталог объектов Меты для пикера автоправил — стык с `GET /rule_targets`.
 *
 * ЗАЧЕМ. До этого файла цель правила задавалась ДВУМЯ несвязанными полями:
 * человек вбивал номер из Ads Manager в «Meta id» и отдельно набирал любое имя
 * во фразе. Разъехаться им было нечем — их вообще ничто не связывало, — и
 * правило могло звать один объект, а называться именем другого. При 268
 * кабинетах это не неудобство, а неработоспособность.
 *
 * ПРЕДЕЛ СПИСКА СЧИТАЕТ СЕРВЕР, И СВОЕГО ЗДЕСЬ НЕТ. `truncated` приезжает из
 * ответа и берётся как есть. Посчитать его тут по длине массива значило бы
 * держать вторую копию предела: она совпадает ровно до первого вызова с другим
 * пределом, а потом молча врёт в удобную сторону — список урезан, признак
 * говорит «всё влезло», человек выбирает из половины парка и не знает об этом.
 * Ровно эта ошибка уже была на стороне движка и вылечена там же
 * (`core/rule_targets.py`, `ПРЕДЕЛ`).
 *
 * УРОВНИ НЕ ПЕРЕЧИСЛЯЮТСЯ ЗАНОВО: они берутся из `RuleScope` (`./rules`), а
 * движок отдаёт ровно те же четыре. Второй список означал бы, что новый
 * уровень надо не забыть дописать в двух местах — а забывают всегда во втором.
 */

import { API_BASE } from "./analytics";
import { NoHandle } from "./campaigns";
import { guardSession } from "./session";
import type { RuleScope } from "./rules";

/** Путь ручки одним именем: его же читает тест, сверяющий нас с демоном. */
export const RULE_TARGETS_PATH = "/rule_targets";

/** Строка каталога — ровно те поля, что кладёт `core/rule_targets.каталог()`. */
export interface RuleTarget {
  id: string;
  name: string | null;
  status: string | null;
  /** Кабинет, внутри которого лежит объект. У самого кабинета равен `id`. */
  act_id: string | null;
  level: RuleScope;
  /** Личный кабинет. Каталог их НЕ прячет — помечает, и решает человек. */
  personal?: boolean;
}

export interface RuleTargetsPage {
  rows: RuleTarget[];
  /** Показано не всё. Приходит от сервера, здесь не вычисляется. */
  truncated: boolean;
  limit: number;
}

/** Что человеку показать вместо имени, когда имени нет.
 *
 *  Не пустая строка и не выдуманное название: id — единственное, что мы про
 *  этот объект точно знаем, и по нему его можно найти в Ads Manager. */
export function targetLabel(t: RuleTarget): string {
  const name = (t.name || "").trim();
  return name || t.id;
}

/**
 * Спросить каталог. `level` обязателен — «объекты вообще» не бывают.
 *
 * `q` уезжает НА СЕРВЕР, а не фильтрует уже приехавшее. Отбор на нашей стороне
 * искал бы по тем строкам, что влезли в предел, то есть по началу алфавита:
 * человек набирал бы имя своей кампании и получал пусто при живой кампании.
 */
export async function fetchRuleTargets(params: {
  level: RuleScope;
  social?: string | null;
  actId?: string | null;
  q?: string | null;
  signal?: AbortSignal;
}): Promise<RuleTargetsPage> {
  const url = new URL(API_BASE + RULE_TARGETS_PATH);
  url.searchParams.set("level", params.level);
  if (params.social) url.searchParams.set("social", params.social);
  if (params.actId) url.searchParams.set("act_id", params.actId);
  if (params.q) url.searchParams.set("q", params.q);

  const r = await fetch(url.toString(), { cache: "no-store", credentials: "include", signal: params.signal });
  guardSession(r);
  const data = (await r.json().catch(() => ({}))) as Record<string, unknown>;
  const текст = String(data["error"] || "");
  /* Ручки нет на ЭТОМ деплое — отдельный ответ, а не «ошибка». Демон отвечает
     на незнакомый путь `400 {"ok": false, "error": "нет такого пути: …"}`, а не
     404 (проверено на живом проде 15.08). Отдай мы это как есть — пикер
     показал бы человеку нашу внутреннюю фразу по-русски в английском
     интерфейсе, и лечение выглядело бы как «повторить», хотя лечится оно
     выкатом демона. Класс общий с `campaigns.ts` намеренно: два класса на одно
     состояние разъезжаются в обработке. */
  if (r.status === 404 || текст.includes("нет такого пути")) {
    throw new NoHandle(RULE_TARGETS_PATH);
  }
  if (!r.ok || data["ok"] === false) {
    throw new Error(текст || `API ${r.status}`);
  }
  return {
    rows: Array.isArray(data["rows"]) ? (data["rows"] as RuleTarget[]) : [],
    truncated: data["truncated"] === true,
    limit: typeof data["limit"] === "number" ? (data["limit"] as number) : 0,
  };
}
