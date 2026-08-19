import { describe, expect, it } from "vitest";
import {
  BY_KEY,
  COLUMNS,
  DEFAULT_VISIBLE,
  moveColumn,
  withColumn,
  type ColKey,
} from "@/lib/analytics-columns";
import { FUNNEL_DERIVED, FUNNEL_METRICS } from "@/lib/funnel-metrics";

/* Порядок колонок принадлежит юзеру: он тянет их за шапку. Всё, что здесь
   проверяется, — что этот порядок не пересобирается за его спиной. */

describe("moveColumn", () => {
  it("переносит колонку на указанное место, остальные сдвигая", () => {
    const was: ColKey[] = ["spend", "cpftd", "cpsub", "ftd"];
    expect(moveColumn(was, "spend", 3)).toEqual(["cpftd", "cpsub", "ftd", "spend"]);
    expect(moveColumn(was, "ftd", 0)).toEqual(["ftd", "spend", "cpftd", "cpsub"]);
  });

  it("не трогает исходный массив", () => {
    const was: ColKey[] = ["spend", "cpftd", "cpsub"];
    moveColumn(was, "spend", 2);
    expect(was).toEqual(["spend", "cpftd", "cpsub"]);
  });

  it("молча возвращает как было, если двигать некуда", () => {
    const was: ColKey[] = ["spend", "cpftd"];
    expect(moveColumn(was, "spend", 0)).toBe(was);      // уже там
    expect(moveColumn(was, "ftd", 1)).toBe(was);        // такой колонки нет
    expect(moveColumn(was, "spend", 9)).toBe(was);      // за пределами
    expect(moveColumn(was, "spend", -1)).toBe(was);
  });
});

describe("withColumn", () => {
  it("вставляет по месту в каталоге относительно уже показанных", () => {
    // cprd в каталоге стоит между cpftd и cpsub
    const was: ColKey[] = ["spend", "cpftd", "cpsub", "ftd"];
    expect(withColumn(was, "cprd")).toEqual(["spend", "cpftd", "cprd", "cpsub", "ftd"]);
  });

  it("дописывает в конец, если новая колонка последняя по каталогу", () => {
    const was: ColKey[] = ["spend", "cpftd"];
    expect(withColumn(was, "geos")).toEqual(["spend", "cpftd", "geos"]);
  });

  it("СОХРАНЯЕТ ручную перестановку: взаимный порядок показанных не меняется", () => {
    // юзер утащил spend в конец — включение новой колонки не имеет права это отменить
    const переставлено: ColKey[] = ["cpftd", "cpsub", "ftd", "spend"];
    const после = withColumn(переставлено, "cprd");
    expect(после.filter((k) => переставлено.includes(k))).toEqual(переставлено);
    expect(после).toContain("cprd");
  });

  it("повторное включение ничего не меняет", () => {
    const was: ColKey[] = ["spend", "cpftd"];
    expect(withColumn(was, "spend")).toBe(was);
  });

  it("не трогает исходный массив", () => {
    const was: ColKey[] = ["spend", "ftd"];
    withColumn(was, "cpftd");
    expect(was).toEqual(["spend", "ftd"]);
  });
});

describe("каталог", () => {
  it("ключи не повторяются — иначе колонка нарисуется дважды", () => {
    const keys = COLUMNS.map((c) => c.key);
    expect(new Set(keys).size).toBe(keys.length);
  });

  it("всё, что видно из коробки, есть в каталоге", () => {
    const keys = new Set(COLUMNS.map((c) => c.key));
    for (const k of DEFAULT_VISIBLE) expect(keys.has(k)).toBe(true);
  });
});

/* ── каталог колонок СОБИРАЕТСЯ из общего каталога воронки ────────────────
 *
 * Подписи ступеней и производных живут теперь в `lib/funnel-metrics` — одном
 * месте на «Аналитику» и «Кампании». Проверки ниже стоят затем, что переезд
 * подписи легко сделать «почти правильно»: колонка останется на месте, а
 * расшифровка тихо станет чужой, и заметить это на экране некому. */
describe("каталог колонок читает общий каталог воронки", () => {
  it("каждая колонка воронки дословно повторяет каталожную запись", () => {
    for (const m of FUNNEL_METRICS.filter((x) => x.leaderboard)) {
      const c = BY_KEY[m.id as ColKey];
      expect(c, `ступень ${m.id} пропала из колонок`).toBeTruthy();
      expect(c.title).toBe(m.title);
      expect(c.hint).toBe(m.hint);
      expect(c.group).toBe("воронка");
    }
  });

  it("каждая цена и конверсия дословно повторяет запись производной", () => {
    for (const d of FUNNEL_DERIVED) {
      const c = BY_KEY[d.id];
      expect(c, `производная ${d.id} пропала из колонок`).toBeTruthy();
      expect(c.title).toBe(d.title);
      expect(c.hint).toBe(d.hint);
      expect(c.kind).toBe(d.kind);
    }
  });

  it("колонки без подписи-расшифровки её и не получили", () => {
    /* `hint` у конверсий нет намеренно: «Sub→FTD» объясняет себя сам. Пустая
       строка вместо отсутствия поля выглядела бы на экране как пустая
       подсказка под курсором. */
    for (const k of ["sub_to_ftd", "sub_to_rd", "sub_to_checkout", "sub_to_contact"] as ColKey[]) {
      expect(BY_KEY[k].hint).toBeUndefined();
    }
  });
});
