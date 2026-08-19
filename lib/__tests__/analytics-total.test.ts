import { describe, it, expect } from "vitest";
import { totalCell, totalsOf } from "@/lib/analytics-total";
import { pct } from "@/lib/analytics";
import { FUNNEL_DERIVED, FUNNEL_METRICS } from "@/lib/funnel-metrics";
import type { ColKey } from "@/lib/analytics-columns";

/* Итог по столбцу нельзя считать усреднением столбца.
 *
 * Живой пример с экрана 11.08: одно крео дало 10 депов по $58.25, другое — 1 деп
 * за $291.42. Среднее их цен — $174.83, а на деле потрачено $873.92 на 11 депов,
 * то есть $79.45. Ошибка вдвое, и на такой цифре закрывают связки.
 */

const крео = (o: Partial<Parameters<typeof totalsOf>[0][number]>) => ({
  spend: 0, clicks: 0, sub: 0, contact: 0, checkout: 0,
  ftd: 0, rd: 0, ads: 0, ads_with_ftd: 0, geos: [], ...o,
});

describe("итоги по таблице", () => {
  it("количества складываются", () => {
    const t = totalsOf([
      крео({ spend: 100, sub: 1000, contact: 500, checkout: 50, ftd: 10, rd: 4 }),
      крео({ spend: 50, sub: 200, contact: 90, checkout: 9, ftd: 1, rd: 0 }),
    ]);
    expect([t.spend, t.sub, t.contact, t.checkout, t.ftd, t.rd]).toEqual([150, 1200, 590, 59, 11, 4]);
    expect(t.rows).toBe(2);
  });

  it("цена депа — из сумм, а не среднее цен", () => {
    const t = totalsOf([
      крео({ spend: 582.5, ftd: 10 }),   // $58.25 за деп
      крео({ spend: 291.42, ftd: 1 }),   // $291.42 за деп
    ]);
    // Среднее цен дало бы $174.83 — вдвое дороже правды ($873.92 / 11).
    expect(t.cpftd).toBeCloseTo(79.45, 2);
  });

  it("конверсия — из сумм, а не среднее процентов", () => {
    const t = totalsOf([
      крео({ sub: 1000, ftd: 5 }),   // 0.5%
      крео({ sub: 10, ftd: 5 }),     // 50%
    ]);
    // Среднее процентов дало бы 25.25%, хотя на 1010 подписок пришлось 10 депов.
    expect(t.sub_to_ftd).toBeCloseTo(0.0099, 4);
  });

  it("конверсия возвращается ДОЛЕЙ, как её ждёт форматтер", () => {
    /* Форматтер `pct` сам умножает на сто. Вернёшь отсюда проценты — получишь
       вторую сотню: на экране стояло 5670% там, где строки показывали 39–73%. */
    const t = totalsOf([крео({ sub: 200, contact: 110 })]);
    expect(t.sub_to_contact).toBeCloseTo(0.55, 4);
    expect(t.sub_to_contact! * 100).toBeCloseTo(55, 4);
  });

  it("нет знаменателя — нет числа, а не ноль", () => {
    /* Ноль в колонке цены читается как «бесплатно», и это худшая из подписей:
       она выглядит как результат, а означает отсутствие данных. */
    const t = totalsOf([крео({ spend: 300, ftd: 0, rd: 0, sub: 0 })]);
    expect(t.cpftd).toBeNull();
    expect(t.cprd).toBeNull();
    expect(t.cpsub).toBeNull();
    expect(t.sub_to_ftd).toBeNull();
  });

  it("пустая таблица не роняет и не выдумывает НОЛЬ", () => {
    /* Ноль здесь был бы утверждением «потратили нисколько», а складывать было
       нечего вовсе. Разница видна на живом листе: восемь строк «не собрано» и
       Total «0» под ними читается как «подписок нет» (#122). */
    const t = totalsOf([]);
    expect(t.spend).toBeNull();
    expect(t.cpftd).toBeNull();
    expect(t.rows).toBe(0);
  });

  it("пропуски в строках считаются нулями, а не ломают сумму", () => {
    const t = totalsOf([
      крео({ spend: 10, ftd: null as unknown as number }),
      крео({ spend: undefined as unknown as number, ftd: 2 }),
    ]);
    expect(t.spend).toBe(10);
    expect(t.ftd).toBe(2);
    expect(t.cpftd).toBeCloseTo(5, 5);
  });

  it("гео собираются списком, но итога у них нет", () => {
    const t = totalsOf([крео({ geos: ["BD", "DZ"] }), крео({ geos: ["BD", "EG"] })]);
    expect(t.geos).toEqual(["BD", "DZ", "EG"]);
    expect(totalCell(t, "geos")).toBeUndefined();
  });

  it("колонка достаётся по ключу — таблица и итог не разъедутся", () => {
    const t = totalsOf([крео({ spend: 100, sub: 400 })]);
    expect(totalCell(t, "spend")).toBe(100);
    expect(totalCell(t, "cpsub")).toBeCloseTo(0.25, 5);
  });
});

describe("точность процента на экране", () => {
  it("малые конверсии не схлопываются в одно число", () => {
    /* Конверсия в деп живёт около полупроцента, и один знак после запятой
       показывал 0.465% и 0.5% одинаково — две связки с разницей в восьмую
       часть результата выглядели равными. */
    // 43 депа на 9244 подписки — ровно тот случай, ради которого всё это.
    expect(pct(43 / 9244)).toBe("0.47%");
    expect(pct(0.005)).toBe("0.50%");
    expect(pct(0.0099)).toBe("0.99%");
    // Прежний один знак склеивал эти три в «0.5%».
    expect(new Set([pct(0.0046), pct(0.005), pct(0.0054)]).size).toBe(3);
  });

  it("средние — один знак, крупные — целое", () => {
    expect(pct(0.0579)).toBe("5.8%");
    expect(pct(0.5436)).toBe("54%");
    expect(pct(1)).toBe("100%");
  });

  it("ровный ноль без хвоста, пусто — прочерк", () => {
    // «0.00%» выглядит как измерение с точностью до сотой, а это просто ноль.
    expect(pct(0)).toBe("0%");
    expect(pct(null)).toBe("—");
  });
});

/* ── итог собирается по каталогу, а не по списку полей ────────────────────
 *
 * `totalsOf` больше не перечисляет ступени и производные вручную — он ходит по
 * `lib/funnel-metrics`. Значит и проверять надо каждую запись каталога: набор,
 * заведённый там завтра, обязан появиться в итоге сам, а не пропасть молча. */
describe("итог покрывает весь каталог воронки", () => {
  it("каждая ступень лидерборда складывается", () => {
    /* Значения задаются ПО КАТАЛОГУ, а не перечислением полей: ступень,
       заведённая там завтра, попадёт и в строку, и в ожидание — а если она не
       попадёт в сумму, проверка назовёт её по имени. */
    const строка = (шаг: number) => крео(Object.fromEntries(
      FUNNEL_METRICS.filter((m) => m.leaderboard).map((m, i) => [m.id, шаг + i]),
    ));
    const t = totalsOf([строка(1), строка(10)]);
    FUNNEL_METRICS.filter((m) => m.leaderboard).forEach((m, i) => {
      expect((t as unknown as Record<string, number | null>)[m.id], `${m.id} не сложилось`)
        .toBe((1 + i) + (10 + i));
    });
  });

  it("СУММА, КОТОРОЙ НЕ ИЗ ЧЕГО СЛОЖИТЬСЯ, — null по каждой ступени", () => {
    /* #122 дословно: восемь строк «не собрано», а Total под ними «0». Человек
       читает «0 подписок» и решает, что подписок нет. Их не ноль — их не знаем. */
    const пусто = totalsOf([
      крео({ sub: null, contact: null, checkout: null, ftd: null, rd: null }),
      крео({ sub: null, contact: null, checkout: null, ftd: null, rd: null }),
    ]);
    for (const m of FUNNEL_METRICS.filter((x) => x.leaderboard)) {
      expect((пусто as unknown as Record<string, number | null>)[m.id], `${m.id}`).toBeNull();
    }
  });

  it("КАЖДАЯ производная каталога есть в итоге и считается из сумм", () => {
    const t = totalsOf([
      крео({ spend: 100, clicks: 200, sub: 50, contact: 25, checkout: 10, ftd: 5, rd: 2 }),
    ]);
    for (const d of FUNNEL_DERIVED) {
      const v = (t as unknown as Record<string, number | null>)[d.id];
      expect(typeof v, `производная ${d.id} пропала из итога`).toBe("number");
      expect(v).toBe(
        (t as unknown as Record<string, number>)[d.numerator]
        / (t as unknown as Record<string, number>)[d.denominator],
      );
    }
  });

  it("производная с нулевым знаменателем — null, а не 0, по всему каталогу", () => {
    for (const d of FUNNEL_DERIVED) {
      const t = totalsOf([крео({ spend: 100, clicks: 200, [d.denominator]: 0 })]);
      expect((t as unknown as Record<string, number | null>)[d.id], `${d.id} при нуле`).toBeNull();
    }
  });

  it("totalCell отдаёт undefined ровно для гео и число для всего каталога", () => {
    const t = totalsOf([крео({ spend: 100, clicks: 10, sub: 50, ftd: 5, geos: ["BD"] })]);
    expect(totalCell(t, "geos")).toBeUndefined();
    for (const m of FUNNEL_METRICS.filter((x) => x.leaderboard)) {
      expect(totalCell(t, m.id as ColKey), m.id).not.toBeUndefined();
    }
    for (const d of FUNNEL_DERIVED) {
      expect(totalCell(t, d.id), d.id).not.toBeUndefined();
    }
  });
});
