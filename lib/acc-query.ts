/**
 * Разбор строки поиска по кабинетам: одно слово или ВСТАВЛЕННЫЙ СПИСОК.
 *
 * Зачем. Байер приносит набор кабинетов из чужого места — из таблицы, из чата,
 * из выгрузки антика — и ему надо отметить ровно их. Раньше это означало
 * искать по одному и щёлкать чекбоксы: на двадцати кабинетах это пять минут и
 * два промаха, которые заметны только после залива.
 *
 * Форма списка не задаётся. В работе встречаются все три сразу:
 *   — только id (`act_1712129746672454` или голые цифры);
 *   — только имена (`MeDuA6aeP 10/8- 1`);
 *   — вперемешку через строку, как их отдаёт копипаст из Ads Manager:
 *       MeDuA6aeP 10/8- 1
 *       1922799508390605
 *
 * Поэтому тип каждой строки определяется по ней самой, а не по режиму:
 * последовательность из 10+ цифр — это id, всё остальное — имя. Строка
 * `MeDuA6aeP 10/8- 1` цифры содержит, но не состоит из них, и уезжает в имена.
 *
 * Имя сверяется ЦЕЛИКОМ (без учёта регистра и лишних пробелов), а не
 * подстрокой. Подстрока здесь опасна: `MeDuA6aeP 10/8- 1` является префиксом
 * `MeDuA6aeP 10/8- 10`, и вставленный список из десяти кабинетов молча
 * захватил бы одиннадцатый. Одиночный запрос — наоборот, подстрока: там ищут
 * «покажи что-нибудь про spx», а не «ровно этот кабинет».
 */

export interface AccQuery {
  /** Список из двух и более строк — тогда включается точный отбор. */
  list: boolean;
  /** id без префикса `act_`, в нижнем регистре. */
  ids: Set<string>;
  /** Нормализованные имена целиком. */
  names: Set<string>;
  /** Исходная строка для одиночного поиска подстрокой. */
  needle: string;
  /** Сколько всего строк распознано — им подписывается кнопка отметки. */
  size: number;
}

const norm = (s: string) => s.trim().toLowerCase().replace(/\s+/g, " ");

/** Голый id кабинета: `act_123…`, `123…` или строка, где цифры разделены
 *  пробелами при копировании из таблицы. Порог в 10 цифр — чтобы `10/8- 1`
 *  и прочие куски имён сюда не проваливались. */
function asId(line: string): string | null {
  const t = line.trim().replace(/^act_/i, "").replace(/\s+/g, "");
  return /^\d{10,}$/.test(t) ? t : null;
}

export function parseAccQuery(raw: string): AccQuery {
  /* Разделители — перевод строки, точка с запятой и запятая. Запятая тоже:
     половина списков приходит одной строкой через запятую, и требовать от
     человека переформатировать вставку значит вернуть ему ту же ручную
     работу, ради которой всё и делалось. Пробел разделителем НЕ считается —
     имена кабинетов из него состоят. */
  const lines = raw
    .split(/[\n;,]+/)
    .map((l) => l.trim())
    .filter(Boolean);

  const ids = new Set<string>();
  const names = new Set<string>();
  for (const l of lines) {
    const id = asId(l);
    if (id) ids.add(id);
    else names.add(norm(l));
  }

  const size = ids.size + names.size;
  return {
    // Список — это два и более распознанных значения. Одна строка остаётся
    // обычным поиском подстрокой, каким и была.
    list: size > 1,
    ids,
    names,
    needle: norm(raw),
    size,
  };
}

/** Подходит ли кабинет под запрос. */
export function matchAcc(
  q: AccQuery,
  acc: { id: string; name?: string },
  profile: string,
  profileLabel: string,
): boolean {
  if (!q.needle) return true;
  if (q.list) {
    const bare = acc.id.replace(/^act_/i, "");
    return q.ids.has(bare) || q.names.has(norm(acc.name || ""));
  }
  const n = q.needle;
  return (
    acc.id.toLowerCase().includes(n) ||
    norm(acc.name || "").includes(n) ||
    profile.toLowerCase().includes(n) ||
    profileLabel.toLowerCase().includes(n)
  );
}

/** Строки списка, которым в парке кабинетов ничего не соответствует.
 *
 *  Отдельная величина, а не «нашлось меньше, чем вставили»: человек должен
 *  видеть, ЧТО именно не нашлось. Вставил двадцать, отметилось восемнадцать —
 *  без этого списка два потерянных кабинета замечаются после залива. */
export function unmatched(
  q: AccQuery,
  accounts: Array<{ id: string; name?: string }>,
): string[] {
  if (!q.list) return [];
  const haveIds = new Set(accounts.map((a) => a.id.replace(/^act_/i, "")));
  const haveNames = new Set(accounts.map((a) => norm(a.name || "")));
  const out: string[] = [];
  for (const id of q.ids) if (!haveIds.has(id)) out.push(id);
  for (const nm of q.names) if (!haveNames.has(nm)) out.push(nm);
  return out;
}
