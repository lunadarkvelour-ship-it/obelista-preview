/* Хранилище правил: что оно умеет и, главное, чего в нём НЕТ.
 *
 * Владелец 15.08 сказал про удаление отдельно и жёстко: «УДАЛЯТЬ НИКОГДА —
 * ни кнопки, ни кода, ни на всякий случай». Первый тест файла проверяет
 * буквально это: в модуле не должно появиться ни одной функции, стирающей
 * правило. Формулировка «ни на всякий случай» тут ключевая — такие функции
 * пишут не по злому умыслу, а «пригодится», и находят их потом по потерянным
 * данным.
 */
import { describe, expect, it } from "vitest";
import * as store from "@/lib/rules-store";
import {
  RULES_STORAGE_KEY,
  addRule,
  loadRules,
  nextRuleId,
  replaceRule,
  saveRules,
  setRuleEnabled,
  stubRunContext,
  type RulesStorage,
} from "@/lib/rules-store";
import { ruleState, type Rule } from "@/lib/rules";

const ПРАВИЛО: Rule = {
  id: "r1",
  name: "ночной сторож",
  scope: "adset",
  targetId: "120210000000000000",
  targetName: "Rome_CPL",
  condition: { metric: "cpl", comparator: "gte", value: 12, windowHours: 24 },
  action: "pause",
  checkIntervalMin: 30,
  enabled: false,
};

/** Хранилище-пустышка вместо jsdom: окружение тестов панели — node. */
function память(seed?: string): RulesStorage & { data: Record<string, string> } {
  const data: Record<string, string> = seed ? { [RULES_STORAGE_KEY]: seed } : {};
  return {
    data,
    getItem: (k) => data[k] ?? null,
    setItem: (k, v) => {
      data[k] = v;
    },
  };
}

describe("удаления нет и не заводится", () => {
  it("в модуле нет ни одной функции со словом delete/remove/drop в имени", () => {
    const имена = Object.keys(store).filter((k) => /delete|remove|drop|purge|clear/i.test(k));
    expect(имена).toEqual([]);
  });

  it("выключение — единственный способ остановить правило, и оно ничего не стирает", () => {
    const список = [ПРАВИЛО, { ...ПРАВИЛО, id: "r2", enabled: true }];
    const после = setRuleEnabled(список, "r2", false);
    expect(после.length).toBe(2);
    expect(после[1].enabled).toBe(false);
    // Всё остальное правило осталось на месте — его можно прочитать и понять,
    // зачем оно когда-то было заведено.
    expect(после[1].condition).toEqual(ПРАВИЛО.condition);
  });
});

describe("список правил", () => {
  it("id выдаются подряд и без случайности", () => {
    expect(nextRuleId([])).toBe("r1");
    expect(nextRuleId([ПРАВИЛО])).toBe("r2");
    expect(nextRuleId([{ ...ПРАВИЛО, id: "r9" }, { ...ПРАВИЛО, id: "r3" }])).toBe("r10");
  });

  it("правка не включает выключенное правило незаметно", () => {
    /* Правка условия — это правка условия. Если бы `replaceRule` брал
       `enabled` из формы, человек, поправивший порог у выключенного правила,
       получил бы включённое. */
    const список = addRule([], ПРАВИЛО);
    const после = replaceRule(список, { ...ПРАВИЛО, condition: { ...ПРАВИЛО.condition, value: 20 }, enabled: false });
    expect(после[0].condition.value).toBe(20);
    expect(после[0].enabled).toBe(false);
  });
});

describe("чтение и запись", () => {
  it("круг: записали — прочитали то же самое", () => {
    const s = память();
    saveRules([ПРАВИЛО], s);
    expect(loadRules(s)).toEqual([ПРАВИЛО]);
  });

  it("пустое хранилище — пустой список, а не падение", () => {
    expect(loadRules(память())).toEqual([]);
    expect(loadRules(null)).toEqual([]);
  });

  it("мусор в ключе не роняет лист", () => {
    /* Обрезанный JSON, чужая версия, правка руками в devtools. Белый экран
       из-за этого — худший исход: правила потеряны И посмотреть нельзя. */
    expect(loadRules(память("не json"))).toEqual([]);
    expect(loadRules(память('{"rules":[]}'))).toEqual([]);
    expect(loadRules(память('[{"id":"r1"}]'))).toEqual([]);
  });

  it("строка с неизвестным действием выбрасывается, а не показывается", () => {
    const кривое = JSON.stringify([{ ...ПРАВИЛО, action: "delete" }, ПРАВИЛО]);
    expect(loadRules(память(кривое))).toEqual([ПРАВИЛО]);
  });
});

describe("контекст без движка", () => {
  it("сегодня движка нет ни у одного правила — и это состояние no_engine", () => {
    const ctx = stubRunContext();
    expect(ctx.engineRunning).toBe(false);
    expect(ruleState({ ...ПРАВИЛО, enabled: true }, ctx)).toBe("no_engine");
  });

  it("выключенное правило остаётся выключенным, а не «сломанным»", () => {
    expect(ruleState(ПРАВИЛО, stubRunContext())).toBe("off");
  });
});

describe("плашка про хранилище", () => {
  it("говорит и про браузер, и про то, что сработать нечему", () => {
    expect(store.STORAGE_NOTE).toContain("this browser only");
    expect(store.STORAGE_NOTE.toLowerCase()).toContain("no server");
  });
});
