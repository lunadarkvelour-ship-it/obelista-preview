/* Постраничный показ длинных таблиц.
 *
 * Парк вырос со 86 кабинетов до 172 за один день (подключили два новых соца), и
 * дальше будет расти: одна таблица во весь список стала нечитаемой — до нужной
 * строки надо крутить экран, а «сколько всего» тонет.
 *
 * Логика вынесена из вёрстки: границы страницы легко испортить незаметно
 * (последняя страница на единицу короче, страница вне диапазона после смены
 * фильтра, деление на ноль на пустом списке) — а видно это будет как «кабинет
 * пропал», что здесь стоит дороже всего.
 */

/** Сколько строк на странице. Меньше 25 нет смысла (полэкрана пустует),
 *  больше 100 — снова стена, ради которой всё и затевалось. */
export const PAGE_SIZES = [25, 50, 100] as const;
export type PageSize = (typeof PAGE_SIZES)[number];
export const DEFAULT_PAGE_SIZE: PageSize = 50;

/** Приводит чужое значение к разрешённому: в localStorage может лежать что
 *  угодно из прошлых версий, а «показывать по 7 строк» — это поломка. */
export function normalizeSize(v: unknown): PageSize {
  const n = Number(v);
  return (PAGE_SIZES as readonly number[]).includes(n) ? (n as PageSize) : DEFAULT_PAGE_SIZE;
}

export interface Paged<T> {
  /** Строки этой страницы. */
  items: T[];
  /** Номер страницы, 1-based, уже прижатый к допустимому диапазону. */
  page: number;
  pages: number;
  /** Человеческие границы для подписи «11–60 из 172», 1-based и включительно. */
  from: number;
  to: number;
  total: number;
}

/** Нарезка списка на страницу.
 *
 *  `page` прижимается к [1, pages] намеренно, а не считается ошибкой: смена
 *  фильтра укорачивает список, и пользователь, стоявший на пятой странице,
 *  должен увидеть последнюю, а не пустоту.
 */
export function paginate<T>(all: T[], page: number, size: number): Paged<T> {
  const total = all.length;
  const per = normalizeSize(size);
  const pages = Math.max(1, Math.ceil(total / per));
  const p = Math.min(Math.max(1, Math.floor(page) || 1), pages);
  const start = (p - 1) * per;
  const items = all.slice(start, start + per);
  return {
    items,
    page: p,
    pages,
    total,
    from: total ? start + 1 : 0,
    to: start + items.length,
  };
}

/** Номера страниц для полосы переключения, с многоточиями.
 *
 *  Первая и последняя видны всегда: «в начало» и «в конец» — самые частые
 *  прыжки, и прятать их за стрелками значит заставлять кликать по разу на
 *  страницу. `null` — место разрыва.
 */
export function pageWindow(page: number, pages: number, around = 1): (number | null)[] {
  if (pages <= 1) return [1];
  const keep = new Set<number>([1, pages]);
  for (let i = page - around; i <= page + around; i++) {
    if (i >= 1 && i <= pages) keep.add(i);
  }
  const sorted = [...keep].sort((a, b) => a - b);
  const out: (number | null)[] = [];
  let prev = 0;
  for (const n of sorted) {
    if (prev && n - prev > 1) out.push(null);
    out.push(n);
    prev = n;
  }
  return out;
}
