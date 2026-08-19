/* Архив и удаление профиля на листе «Профили» (#131).
 *
 * ПОЧЕМУ ЭТО ВООБЩЕ ТЕСТ, А НЕ «ПОСМОТРЕЛ ГЛАЗАМИ». Архив выключает профиль из
 * сбора и из залива — ошибка здесь видна не на экране, а в цифрах через сутки:
 * выключенный собирается дальше или живой перестаёт. Владелец на такое смотрит
 * последним и дороже всех.
 *
 * Часть проверок — чтением исходника, и это сказано вслух: обе кнопки живут за
 * ответом демона и за нажатием, куда статический рендер не доходит. Зелёный
 * рендер-тест на них означал бы «не дошли», а не «дефекта нет».
 */
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import {
  ARCHIVE_KEY, deleteReceipt, forgetArchived, pruneArchived, readArchived,
  rememberArchived, rowActions, writeArchived, type Хранилище,
} from "@/lib/socials-archive";

function фейк(начальное?: string): Хранилище & { данные: Record<string, string> } {
  const данные: Record<string, string> = начальное ? { [ARCHIVE_KEY]: начальное } : {};
  return {
    данные,
    getItem: (k) => (k in данные ? данные[k] : null),
    setItem: (k, v) => { данные[k] = v; },
  };
}

describe("что предлагает строка", () => {
  it("архив доступен и у профиля, который прямо сейчас в антидетекте", () => {
    /* Ровно для этого архив и придуман — выключить РАБОТАЮЩИЙ профиль из
       работы. Раньше обе кнопки прятались за `!in_antik`, и выключить живой
       профиль было нечем вовсе. */
    expect(rowActions({ in_antik: true }).archive).toBe(true);
  });

  it("удаление у профиля, который в антидетекте есть, не предлагается", () => {
    // Молчащий токен у живого профиля чинится переподключением, а не
    // выбрасыванием профиля вместе со спендом.
    expect(rowActions({ in_antik: true }).delete).toBe(false);
  });

  it("у выбывшего профиля доступны оба действия", () => {
    expect(rowActions({ in_antik: false })).toEqual({ archive: true, delete: true });
  });
});

describe("память об архиве переживает перезагрузку", () => {
  it("записанное читается обратно", () => {
    const s = фейк();
    writeArchived([{ profile_id: "k1f9qbcs", name: "1/8 MediaBuyer3" }], s);
    expect(readArchived(s)).toEqual([{ profile_id: "k1f9qbcs", name: "1/8 MediaBuyer3" }]);
  });

  it("повторный архив того же профиля не задваивает строку", () => {
    let список = rememberArchived([], { profile_id: "a", name: "Ko Swe" });
    список = rememberArchived(список, { profile_id: "a", name: "Ko Swe" });
    expect(список).toHaveLength(1);
  });

  it("возврат из архива убирает запись", () => {
    const список = rememberArchived([], { profile_id: "a", name: "Ko Swe" });
    expect(forgetArchived(список, "a")).toEqual([]);
  });

  it("строка, снова приехавшая от демона, перестаёт числиться архивной", () => {
    /* Самолечение. Профиль вернули из архива с другой машины — иначе панель
       показывала бы «в архиве» то, что прямо сейчас собирает спенд. */
    const список = [{ profile_id: "a", name: "Ko Swe" }, { profile_id: "b", name: "Nehomar" }];
    expect(pruneArchived(список, [{ profile_id: "a" }])).toEqual([
      { profile_id: "b", name: "Nehomar" },
    ]);
  });

  it("мусор в хранилище читается как пусто, а не роняет лист", () => {
    expect(readArchived(фейк("{не json"))).toEqual([]);
    expect(readArchived(фейк('{"profile_id":"a"}'))).toEqual([]);
    expect(readArchived(фейк('[{"нет":"id"}]'))).toEqual([]);
  });

  it("без хранилища вовсе (сервер, приватный режим) — пустой список и никакого исключения", () => {
    expect(readArchived(null)).toEqual([]);
    expect(() => writeArchived([{ profile_id: "a", name: "x" }], null)).not.toThrow();
  });
});

describe("отчёт об удалении говорит числами и не врёт про неполное", () => {
  it("дни спенда названы", () => {
    const r = deleteReceipt({ account_day: 34, token: 1, profile: 1 });
    expect(r.days).toBe(34);
    expect(r.text).toContain("34 days");
    expect(r.partial).toEqual([]);
  });

  it("один день — «day», а не «1 days»", () => {
    expect(deleteReceipt({ account_day: 1 }).text).toContain("1 day of");
  });

  it("профиль без истории не выдаёт себя за стёртую историю", () => {
    const r = deleteReceipt({ account_day: 0, profile: 1 });
    expect(r.text).toContain("no spending history");
  });

  it("наполовину прошедшее удаление НЕ отчитывается словом «deleted»", () => {
    /* Здесь и был дефект: демон кладёт в ту же карту строку «ошибка: …»
       (`core/registry.py:455`), панель считала её `Number(...)`, получала `NaN`,
       `NaN` оказывался ложным — и человек читал ровное «deleted», имея на руках
       профиль, следы которого лежат. */
    const r = deleteReceipt({
      account_day: 12,
      social_profile: "ошибка: OperationalError: no such table: social_profile",
    });
    expect(r.partial).toEqual(["social_profile"]);
    expect(r.text).toContain("only in part");
    expect(r.text).toContain("social_profile");
  });

  it("пустой ответ не выдумывает дней", () => {
    expect(deleteReceipt(undefined).days).toBe(0);
    expect(deleteReceipt(null).partial).toEqual([]);
  });
});

describe("экран — проверка по исходнику, потому что рендером сюда не дойти", () => {
  /* Смотрим на КОД без комментариев. В комментариях снесённая перезагрузка
     названа по имени — там объяснено, почему её убрали, и запретить это слово
     там значило бы запретить объяснять причину. Ровно тем же приёмом соседний
     сторож в `socials-rows.test.ts` отделяет литералы от рассказа о правке. */
  const исходник = readFileSync("components/views/SocialsView.tsx", "utf-8")
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/^\s*\/\/.*$/gm, "");

  it("необратимость удаления названа ДО нажатия", () => {
    // Текст стоит в подтверждении, рядом с самой кнопкой.
    expect(исходник).toContain("This cannot be undone.");
  });

  it("архив описан последствием, а не «сохранением истории»", () => {
    /* Он не «сохраняет историю» — он ВЫКЛЮЧАЕТ профиль из сбора и из залива.
       Человек, выбравший его ради цифр, обязан узнать и про вторую половину. */
    expect(исходник).toContain("stops collecting for this profile");
    expect(исходник).toContain("takes it out of uploads and rules");
  });

  it("из архива есть выход, и он вызывает ручку возврата", () => {
    // `unarchiveProfile` до этого существовал в клиенте и не вызывался ниоткуда:
    // обратимость архива была написана в комментарии и недоступна человеку.
    expect(исходник).toContain("api.unarchiveProfile");
    expect(исходник).toContain("Restore");
  });

  it("лист не перезагружает страницу ради одной строки", () => {
    /* Перезагрузка была единственным способом показать результат — и она же
       его стирала: отчёт об удалении жил 900 мс. Иссус #131 просит обратного
       прямо: видно сразу, БЕЗ перезагрузки. */
    expect(исходник).not.toContain("window.location.reload");
  });
});
