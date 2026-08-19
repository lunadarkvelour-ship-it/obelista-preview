/* Архив и удаление профиля: что панель обязана знать о них САМА.
 *
 * ЧТО БЫЛО НЕ ТАК (проверено по коду 15.08, иссус #131). Архив и удаление
 * выглядели на экране ОДИНАКОВО и оба — необратимо:
 *
 *   1. `/socials` архивные строки не отдаёт вовсе (`analytics_daemon.py:265` —
 *      «архивные не показываем ни одной из двух веток»). Значит после архива
 *      строка исчезает с экрана навсегда, ровно как после удаления.
 *   2. `api.unarchiveProfile` в панели существовал и НЕ ВЫЗЫВАЛСЯ НИОТКУДА:
 *      ручка возврата была, двери к ней не было. То есть обратимость архива
 *      была написана в комментарии и недоступна человеку.
 *   3. Отчёт об удалении («сколько дней спенда ушло») жил в состоянии строки,
 *      а строка через 900 мс сносилась `window.location.reload()`. Единственное
 *      число, ради которого удаление вообще что-то возвращает, человек видел
 *      меньше секунды.
 *
 * Итог для человека: две кнопки с разными обещаниями и одним наблюдаемым
 * исходом — «строка пропала». Отличить их можно было только по цифрам в базе
 * через сутки, а это и есть то, чего владелец боится.
 *
 * ПОЧЕМУ ПАМЯТЬ ЖИВЁТ В БРАУЗЕРЕ. Правильное место для списка архивных — ответ
 * демона (`/socials?archived=1` или флаг `archived` в строке): тогда архив
 * виден с любой машины и любому в команде. Ручки профиля сейчас правит другой
 * воркер, и трогать их отсюда нельзя, а оставить архив без выхода нельзя тем
 * более. Поэтому панель помнит то, что заархивировала САМА, — этого хватает,
 * чтобы возврат существовал и пережил перезагрузку у того, кто нажал.
 *
 * Память самолечащаяся: как только строка снова приезжает от демона, запись из
 * памяти уходит (`pruneArchived`). Поэтому расхождение не копится — ни когда
 * профиль вернули с другой машины, ни когда его потом удалили.
 */

/** Строка архива глазами панели. Имя храним рядом с id намеренно: в архиве
 *  демон её не отдаёт вовсе, а вернуть профиль человек хочет по имени — по
 *  голому `k1f9qbcs` он не узнает, кого возвращает. */
export interface ArchivedProfile {
  profile_id: string;
  name: string;
}

/** Минимум от `localStorage`, чтобы логику можно было испытать без браузера. */
export interface Хранилище {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

export const ARCHIVE_KEY = "obelista.socials.archived";

function хранилище(store?: Хранилище | null): Хранилище | null {
  if (store) return store;
  try {
    return typeof localStorage === "undefined" ? null : localStorage;
  } catch {
    /* Приватный режим и «cookies blocked» роняют само обращение к свойству. */
    return null;
  }
}

/** Что панель помнит об архиве. Любой мусор в хранилище читается как «пусто»:
 *  сломанная запись не имеет права уронить лист профилей целиком. */
export function readArchived(store?: Хранилище | null): ArchivedProfile[] {
  const s = хранилище(store);
  if (!s) return [];
  try {
    const raw = s.getItem(ARCHIVE_KEY);
    if (!raw) return [];
    const данные = JSON.parse(raw);
    if (!Array.isArray(данные)) return [];
    return данные
      .filter((r) => r && typeof r.profile_id === "string" && r.profile_id)
      .map((r) => ({ profile_id: r.profile_id as string, name: String(r.name ?? "") }));
  } catch {
    return [];
  }
}

export function writeArchived(list: ArchivedProfile[], store?: Хранилище | null): void {
  const s = хранилище(store);
  if (!s) return;
  try {
    s.setItem(ARCHIVE_KEY, JSON.stringify(list));
  } catch {
    /* Переполненное или запрещённое хранилище — не повод ронять действие,
       которое на сервере уже прошло. Человек потеряет строку возврата, но не
       данные: архив обратим ручкой демона в любом случае. */
  }
}

/** Добавить профиль в память об архиве. Повтор не задваивает строку. */
export function rememberArchived(
  list: ArchivedProfile[], row: ArchivedProfile,
): ArchivedProfile[] {
  return [...list.filter((r) => r.profile_id !== row.profile_id), row];
}

export function forgetArchived(list: ArchivedProfile[], id: string): ArchivedProfile[] {
  return list.filter((r) => r.profile_id !== id);
}

/** Самолечение: строка, которую демон снова отдаёт в листе, архивной не
 *  является — кто-то вернул её из архива с другой машины, или её там никогда и
 *  не было. Без этого память копила бы призраков, и «в архиве» показывало бы
 *  профиль, который прямо сейчас собирается. */
export function pruneArchived(
  list: ArchivedProfile[], rows: { profile_id: string }[],
): ArchivedProfile[] {
  const живые = new Set(rows.map((r) => r.profile_id));
  return list.filter((r) => !живые.has(r.profile_id));
}

/** Что можно сделать со строкой листа.
 *
 *  АРХИВ ДОСТУПЕН ВСЕГДА, и это правка сути. Раньше обе кнопки прятались за
 *  `!in_antik` — то есть профиль, который РАБОТАЕТ, выключить из работы было
 *  нечем, хотя ровно для этого архив и придуман («данные остаются, но с ними не
 *  собрать спек, не поставить автоправил», `core/registry.py:386`). Довод в
 *  пользу пряталки касался только удаления и остался при нём.
 *
 *  УДАЛЕНИЕ — по-прежнему только у тех, кого в антидетекте нет. Профиль на
 *  месте, а токен молчит (чекпоинт, смена пароля) — это чинится
 *  переподключением, и предлагать там «стереть вместе со спендом» значит
 *  толкать человека выбросить рабочий профиль из-за временной беды. */
export function rowActions(row: { in_antik: boolean }): { archive: boolean; delete: boolean } {
  return { archive: true, delete: !row.in_antik };
}

/** Что сказать человеку после удаления.
 *
 *  ЧИСЛА, А НЕ СЛОВО «ГОТОВО»: `registry.delete_profile` возвращает, сколько
 *  строк ушло из каждой таблицы, и `account_day` — это дни спенда, то есть
 *  деньги.
 *
 *  НЕПОЛНОЕ УДАЛЕНИЕ НАЗЫВАЕТСЯ ВСЛУХ. Демон кладёт в ту же карту строку
 *  «ошибка: …», если таблицы на базе не оказалось (`core/registry.py:455`).
 *  Панель до этого считала её через `Number(...)`, получала `NaN`, `NaN`
 *  оказывался ложным — и наполовину прошедшее удаление отчитывалось ровным
 *  «deleted». Худший из возможных исходов: человек уверен, что стёр, а следы
 *  профиля лежат. */
export interface DeleteReceipt {
  /** Сколько дней спенда стёрто. */
  days: number;
  /** Таблицы, в которых удаление не прошло. */
  partial: string[];
  /** Готовая фраза человеку. */
  text: string;
}

export function deleteReceipt(убрано?: Record<string, number | string> | null): DeleteReceipt {
  const карта = убрано ?? {};
  const partial = Object.keys(карта).filter((t) => typeof карта[t] === "string");
  const сырое = карта["account_day"];
  const days = typeof сырое === "number" && Number.isFinite(сырое) ? сырое : 0;

  if (partial.length) {
    return {
      days, partial,
      text: `deleted only in part — ${partial.join(", ")} still hold rows of this profile`,
    };
  }
  return {
    days, partial,
    text: days
      ? `deleted — ${days} ${days === 1 ? "day" : "days"} of spending history erased with it`
      : "deleted — it had no spending history stored",
  };
}
