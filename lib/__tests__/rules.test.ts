import { describe, expect, it } from "vitest";
import {
  RULE_ACTIONS,
  RULE_BUCKETS,
  RULE_BUCKET_HINT,
  RULE_BUCKET_LABEL,
  RULE_METRICS,
  RULE_METRIC_LABEL,
  RULE_SCOPES,
  RULE_SCOPE_LABEL,
  RULE_STATES,
  canEnable,
  ruleBucket,
  describeCondition,
  failureReasonText,
  formatCheckInterval,
  isRuleAction,
  ruleState,
  ruleStateDescription,
  ruleStateLabel,
  ruleStateTone,
  unrunnableReasonText,
  type Rule,
  type RuleAction,
  type RuleRunContext,
} from "@/lib/rules";

/* Модель состояний автоправил — чистовая часть иссуса #25/#35, хотя
 * серверного воркера ещё нет вообще (он стартует после #22). Владелец сказал
 * дословно: «фронт для вида можно, статусы состояния сразу чистовые» — и
 * главный факт, который эта модель обязана держать правдой с первого
 * коммита, взят из живого замера #9 (коммит 7a0e2597): чтение у Меты
 * отстаёт от записи, первое чтение сразу после PAUSED вернуло ACTIVE, верный
 * статус пришёл со второго примерно через две секунды. Правило, которое
 * прочитает этот момент как «не сработало», полезет тушить второй раз без
 * причины — отсюда состояние `confirming`, и главный тест файла проверяет
 * именно то, что оно НИКОГДА не превращается в `failed`.
 */

const БАЗОВОЕ: Rule = {
  id: "r1",
  name: "kill CPL",
  scope: "account",
  targetId: "act_1",
  condition: { metric: "cpl", comparator: "gte", value: 40, windowHours: 24 },
  action: "pause",
  checkIntervalMin: 15,
  enabled: true,
};

/** Контекст «всё хорошо, но сегодня так у всех»: движка нет, цель годная,
 *  ничего ещё не произошло — дефолт, из которого тесты меняют по одному полю. */
const ДВИЖКА_НЕТ: RuleRunContext = { engineRunning: false, runnable: true };
const ДВИЖОК_ЖИВ: RuleRunContext = { engineRunning: true, runnable: true };

describe("действие правила — ровно pause и resume (владелец, 15.08)", () => {
  /* До 15.08 здесь стоял один `pause` и тест, запрещавший `resume` типом:
     спека §7 не пускала «включение». Владелец развернул это дословно:
     «гибкие условия тушения И ВКЛЮЧЕНИЯ, на все три уровня. Только pause и
     resume». Тест переписан по факту решения, а не подогнан: запрет остался,
     но теперь он про то, что действительно запрещено — удаление и деньги. */
  it("RULE_ACTIONS содержит ровно два варианта", () => {
    expect(RULE_ACTIONS).toEqual(["pause", "resume"]);
  });

  it("рантайм-страж принимает оба и не принимает ничего сверх", () => {
    expect(isRuleAction("pause")).toBe(true);
    expect(isRuleAction("resume")).toBe(true);
    for (const v of ["delete", "remove", "archive", "raise_budget", "create", "", null, undefined, 1]) {
      expect(isRuleAction(v)).toBe(false);
    }
  });

  it("на уровне типа: третьего действия не существует — ни удаления, ни бюджета", () => {
    /* Настоящая проверка происходит не в vitest (типы стираются при
       трансформации), а при `npx tsc --noEmit`: строки ниже обязаны
       остаться ошибками компиляции. Если однажды RuleAction случайно
       расширят, `@ts-expect-error` станет ненужным, и tsc сам укажет на
       строку directive-ом "unused '@ts-expect-error'".

       Удаление здесь — не гипотеза, а прямое требование владельца:
       «УДАЛЯТЬ НИКОГДА — ни кнопки, ни кода, ни на всякий случай». */
    // @ts-expect-error — удаления не существует как действия правила
    const удаление: RuleAction = "delete";
    // @ts-expect-error — разгон бюджета вне контракта (спека §7)
    const бюджет: RuleAction = "raise_budget";
    expect(String(удаление)).toBe("delete");
    expect(String(бюджет)).toBe("raise_budget");
  });

  it("подпись сработавшего правила зависит от действия — «Resumed», а не «Paused»", () => {
    /* Подпись «Paused» на правиле, которое объект РАЗЖИГАЕТ, читается ровно
       наоборот смыслу, а состояние в списке человек читает первым. */
    expect(ruleStateLabel("fired", "pause")).toBe("Paused");
    expect(ruleStateLabel("fired", "resume")).toBe("Resumed");
    expect(ruleStateLabel("failed", "resume")).toBe("Resume failed");
    // Без второго параметра — прежнее поведение, глоссарий и старые вызовы
    // не меняются.
    expect(ruleStateLabel("fired")).toBe("Paused");
  });
});

describe("пять корзин — то, что человек читает списком", () => {
  it("каждое из восьми состояний попадает ровно в одну корзину", () => {
    for (const s of RULE_STATES) {
      expect(RULE_BUCKETS).toContain(ruleBucket(s));
    }
  });

  it("сломанное не прячется в «работает» и не выдаётся за «выключено»", () => {
    /* Главный тест корзин. `no_engine`, `unrunnable` и `failed` — это
       правила, по которым человеку есть что сделать руками; попав в
       «работает», они соврали бы, а попав в «выключено» — сняли бы с себя
       вопрос, которого никто не задавал. */
    expect(ruleBucket("no_engine")).toBe("attention");
    expect(ruleBucket("unrunnable")).toBe("attention");
    expect(ruleBucket("failed")).toBe("attention");
    expect(ruleBucket("off")).toBe("off");
    expect(ruleBucket("ok")).toBe("working");
    expect(ruleBucket("waiting")).toBe("waiting");
  });

  it("confirming лежит с fired: для человека объект уже тронут", () => {
    expect(ruleBucket("fired")).toBe("fired");
    expect(ruleBucket("confirming")).toBe("fired");
  });

  it("у каждой корзины есть подпись и однострочное объяснение", () => {
    for (const b of RULE_BUCKETS) {
      expect(RULE_BUCKET_LABEL[b]).toBeTruthy();
      expect(RULE_BUCKET_HINT[b].length).toBeGreaterThan(10);
    }
  });
});

describe("ruleState — приоритет состояний", () => {
  it("off перебивает всё остальное, включая confirming и unrunnable разом", () => {
    const выкл: Rule = { ...БАЗОВОЕ, enabled: false };
    const шумныйКонтекст: RuleRunContext = {
      engineRunning: true,
      runnable: false,
      pausePending: true,
      failureReason: "Meta: permission denied",
      lastFired: { at: "2026-08-13T10:00:00Z", metric: "cpl", value: 55 },
    };
    expect(ruleState(выкл, шумныйКонтекст)).toBe("off");
  });

  it("выключенное правило не читается как ошибка", () => {
    expect(ruleStateTone("off")).toBe("muted");
    expect(ruleStateTone("off")).not.toBe("error");
  });

  it("unrunnable перебивает waiting: правило без живого токена не «ждёт», оно не может", () => {
    const ctx: RuleRunContext = { engineRunning: true, runnable: false };
    expect(ruleState(БАЗОВОЕ, ctx)).toBe("unrunnable");
  });

  it("unrunnable перебивает и no_engine — иначе его нельзя увидеть СЕГОДНЯ, пока движка нет ни у кого", () => {
    const ctx: RuleRunContext = { engineRunning: false, runnable: false };
    expect(ruleState(БАЗОВОЕ, ctx)).toBe("unrunnable");
  });

  it("пока движка нет, включённое годное правило — no_engine, а не waiting", () => {
    expect(ruleState(БАЗОВОЕ, ДВИЖКА_НЕТ)).toBe("no_engine");
  });

  it("no_engine побеждает даже если в прошлом уже была проверка — движок сейчас мёртв, и это главный факт", () => {
    const ctx: RuleRunContext = { ...ДВИЖКА_НЕТ, lastCheckedAt: "2026-08-10T09:00:00Z", lastValue: 12 };
    expect(ruleState(БАЗОВОЕ, ctx)).toBe("no_engine");
  });

  it("ГЛАВНЫЙ ТЕСТ ФАЙЛА: confirming не превращается в failed, даже когда контекст несёт оба сигнала разом", () => {
    const ctx: RuleRunContext = {
      ...ДВИЖОК_ЖИВ,
      pausePending: true,
      failureReason: "stale error from a previous cycle",
      lastFired: { at: "2026-08-12T00:00:00Z", metric: "cpl", value: 41 },
    };
    expect(ruleState(БАЗОВОЕ, ctx)).toBe("confirming");
  });

  it("confirming не читается как неудача ни тоном, ни подписью", () => {
    expect(ruleStateTone("confirming")).not.toBe("error");
    expect(ruleStateTone("confirming")).toBe("progress");
    expect(ruleStateLabel("confirming").toLowerCase()).not.toContain("fail");
  });

  it("failed показывается, только когда подтверждения не ждём", () => {
    const ctx: RuleRunContext = { ...ДВИЖОК_ЖИВ, failureReason: "Meta: ad account is disabled" };
    expect(ruleState(БАЗОВОЕ, ctx)).toBe("failed");
  });

  it("fired — потушено и подтверждено, ни pausePending, ни failureReason не мешают", () => {
    const ctx: RuleRunContext = {
      ...ДВИЖОК_ЖИВ,
      lastFired: { at: "2026-08-13T09:00:00Z", metric: "cpl", value: 44 },
    };
    expect(ruleState(БАЗОВОЕ, ctx)).toBe("fired");
  });

  it("ok — проверяли, условие не выполнено", () => {
    const ctx: RuleRunContext = { ...ДВИЖОК_ЖИВ, lastCheckedAt: "2026-08-13T09:00:00Z", lastValue: 12 };
    expect(ruleState(БАЗОВОЕ, ctx)).toBe("ok");
  });

  it("waiting — включено, годно, движок жив, проверок ещё не было", () => {
    expect(ruleState(БАЗОВОЕ, ДВИЖОК_ЖИВ)).toBe("waiting");
  });
});

describe("восемь состояний — набор, подписи, тон", () => {
  it("RULE_STATES — ровно восемь и ровно те, что в контракте", () => {
    expect(RULE_STATES).toEqual([
      "off", "no_engine", "waiting", "ok", "confirming", "fired", "failed", "unrunnable",
    ]);
  });

  it("у каждого состояния своя короткая подпись — восемь разных строк", () => {
    const подписи = RULE_STATES.map((s) => ruleStateLabel(s));
    expect(new Set(подписи).size).toBe(RULE_STATES.length);
    for (const l of подписи) expect(l.length).toBeGreaterThan(0);
  });

  it("у каждого состояния своё развёрнутое объяснение — восемь разных текстов", () => {
    const тексты = RULE_STATES.map((s) => ruleStateDescription(s));
    expect(new Set(тексты).size).toBe(RULE_STATES.length);
    for (const t of тексты) expect(t.length).toBeGreaterThan(20);
  });

  it("цвет состояния соответствует правилу владельца", () => {
    expect(ruleStateTone("off")).toBe("muted");
    expect(ruleStateTone("no_engine")).toBe("warning");
    expect(ruleStateTone("unrunnable")).toBe("warning");
    expect(ruleStateTone("failed")).toBe("error");
    expect(ruleStateTone("fired")).toBe("normal");
    expect(ruleStateTone("ok")).toBe("normal");
    // confirming уже проверен отдельно выше — это тон, который никому не
    // разрешено спутать с ошибкой.
  });
});

describe("canEnable — можно ли включить, а не «уже ли работает»", () => {
  it("годная цель — можно включить, даже если движка нет вообще", () => {
    expect(canEnable(БАЗОВОЕ, { engineRunning: false, runnable: true })).toBe(true);
  });

  it("негодная цель — нельзя включить, даже если движок жив", () => {
    expect(canEnable(БАЗОВОЕ, { engineRunning: true, runnable: false })).toBe(false);
  });
});

describe("причины словами, а не «ошибка»", () => {
  it("unrunnableReasonText отдаёт причину из контекста как есть", () => {
    const ctx: RuleRunContext = { engineRunning: true, runnable: false, unrunnableReason: "no OAuth token for act_9" };
    expect(unrunnableReasonText(ctx)).toBe("no OAuth token for act_9");
  });

  it("unrunnableReasonText — честный фолбэк, если контекст причину не принёс", () => {
    const text = unrunnableReasonText({ engineRunning: true, runnable: false });
    expect(text.toLowerCase()).not.toBe("error");
    expect(text.length).toBeGreaterThan(20);
  });

  it("failureReasonText отдаёт причину Меты как есть", () => {
    const ctx: RuleRunContext = { ...ДВИЖОК_ЖИВ, failureReason: "Meta: (#100) permission error" };
    expect(failureReasonText(ctx)).toBe("Meta: (#100) permission error");
  });

  it("failureReasonText — честный фолбэк, а не голое «ошибка»", () => {
    const text = failureReasonText(ДВИЖОК_ЖИВ);
    expect(text.toLowerCase()).not.toBe("error");
    expect(text.length).toBeGreaterThan(20);
  });
});

describe("описание условия и периода — то, чем лист объясняет контракт", () => {
  it("сумма в долларах, сравнение словами", () => {
    expect(describeCondition({ metric: "spend", comparator: "gte", value: 50, windowHours: 24 }))
      .toBe("spend at least $50 over 24h");
  });

  it("CPL тоже в долларах", () => {
    expect(describeCondition({ metric: "cpl", comparator: "gte", value: 40, windowHours: 24 }))
      .toBe("CPL at least $40 over 24h");
  });

  it("лиды — голое число, без знака доллара", () => {
    expect(describeCondition({ metric: "leads", comparator: "lte", value: 0, windowHours: 48 }))
      .toBe("leads at most 0 over 48h");
  });

  it("период проверки — минуты до часа словами, дальше в часах", () => {
    expect(formatCheckInterval(15)).toBe("every 15 min");
    expect(formatCheckInterval(60)).toBe("every 1h");
    expect(formatCheckInterval(90)).toBe("every 1.5h");
  });
});

describe("срез и метрика — покрытие меню, а не забытый вариант", () => {
  it("у каждого среза есть подпись", () => {
    for (const s of RULE_SCOPES) expect(RULE_SCOPE_LABEL[s]).toBeTruthy();
    expect(RULE_SCOPES).toEqual(["account", "campaign", "adset", "ad"]);
  });

  it("у каждой метрики есть подпись", () => {
    for (const m of RULE_METRICS) expect(RULE_METRIC_LABEL[m]).toBeTruthy();
    expect(RULE_METRICS).toEqual(["spend", "cpl", "leads"]);
  });
});
