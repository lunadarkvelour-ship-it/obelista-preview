import { describe, it, expect } from "vitest";
import { DEFAULT_PAGE_SIZE, normalizeSize, pageWindow, paginate } from "@/lib/paging";

/* Парк за день вырос с 86 кабинетов до 172, и одной таблицей это больше не
 * читается. Границы страницы легко испортить незаметно, а выглядеть это будет
 * как «кабинет пропал» — здесь это самая дорогая поломка. */

const список = (n: number) => Array.from({ length: n }, (_, i) => i + 1);

describe("нарезка на страницы", () => {
  it("первая страница и подпись «1–50 из 172»", () => {
    const p = paginate(список(172), 1, 50);
    expect(p.items).toHaveLength(50);
    expect(p.items[0]).toBe(1);
    expect([p.from, p.to, p.total, p.pages]).toEqual([1, 50, 172, 4]);
  });

  it("последняя страница короче — и это видно в подписи", () => {
    const p = paginate(список(172), 4, 50);
    expect(p.items).toEqual([151, 152, 153, 154, 155, 156, 157, 158, 159, 160,
      161, 162, 163, 164, 165, 166, 167, 168, 169, 170, 171, 172]);
    expect([p.from, p.to]).toEqual([151, 172]);
  });

  it("страница вне диапазона прижимается, а не даёт пустоту", () => {
    /* Живой сценарий: стоял на 4-й странице, сузил фильтр до 30 строк.
       Пустой экран читается как «ничего не нашлось», хотя нашлось. */
    const p = paginate(список(30), 4, 25);
    expect(p.page).toBe(2);
    expect(p.items).toHaveLength(5);
  });

  it("пустой список не ломает счётчики", () => {
    const p = paginate([], 1, 25);
    expect([p.items.length, p.pages, p.from, p.to, p.total]).toEqual([0, 1, 0, 0, 0]);
  });

  it("чужой размер страницы приводится к разрешённому", () => {
    // В localStorage может лежать что угодно из прошлых версий.
    expect(normalizeSize(7)).toBe(DEFAULT_PAGE_SIZE);
    expect(normalizeSize("100")).toBe(100);
    expect(normalizeSize(undefined)).toBe(DEFAULT_PAGE_SIZE);
    expect(normalizeSize(25)).toBe(25);
  });
});

describe("полоса переключения", () => {
  it("первая и последняя видны всегда, середина сворачивается", () => {
    expect(pageWindow(5, 10)).toEqual([1, null, 4, 5, 6, null, 10]);
  });

  it("коротких списков не сворачиваем", () => {
    expect(pageWindow(1, 3)).toEqual([1, 2, 3]);
    expect(pageWindow(1, 1)).toEqual([1]);
  });

  it("у краёв нет разрыва вплотную к единице", () => {
    expect(pageWindow(2, 10)).toEqual([1, 2, 3, null, 10]);
  });
});
