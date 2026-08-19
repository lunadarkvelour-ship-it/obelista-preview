import { describe, expect, it } from "vitest";
import { heatTone, makeHeatScale } from "@/lib/heat";

/* Тепловая шкала колонок цены. Проверяется не «математика ради математики»,
   а два обещания юзеру: выброс не имеет права перекрасить всю таблицу в один
   оттенок, и подложка не имеет права перебить цифры. */

describe("makeHeatScale — что считается ценой", () => {
  it("null, ноль и минус — не цена, красить нечем", () => {
    const шкала = makeHeatScale([5, 10, 15, 20]);
    expect(шкала.at(null)).toBeNull();
    expect(шкала.at(0)).toBeNull();
    expect(шкала.at(-3)).toBeNull();
    expect(шкала.at(NaN)).toBeNull();
    expect(шкала.at(Infinity)).toBeNull();
  });

  it("сами такие значения не участвуют в построении шкалы", () => {
    // нули и null-ы в срезе — это «депов не было», а не «дёшево»;
    // если бы они попали в выборку, они утащили бы нижнюю границу в 0
    const сНулями = makeHeatScale([null, 0, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, -5]);
    const чистая = makeHeatScale([10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20]);
    expect(сНулями.at(15)).toBeCloseTo(чистая.at(15)!, 10);
  });
});

describe("makeHeatScale — перцентили против выбросов", () => {
  it("выброс не притягивает верх шкалы: 4 из [1,2,3,4,500] не становится 1.0", () => {
    const шкала = makeHeatScale([1, 2, 3, 4, 500]);
    expect(шкала.at(4)).not.toBe(1);
    expect(шкала.at(4)!).toBeLessThan(0.5);
    expect(шкала.at(500)).toBe(1);
  });

  it("нормальные строки сохраняют разброс, а не схлопываются в один оттенок", () => {
    // одно объявление с одним депом за $390 — типичный срез
    const цены = [10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 390];
    const шкала = makeHeatScale(цены);
    const разброс = шкала.at(19)! - шкала.at(12)!;
    expect(разброс).toBeGreaterThan(0.5);
    // на линейной min/max шкале тот же разброс был бы (19-12)/380 ≈ 0.018
    expect(разброс).toBeGreaterThan((19 - 12) / (390 - 10) * 10);
  });

  it("за перцентильными границами — ровно 0 и 1, без ухода за пределы", () => {
    const шкала = makeHeatScale([3, 4, 5, 6, 7, 8, 9, 10, 11, 40]);
    expect(шкала.at(3)).toBe(0);    // ниже 10-го перцентиля (3.9)
    expect(шкала.at(1)).toBe(0);    // и сильно ниже — тоже 0
    expect(шкала.at(40)).toBe(1);   // выше 90-го перцентиля (13.9)
    expect(шкала.at(9999)).toBe(1);
  });

  it("границы окна — именно 10-й и 90-й перцентиль", () => {
    // [3..11,40]: p10 = 3.9, p90 = 13.9, span = 10
    const шкала = makeHeatScale([3, 4, 5, 6, 7, 8, 9, 10, 11, 40]);
    expect(шкала.at(6)!).toBeCloseTo(0.21, 6);
    expect(шкала.at(11)!).toBeCloseTo(0.71, 6);
  });

  it("если перцентильное окно схлопнулось в точку — шкала расширяется до min/max", () => {
    // основная масса по одной цене, но различимых значений всё же три:
    // деления на ноль быть не должно, ранжировать по-прежнему можно
    const цены = [1, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 9];
    const шкала = makeHeatScale(цены);
    expect(шкала.at(1)).toBe(0);
    expect(шкала.at(9)).toBe(1);
    expect(шкала.at(5)!).toBeCloseTo(0.5, 6);
  });
});

describe("makeHeatScale — когда красить нельзя", () => {
  it("меньше трёх различимых значений — шкалы нет", () => {
    expect(makeHeatScale([5, 9]).at(5)).toBeNull();
    expect(makeHeatScale([5, 5, 5, 9, 9]).at(9)).toBeNull();
    expect(makeHeatScale([7, 7, 7]).at(7)).toBeNull();
    expect(makeHeatScale([]).at(5)).toBeNull();
    expect(makeHeatScale([null, null, 12]).at(12)).toBeNull();
  });

  it("ровно три различимых — уже красит", () => {
    const шкала = makeHeatScale([5, 5, 9, 14]);
    expect(шкала.at(5)).not.toBeNull();
    expect(шкала.at(14)).not.toBeNull();
  });
});

describe("makeHeatScale — монотонность и чистота", () => {
  it("дешевле — меньше t, по всему срезу", () => {
    const цены = [4, 6, 9, 12, 15, 19, 24, 31, 44, 120];
    const шкала = makeHeatScale(цены);
    const t = цены.map((v) => шкала.at(v)!);
    for (let i = 1; i < t.length; i++) expect(t[i]).toBeGreaterThanOrEqual(t[i - 1]);
    // внутри окна — строго, иначе оттенки неразличимы
    expect(шкала.at(12)!).toBeGreaterThan(шкала.at(9)!);
    expect(шкала.at(24)!).toBeGreaterThan(шкала.at(12)!);
  });

  it("входной массив не мутируется (порядок строк таблицы — не наше дело)", () => {
    const цены: Array<number | null> = [40, 3, null, 11, 0, 7, 5, 9, 6, 8, 10, 4];
    const копия = [...цены];
    const шкала = makeHeatScale(цены);
    шкала.at(7);
    шкала.at(null);
    expect(цены).toEqual(копия);
  });

  it("две шкалы по одним данным дают одно и то же (чистая функция)", () => {
    const цены = [3, 4, 5, 6, 7, 8, 9, 10, 11, 40];
    expect(makeHeatScale(цены).at(8)).toBe(makeHeatScale([...цены]).at(8));
  });
});

describe("heatTone", () => {
  it("нет значения — нет фона", () => {
    expect(heatTone(null)).toBe("");
    expect(heatTone(NaN)).toBe("");
  });

  it("края шкалы: дёшево — чистый холодный стоп, дорого — чистый горячий", () => {
    /* Потолок и пол задаёт тема через `--heat-max` и `--heat-floor`, а не этот
       модуль: над белым и над #171719 одна и та же доля даёт то пастель, то
       блок, перебивающий само число. Здесь только доли, абсолют в globals.css.

       На краях доля смешивания 100%: холодный конец не подмешивает средний
       стоп вовсе, иначе «самое дешёвое» уползало бы в малиновый. */
    expect(heatTone(0)).toBe(
      "color-mix(in oklch, color-mix(in oklch, var(--heat-cold), var(--heat-mid) 0%) " +
      "calc(var(--heat-max) * (var(--heat-floor) + (1 - var(--heat-floor)) * 1)), transparent)");
    expect(heatTone(1)).toBe(
      "color-mix(in oklch, color-mix(in oklch, var(--heat-mid), var(--heat-hot) 100%) " +
      "calc(var(--heat-max) * (var(--heat-floor) + (1 - var(--heat-floor)) * 1)), transparent)");
  });

  it("середина берёт средний стоп и пол насыщенности, а не пустоту", () => {
    /* Раньше здесь возвращалось `transparent`, и основная масса строк
       оставалась неокрашенной: градиент жил только на хвостах, а между «чуть
       дешевле среднего» и «чуть дороже» глаз не видел ничего. */
    const s = heatTone(0.5);
    expect(s).not.toBe("transparent");
    expect(s).toContain("var(--heat-mid)");
    expect(s).toContain("* 0)");   // отход от середины нулевой → только пол
  });

  it("ход непрерывный: соседние доли дают разные строки", () => {
    const шаги = [0, 0.15, 0.3, 0.45, 0.55, 0.7, 0.85, 1].map(heatTone);
    expect(new Set(шаги).size).toBe(шаги.length);
  });

  it("тепло не берёт токены состояния — иначе цену не перекрасить без статусов", () => {
    /* `--success` и `--destructive` значат «живое / сломанное» и красят статусы
       кабов и соцев. Дорогое крео ничем не сломано, и пока цвет был общий,
       перекрасить шкалу, не тронув статусы, было нельзя. */
    for (const t of [0, 0.2, 0.4, 0.6, 0.8, 1]) {
      const s = heatTone(t);
      expect(s).not.toContain("--success");
      expect(s).not.toContain("--destructive");
      expect(s).not.toContain("--primary");
    }
  });

  it("между краем и серединой — половина хода и половина насыщенности", () => {
    expect(heatTone(0.25)).toBe(
      "color-mix(in oklch, color-mix(in oklch, var(--heat-cold), var(--heat-mid) 50%) " +
      "calc(var(--heat-max) * (var(--heat-floor) + (1 - var(--heat-floor)) * 0.5)), transparent)");
    expect(heatTone(0.75)).toBe(
      "color-mix(in oklch, color-mix(in oklch, var(--heat-mid), var(--heat-hot) 50%) " +
      "calc(var(--heat-max) * (var(--heat-floor) + (1 - var(--heat-floor)) * 0.5)), transparent)");
  });

  it("потолок не превышается: доля всегда в пределах 0..1", () => {
    /* Подложка не имеет права перебить цифры, поэтому множитель потолка
       никогда не больше единицы — сколько бы ни было на входе. */
    for (const t of [0, 0.1, 0.3, 0.7, 0.9, 1, 2, -1]) {
      const s = heatTone(t);
      if (s === "transparent" || s === "") continue;
      const доля = Number(/\* ([\d.]+)\)\)/.exec(s)?.[1] ?? 99);
      expect(доля).toBeGreaterThan(0);
      expect(доля).toBeLessThanOrEqual(1);
    }
  });

  it("выход за 0..1 подрезается, а не усиливает заливку", () => {
    expect(heatTone(2)).toBe(heatTone(1));
    expect(heatTone(-1)).toBe(heatTone(0));
  });

  it("работает через токены, а не через хардкод цвета — обе темы из одной строки", () => {
    expect(heatTone(0.1)).toContain("var(--heat-cold)");
    expect(heatTone(0.9)).toContain("var(--heat-hot)");
    expect(heatTone(0.1)).not.toMatch(/#|rgb|oklch\(/);
  });
});
