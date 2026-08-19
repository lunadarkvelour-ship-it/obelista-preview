/* Журнал авто-действий и откат (#141/#25).
 *
 * Владелец назвал требование прямо: правило потушило — человек видит ЧТО,
 * КОГДА и ПО КАКОЙ ЦИФРЕ и возвращает обратно одним нажатием, не разбираясь в
 * Ads Manager. Проверяем то, чем такой журнал врёт незаметно:
 *
 *  1. Кнопка, нажатая и сразу нарисовавшая «возвращено». Мета отвечает не
 *     мгновенно и не всегда согласием: объект остался бы потушенным, а экран
 *     говорил бы обратное.
 *  2. Повторный откат одной записи. Два запроса на один объект — две записи в
 *     Мете и рассинхрон, который потом никто не разберёт.
 *  3. Строка без одной из трёх частей. «Потушено в 3:40» не объясняет почему,
 *     «CPL был 7.10» не говорит, что сделали.
 */
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { RuleCard } from "@/components/views/RulesView";
import {
  canRevert, logLine, revertLabel, revertState, showRevert, sortLog, type RuleLogEntry,
} from "@/lib/rules-log";
import type { Rule } from "@/lib/rules";

const ЗАПИСЬ: RuleLogEntry = {
  id: "l1", ruleId: "r1", at: "2026-08-15T03:40:00Z",
  action: "pause", targetId: "120210000000", metric: "cpl", value: 7.1,
};

const ПРАВИЛО = { id: "r1", name: "Rome_CPL" } as Rule;

describe("строка журнала несёт три части сразу", () => {
  it("что сделано, по какой цифре и каким правилом", () => {
    const l = logLine(ЗАПИСЬ, ПРАВИЛО);
    expect(l.what).toContain("120210000000");
    expect(l.why).toContain("7.1");
    expect(l.by).toBe("Rome_CPL");
  });

  it("правило неизвестно — показываем id, а не выдуманное имя", () => {
    /* Правило могли переписать или выключить, а запись осталась: она про
       прошлое. Выдумать имя здесь значит подписать чужим действие. */
    expect(logLine(ЗАПИСЬ).by).toBe("r1");
  });

  it("действие называется своим словом, а не общим «сработало»", () => {
    expect(logLine({ ...ЗАПИСЬ, action: "resume" }, ПРАВИЛО).what)
      .not.toBe(logLine(ЗАПИСЬ, ПРАВИЛО).what);
  });
});

describe("откат: отправлено и сделано — разные факты", () => {
  it("свежая запись откатывается", () => {
    expect(revertState(ЗАПИСЬ)).toBe("idle");
    expect(canRevert(ЗАПИСЬ)).toBe(true);
  });

  it("отправлено — состояние «sending», и повторно НЕ нажимается", () => {
    /* Главная ловушка файла. Кнопка, оставшаяся нажимаемой, даёт второй запрос
       на тот же объект. */
    const e = { ...ЗАПИСЬ, undoPending: true };
    expect(revertState(e)).toBe("sending");
    expect(canRevert(e)).toBe(false);
  });

  it("подтверждено сервером — «done», и предлагать больше нечего", () => {
    const e = { ...ЗАПИСЬ, undoneAt: "2026-08-15T04:00:00Z" };
    expect(revertState(e)).toBe("done");
    expect(canRevert(e)).toBe(false);
  });

  it("подтверждение сильнее отправки: конфликт не читается как незавершённость", () => {
    /* Устаревший `revertPending` рядом со свежим `revertedAt` не должен
       превращать сделанное в «отправляем» — тот же приём, что у `confirming`
       в `ruleState`. */
    expect(revertState({ ...ЗАПИСЬ, undoPending: true, undoneAt: "2026-08-15T04:00:00Z" }))
      .toBe("done");
  });

  it("отказ Меты — «failed», и попробовать можно снова", () => {
    const e = { ...ЗАПИСЬ, undoError: "Object is already active" };
    expect(revertState(e)).toBe("failed");
    expect(canRevert(e)).toBe(true);
  });
});

describe("кнопка называет то, что СДЕЛАЕТ", () => {
  it("правило потушило — кнопка включает; правило включило — тушит", () => {
    /* «Revert» на обоих читается одинаково и не говорит, что произойдёт. */
    /* ИСПРАВЛЕНО ПО СЛОВУ ДВИЖКА: слово берётся из ПРЕЖНЕГО СТАТУСА объекта, а
       не из действия правила. Объект мог лежать на паузе И ДО НАС — человек
       поставил сам, правило сработало следом; «Turn back on» там было бы не
       откатом, а чужим решением за человека, принятым нашей кнопкой. */
    expect(revertLabel("idle", "ACTIVE")).toMatch(/on/i);
    expect(revertLabel("idle", "PAUSED")).toMatch(/pause/i);
  });

  it("у всех четырёх состояний своя подпись", () => {
    const все = (["idle", "sending", "done", "failed"] as const)
      .map((s) => revertLabel(s, "ACTIVE"));
    expect(new Set(все).size).toBe(4);
  });
});

describe("порядок журнала — часть смысла", () => {
  it("свежее сверху, и порядок не зависит от ответа сервера", () => {
    const л = sortLog([
      { ...ЗАПИСЬ, id: "l1", at: "2026-08-15T01:00:00Z" },
      { ...ЗАПИСЬ, id: "l2", at: "2026-08-15T05:00:00Z" },
      { ...ЗАПИСЬ, id: "l3", at: "2026-08-15T03:00:00Z" },
    ]);
    expect(л.map((e) => e.id)).toEqual(["l2", "l3", "l1"]);
  });

  it("два действия одной секунды не меняются местами между перерисовками", () => {
    const пара = [{ ...ЗАПИСЬ, id: "a" }, { ...ЗАПИСЬ, id: "b" }];
    expect(sortLog(пара).map((e) => e.id)).toEqual(sortLog([...pairReversed(пара)]).map((e) => e.id));
  });
});

function pairReversed(l: readonly RuleLogEntry[]): RuleLogEntry[] {
  return [...l].reverse();
}

describe("форма записи объявлена в ОДНОМ месте", () => {
  it("хранилище про журнал больше не знает", () => {
    /* Тип, объявленный в двух файлах, — это два контракта под одним именем, и
       разъезжаются они молча. Раньше `RuleLogEntry` лежал ещё и в
       `rules-store`.

       Проверяем ИСХОДНИКОМ, а не импортом: интерфейс до рантайма не доживает,
       и `Object.keys(модуль)` не содержал бы его никогда — такая проверка была
       бы зелёной при любой копии, то есть не проверкой. */
    const src = readFileSync(
      path.resolve(__dirname, "..", "rules-store.ts"), "utf8");
    expect(src).not.toMatch(/interface\s+RuleLogEntry/);
    /* Отрицательный контроль: файл, где тип ЖИВЁТ, проверку проходить не
       должен — иначе она ничего не ищет. */
    expect(readFileSync(path.resolve(__dirname, "..", "rules-log.ts"), "utf8"))
      .toMatch(/interface\s+RuleLogEntry/);
  });
});

/* --- Контекст доехал до карточки ------------------------------------------ */

/* Три поля `RuleRunContext` панель обязана показать и НЕ МОЖЕТ вывести сама:
   когда проверяли, когда проверят снова и что намерили. Расписание и замер
   знает только воркер. Модель их не рисует, а ошибка живёт в разметке — ровно
   как с вердиктом о сборе, который был написан и стоял не везде. */
describe("строка правила показывает то, что знает только воркер", () => {
  const ПРАВИЛО2 = {
    id: "r1", name: "Rome_CPL", scope: "adset", targetId: "120210000000",
    condition: { metric: "cpl", comparator: "gt", value: 5, windowHours: 24 },
    action: "pause", checkIntervalMin: 60, enabled: true,
  } as unknown as Rule;

  const карточка = (ctx: Record<string, unknown>) =>
    renderToStaticMarkup(
      createElement(RuleCard, { rule: ПРАВИЛО2, ctx: ctx as never }),
    );

  it("когда проверят снова — из ответа, а не из интервала правила", () => {
    /* Интервал правила это НАМЕРЕНИЕ, расписание знает воркер. Посчитать
       «сейчас плюс 60 минут» значило бы нарисовать обещание. */
    const html = карточка({
      engineRunning: true, runnable: true,
      lastCheckedAt: "2026-08-15T03:00:00Z", nextCheckAt: "2026-08-15T04:00:00Z",
    });
    expect(html).toContain("next check");
    expect(html).toContain("2026-08-15T04:00:00Z");
  });

  it("воркер про следующую проверку не сказал — прочерк, а не выдумка", () => {
    const html = карточка({ engineRunning: true, runnable: true,
                            lastCheckedAt: "2026-08-15T03:00:00Z" });
    expect(html).toContain("next check");
    expect(html).not.toContain("2026-08-15T04:00");
  });

  it("что намерили — числом рядом с временем проверки", () => {
    /* Без замера «проверено» пустое слово: правило, которое вот-вот сработает,
       выглядит так же, как то, что и близко не подошло. */
    expect(карточка({ engineRunning: true, runnable: true,
                      lastCheckedAt: "2026-08-15T03:00:00Z", lastValue: 3.2 }))
      .toContain("3.2");
  });

  it("замера нет — ничего не подставляем", () => {
    expect(карточка({ engineRunning: true, runnable: true,
                      lastCheckedAt: "2026-08-15T03:00:00Z" }))
      .not.toMatch(/· CPL \d/);
  });
});

describe("откат возвращает ПРЕЖНИЙ статус, а не «включает»", () => {
  /* Требование движка, которого никто не просил, и оно важнее остальных: объект
     мог лежать на паузе И ДО НАС — человек поставил сам, правило сработало
     следом. «Включить» в таком случае не откат, а чужое решение за человека. */

  it("объект был включён — кнопка включает", () => {
    expect(revertLabel("idle", "ACTIVE")).toMatch(/on/i);
  });

  it("объект и до нас был на паузе — кнопка ТУШИТ, хотя правило тушило", () => {
    /* Тот самый случай. Действие правила тут ничего не решает. */
    expect(revertLabel("idle", "PAUSED")).toMatch(/pause/i);
  });

  it("прежний статус неизвестен — кнопки НЕТ ВОВСЕ, а не погашенная", () => {
    /* Погашенная кнопка обещает, что действие существует и когда-нибудь станет
       доступным. При неизвестном прежнем статусе его не существует: вернуть
       вслепую хуже, чем не вернуть. */
    const e = { ...ЗАПИСЬ, canUndo: false };
    expect(showRevert(e)).toBe(false);
    expect(canRevert(e)).toBe(false);
  });

  it("можно ли откатить — решает СЕРВЕР, панель не выводит это сама", () => {
    /* Чтобы вернуть объект, надо знать, каким он был до нас. Знает это движок;
       вывод «раз не откачено, значит можно» был бы догадкой о чужом знании. */
    expect(canRevert({ ...ЗАПИСЬ, canUndo: true })).toBe(true);
    expect(canRevert({ ...ЗАПИСЬ, canUndo: false, undoError: "boom" })).toBe(false);
  });
});
