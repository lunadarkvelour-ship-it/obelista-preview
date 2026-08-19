/* Правило читается вслух как фраза — это требование владельца, и держит его
 * этот файл.
 *
 * Проверяется не «функция вернула строку», а три вещи, которые ломаются
 * молча и обнаруживаются только на живом заливе:
 *
 *  1. Фраза остаётся ФРАЗОЙ: порядок слов один, без склеек и двойных
 *     пробелов, и она отвечает на четыре вопроса в том порядке, в каком их
 *     задаёт человек — что сделаю, с чем, при каком условии, как часто.
 *  2. Незаполненное видно ДО сохранения: пустая цель и пустой порог — это
 *     `blocker`, и кнопка не нажимается. Правило, сохранённое с порогом
 *     «ноль по умолчанию», сработает на первой же проверке по всему парку.
 *  3. Блок «что произойдёт» говорит про откат, про второе чтение статуса и
 *     про то, что удаления не бывает. Это не украшение текста: ровно этих
 *     трёх обещаний требует иссус #25, и если строка исчезнет из продукта,
 *     тест обязан упасть, а не промолчать.
 */
import { describe, expect, it } from "vitest";
import {
  RULE_INTERVALS,
  RULE_WINDOWS,
  blankDraft,
  canSave,
  draftFromRule,
  draftIssues,
  draftSentence,
  outcomeLines,
  ruleFromDraft,
  ruleSentence,
  sentenceSegments,
  sentenceText,
  valueLabel,
  windowLabel,
  type RuleDraft,
} from "@/lib/rules-draft";
import type { Rule } from "@/lib/rules";

/** Заполненный черновик — тот самый пример, который стоит в пустом листе. */
const ГОТОВЫЙ: RuleDraft = {
  ...blankDraft("pause"),
  targetId: "120210000000000000",
  targetName: "Rome_CPL",
  metric: "cpl",
  comparator: "gte",
  value: 12,
  windowHours: 24,
  checkIntervalMin: 30,
};

describe("фраза правила", () => {
  it("читается вслух целиком и слово в слово", () => {
    expect(draftSentence(ГОТОВЫЙ)).toBe(
      "Pause the ad set “Rome_CPL” when its CPL over the last 24 hours is at least $12, checked every 30 min."
    );
  });

  it("правило на включение читается так же и в другую сторону", () => {
    const d: RuleDraft = { ...ГОТОВЫЙ, action: "resume", comparator: "lte", value: 8, scope: "campaign" };
    expect(draftSentence(d)).toBe(
      "Resume the campaign “Rome_CPL” when its CPL over the last 24 hours is at most $8, checked every 30 min."
    );
  });

  it("лиды — без знака доллара, деньги — с ним", () => {
    expect(valueLabel("leads", 0)).toBe("0");
    expect(valueLabel("spend", 50)).toBe("$50");
    expect(draftSentence({ ...ГОТОВЫЙ, metric: "leads", comparator: "lte", value: 0 })).toContain(
      "its leads over the last 24 hours is at most 0,"
    );
  });

  it("в фразе нет ни двойных пробелов, ни пробела перед запятой и точкой", () => {
    /* Куски склеиваются встык, и лишний пробел в одном из них портит именно
       то свойство, ради которого фраза существует, — читаемость вслух. */
    for (const d of [ГОТОВЫЙ, blankDraft("pause"), blankDraft("resume")]) {
      const s = draftSentence(d);
      expect(s).not.toMatch(/ {2}/);
      expect(s).not.toMatch(/ [,.]/);
      expect(s.endsWith(".")).toBe(true);
    }
  });

  it("слоты — ровно восемь решений, и ни одного скрытого", () => {
    const слоты = sentenceSegments(ГОТОВЫЙ).filter((s) => s.slot).map((s) => s.slot);
    expect(слоты).toEqual([
      "action", "scope", "target", "metric", "window", "comparator", "value", "interval",
    ]);
  });

  it("порядок слов один и тот же в конструкторе и в карточке правила", () => {
    /* Карточка рисует фразу через `draftFromRule`, конструктор — напрямую.
       Разъехавшись, они показали бы одному человеку два разных правила. */
    const rule = ruleFromDraft(ГОТОВЫЙ, "r1", true);
    expect(ruleSentence(rule)).toBe(draftSentence(ГОТОВЫЙ));
  });

  it("без имени цели фраза честно показывает id, а не выдуманное название", () => {
    const rule: Rule = { ...ruleFromDraft(ГОТОВЫЙ, "r1"), targetName: undefined };
    expect(ruleSentence(rule)).toContain("“120210000000000000”");
  });

  it("незаполненные места помечены и попадают в текст видимой заглушкой", () => {
    const пустой = blankDraft();
    const segs = sentenceSegments(пустой);
    const missing = segs.filter((s) => s.missing).map((s) => s.slot);
    expect(missing).toEqual(["target", "value"]);
    expect(sentenceText(segs)).toContain("(pick one)");
  });
});

describe("окна и периоды — короткие списки, а не сорок пунктов", () => {
  it("окно словами, множественное число не ломается", () => {
    expect(windowLabel(1)).toBe("the last hour");
    expect(windowLabel(6)).toBe("the last 6 hours");
    expect(windowLabel(24)).toBe("the last 24 hours");
    expect(windowLabel(48)).toBe("the last 2 days");
    expect(windowLabel(168)).toBe("the last 7 days");
  });

  it("у каждого варианта из списков есть человеческая подпись", () => {
    for (const h of RULE_WINDOWS) expect(windowLabel(h)).toMatch(/^the last /);
    expect(RULE_INTERVALS.length).toBeGreaterThan(2);
  });
});

describe("проверки до сохранения", () => {
  it("новый черновик сохранить нельзя: цель и порог не заданы", () => {
    const пустой = blankDraft();
    const виды = draftIssues(пустой).map((i) => i.kind);
    expect(виды.filter((k) => k === "blocker").length).toBe(2);
    expect(canSave(пустой)).toBe(false);
  });

  it("заполненный сохранить можно", () => {
    expect(draftIssues(ГОТОВЫЙ)).toEqual([]);
    expect(canSave(ГОТОВЫЙ)).toBe(true);
  });

  it("порог, верный всегда, — предупреждение, а не тишина", () => {
    /* «spend at least $0» верно для любого объекта: правило потушило бы всё,
       на что наведено, на первой же проверке. Сохранить не запрещаем — это
       законная конструкция, — но человек обязан прочитать, чем она кончится. */
    const d: RuleDraft = { ...ГОТОВЫЙ, metric: "spend", comparator: "gte", value: 0 };
    const w = draftIssues(d).filter((i) => i.kind === "warning");
    expect(w.length).toBe(1);
    expect(w[0].text).toContain("first check");
    expect(canSave(d)).toBe(true);
  });

  it("«нет лидов — туши» предупреждением НЕ считается", () => {
    /* Самое осмысленное правило на свете, и ругаться на него значило бы
       приучить человека пролистывать предупреждения не читая. */
    const d: RuleDraft = { ...ГОТОВЫЙ, metric: "leads", comparator: "lte", value: 0 };
    expect(draftIssues(d)).toEqual([]);
  });

  it("проверка реже, чем окно, — предупреждение: правило перешагивает своё окно", () => {
    const d: RuleDraft = { ...ГОТОВЫЙ, windowHours: 1, checkIntervalMin: 1440 };
    const w = draftIssues(d).filter((i) => i.kind === "warning");
    expect(w.length).toBe(1);
    expect(w[0].text).toContain("step over");
  });

  it("отрицательный порог — блокер: его невозможно пересечь", () => {
    const d: RuleDraft = { ...ГОТОВЫЙ, value: -5 };
    expect(canSave(d)).toBe(false);
  });
});

describe("«что произойдёт» — до сохранения, а не после срабатывания", () => {
  const строки = outcomeLines(ГОТОВЫЙ).join(" ");

  it("говорит исход последствием, а не командой", () => {
    expect(строки).toContain("stops spending");
    expect(строки).toContain("Rome_CPL");
  });

  it("обещает повторное чтение статуса — замер #9, чтение отстаёт от записи", () => {
    expect(строки).toContain("re-reads the status");
  });

  it("обещает журнал и откат одним нажатием (иссус #25, критерий 3)", () => {
    expect(строки).toContain("logged");
    expect(строки).toContain("one press undoes it");
  });

  it("говорит вслух, что удаления не бывает", () => {
    expect(строки).toContain("never deletes anything");
    expect(строки).toContain("never changes a budget");
  });

  it("у правила на включение исход другой", () => {
    expect(outcomeLines({ ...ГОТОВЫЙ, action: "resume" }).join(" ")).toContain(
      "starts spending again"
    );
  });
});

describe("черновик ↔ правило", () => {
  it("новое правило сохраняется выключенным (спека §7)", () => {
    expect(ruleFromDraft(ГОТОВЫЙ, "r1").enabled).toBe(false);
  });

  it("без своего имени именем правила становится сама фраза", () => {
    expect(ruleFromDraft(ГОТОВЫЙ, "r1").name).toBe(draftSentence(ГОТОВЫЙ));
  });

  it("правка не теряет ни одного решения — круг черновик → правило → черновик", () => {
    const rule = ruleFromDraft({ ...ГОТОВЫЙ, name: "ночной сторож" }, "r7", true);
    expect(draftFromRule(rule)).toEqual({ ...ГОТОВЫЙ, name: "ночной сторож" });
  });
});
