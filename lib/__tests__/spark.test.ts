import { describe, expect, it } from "vitest";
import { makeSpark, sparkCeiling, VB_H, VB_W, type SparkPoint } from "@/lib/spark";

/* Спарклайн подневного спенда. Проверяется не геометрия ради геометрии, а то,
   ради чего на него смотрят: форма ряда должна быть ЧЕСТНОЙ. Картинка стоит
   без подписей по осям — соврать ею проще, чем цифрой, и заметить вранье
   некому. */

/** Ряд подряд идущих дней от 2026-08-01. */
function ряд(spends: number[], step = 1): SparkPoint[] {
  return spends.map((spend, i) => {
    const d = new Date(Date.UTC(2026, 7, 1 + i * step));
    return { date: d.toISOString().slice(0, 10), spend };
  });
}

/** Точки линии обратно в числа: [x, y]. */
function точки(line: string): Array<[number, number]> {
  return line.split(" ").map((p) => {
    const [x, y] = p.split(",").map(Number);
    return [x, y];
  });
}

describe("рисовать нечего — и не рисуем", () => {
  it("ряда нет вовсе (старый демон или непривязанная воронка)", () => {
    expect(makeSpark(undefined, undefined, "2026-08-09")).toBeNull();
    expect(makeSpark(null, 1, "2026-08-09")).toBeNull();
    expect(makeSpark([], 1, "2026-08-09")).toBeNull();
  });

  it("один день — не ряд: формы нет, а полоска во всю ячейку соврёт", () => {
    expect(makeSpark(ряд([120]), 1, "2026-08-01")).toBeNull();
  });

  it("ряд из одних нулей: линия по полу читалась бы как «крутилось даром»", () => {
    expect(makeSpark(ряд([0, 0, 0, 0]), 1, "2026-08-04")).toBeNull();
  });

  it("мусор в числах не роняет и не рисует", () => {
    const битый = [
      { date: "2026-08-01", spend: NaN },
      { date: "2026-08-02", spend: Infinity },
    ] as SparkPoint[];
    expect(makeSpark(битый, 1, "2026-08-02")).toBeNull();
  });
});

describe("хвостовая корзина короче — и это НЕ обвал", () => {
  /* Движок режет длинное окно корзинами по N дней, а хвост берёт какой есть:
     окно редко делится нацело (core/leaderboard.py, _spark). Сумма за один
     день против сумм за три — обрыв в пол на ровном месте. */
  it("ровный расход остаётся ровной линией, хотя хвост вдвое короче", () => {
    // корзины по 2 дня, расход ровно 50 в день: 100, 100, и хвост из одного дня
    const s = makeSpark(
      [
        { date: "2026-08-01", spend: 100 },
        { date: "2026-08-03", spend: 100 },
        { date: "2026-08-05", spend: 50 },
      ],
      2,
      "2026-08-05",
    )!;
    const ys = точки(s.line).map(([, y]) => y);
    expect(ys[2]).toBeCloseTo(ys[0], 6);
    expect(ys[2]).toBeCloseTo(ys[1], 6);
  });

  it("пик отдаётся в спенде ЗА ДЕНЬ, а не суммой корзины", () => {
    const s = makeSpark(
      [
        { date: "2026-08-01", spend: 300 },
        { date: "2026-08-04", spend: 150 },
      ],
      3,
      "2026-08-06",
    )!;
    expect(s.peak).toBeCloseTo(100, 6); // 300 за три дня
    expect(s.bucket).toBe(3);
  });

  it("настоящий провал в хвосте виден, а не съедается пересчётом", () => {
    const s = makeSpark(
      [
        { date: "2026-08-01", spend: 100 },
        { date: "2026-08-03", spend: 100 },
        { date: "2026-08-05", spend: 5 }, // один день, и правда почти ноль
      ],
      2,
      "2026-08-05",
    )!;
    const ys = точки(s.line).map(([, y]) => y);
    expect(ys[2]).toBeGreaterThan(ys[0] + 5); // ниже по картинке = меньше
  });
});

describe("шкала не врёт масштабом", () => {
  it("пол — ноль: разница в доллар не превращается в качели во всю высоту", () => {
    const s = makeSpark(ряд([100, 101, 100]), 1, "2026-08-03")!;
    const ys = точки(s.line).map(([, y]) => y);
    const размах = Math.max(...ys) - Math.min(...ys);
    expect(размах).toBeLessThan(VB_H * 0.05);
  });

  it("провал посреди окна виден формой", () => {
    const ys = точки(makeSpark(ряд([100, 0, 100]), 1, "2026-08-03")!.line)
      .map(([, y]) => y);
    expect(ys[1]).toBeGreaterThan(ys[0] + VB_H * 0.5);
  });

  it("день без спенда — это точка 0, а не пропуск: ряд не сжимается", () => {
    const s = makeSpark(ряд([0, 0, 0, 0, 100, 80]), 1, "2026-08-06")!;
    expect(точки(s.line)).toHaveLength(6);
    // расход начался в пятой точке, а не с левого края
    expect(точки(s.line)[4][0]).toBeCloseTo(VB_W * 0.8, 6);
  });

  it("минус в дневном приросте не уезжает за край картинки", () => {
    // Мета пересчитывает спенд задним числом, и дневная разница бывает < 0
    const s = makeSpark(ряд([100, -40, 100]), 1, "2026-08-03")!;
    for (const [, y] of точки(s.line)) {
      expect(y).toBeGreaterThanOrEqual(0);
      expect(y).toBeLessThanOrEqual(VB_H);
    }
  });
});

describe("геометрия картинки", () => {
  it("ряд занимает всю ширину: от левого края до правого", () => {
    const s = makeSpark(ряд([10, 20, 30, 40]), 1, "2026-08-04")!;
    const xs = точки(s.line).map(([x]) => x);
    expect(xs[0]).toBe(0);
    expect(xs[xs.length - 1]).toBe(VB_W);
  });

  it("пик не срезается краем: линия толстая, у неё есть поле", () => {
    const s = makeSpark(ряд([0, 100]), 1, "2026-08-02")!;
    const ys = точки(s.line).map(([, y]) => y);
    expect(Math.min(...ys)).toBeGreaterThan(0);
    expect(Math.max(...ys)).toBeLessThan(VB_H);
  });

  it("заливка замкнута по нулю — иначе фигура схлопнется в линию", () => {
    const s = makeSpark(ряд([10, 90, 30]), 1, "2026-08-03")!;
    expect(s.area).toMatch(/^M0,/);
    expect(s.area).toMatch(/Z$/);
  });

  it("нет корзины в ответе демона — считаем ряд подневным", () => {
    const s = makeSpark(ряд([10, 20]), undefined, "2026-08-02")!;
    expect(s.bucket).toBe(1);
    expect(s.peak).toBeCloseTo(20, 6);
  });
});

describe("общая шкала среза", () => {
  it("без общего потолка горки крупного и мелкого крео неразличимы", () => {
    /* Ровно то, из-за чего столбец и переделали: каждая строка нормировалась
       в саму себя, и $600 рисовало ту же горку, что $70. Форма врала о
       масштабе, а сравнить строки между собой было нельзя вообще. */
    const крупное = makeSpark(ряд([300, 600]), 1, "2026-08-02")!;
    const мелкое = makeSpark(ряд([35, 70]), 1, "2026-08-02")!;
    expect(мелкое.line).toBe(крупное.line);
    expect(мелкое.shared).toBe(false);
  });

  it("с общим потолком высота значит деньги", () => {
    const потолок = 600;
    const крупное = makeSpark(ряд([300, 600]), 1, "2026-08-02", потолок)!;
    const мелкое = makeSpark(ряд([35, 70]), 1, "2026-08-02", потолок)!;
    const верх = (s: { line: string }) => Math.min(...точки(s.line).map(([, y]) => y));
    // Меньше Y — выше на картинке. Крупное обязано быть выше мелкого.
    expect(верх(крупное)).toBeLessThan(верх(мелкое));
    expect(крупное.shared).toBe(true);
    expect(мелкое.shared).toBe(true);
  });

  it("потолок ниже собственного пика игнорируется — иначе горка уедет за край", () => {
    const s = makeSpark(ряд([10, 900]), 1, "2026-08-02", 100)!;
    expect(s.shared).toBe(false);
    const ys = точки(s.line).map(([, y]) => y);
    expect(Math.min(...ys)).toBeGreaterThan(0);
  });

  it("sparkCeiling берёт максимум СУТОЧНОГО расхода по всем рядам", () => {
    const потолок = sparkCeiling(
      [
        { days: ряд([10, 20]), days_bucket_days: 1 },
        { days: ряд([50, 90]), days_bucket_days: 1 },
        { days: null, days_bucket_days: 1 },
      ],
      "2026-08-02",
    );
    expect(потолок).toBeCloseTo(90, 6);
  });

  it("sparkCeiling делит корзину на её длину, как и сам ряд", () => {
    // Корзина в три дня по $90 — это $30 в день, а не $90.
    const потолок = sparkCeiling(
      [{ days: ряд([90, 90], 3), days_bucket_days: 3 }],
      "2026-08-07",
    );
    expect(потолок).toBeCloseTo(30, 6);
  });
});

describe("направление ряда", () => {
  it("растёт — up, падает — down", () => {
    expect(makeSpark(ряд([10, 20, 30, 40]), 1, "2026-08-04")!.trend).toBe("up");
    expect(makeSpark(ряд([40, 30, 20, 10]), 1, "2026-08-04")!.trend).toBe("down");
  });

  it("ровный ряд — flat, а не случайная сторона", () => {
    expect(makeSpark(ряд([50, 50, 50, 50]), 1, "2026-08-04")!.trend).toBe("flat");
    // Дневная рябь в пределах порога — тоже ровно.
    expect(makeSpark(ряд([50, 51, 49, 50]), 1, "2026-08-04")!.trend).toBe("flat");
  });

  it("выброс в хвосте не объявляет разворот", () => {
    /* Наклон по наименьшим квадратам, а не «последняя точка против первой».
       Мета досчитывает день задним числом — по двум крайним точкам такой
       досчёт каждый раз переворачивал бы тренд на ровном месте. */
    const s = makeSpark(ряд([100, 98, 96, 94, 92, 130]), 1, "2026-08-06")!;
    expect(s.trend).not.toBe("up");
  });

  it("база нуля лежит внутри картинки и ниже любой точки ряда", () => {
    const s = makeSpark(ряд([10, 90, 30]), 1, "2026-08-03")!;
    const ys = точки(s.line).map(([, y]) => y);
    expect(s.base).toBeLessThanOrEqual(VB_H);
    expect(s.base).toBeGreaterThanOrEqual(Math.max(...ys));
  });
});
