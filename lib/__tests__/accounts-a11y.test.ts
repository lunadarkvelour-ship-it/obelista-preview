/* Контролы листа «Кабинеты» обязаны иметь РАЗНЫЕ имена и липкую шапку.
 *
 * Оба факта поймала браузерная приёмка XR-49, и ни один не ловился прогоном:
 *
 *   1. Профиль и статус стоят рядом и оба отдавали доступное имя «select».
 *      Причина буквальная — `SelectField` подставляет `aria-label={placeholder
 *      || "select"}`, а плейсхолдера у этих полей нет. С клавиатуры и с
 *      читалкой экрана два фильтра были неразличимы.
 *
 *   2. `sticky top-0` на `<thead>` не делал ничего: `position: sticky`
 *      считается относительно ближайшего ПРОКРУЧИВАЕМОГО предка, а обёртка
 *      таблицы (объявленная `overflow-*`) не имела ограничения по высоте —
 *      прокручивать внутри было нечего, страница ехала целиком. Приёмка
 *      измерила `thead top=-143.36` при видимой таблице.
 *
 * ПОЧЕМУ ЭТО ПРОВЕРЯЕТСЯ ТЕКСТОМ, А НЕ РЕНДЕРОМ. Оба свойства — про КОМПОНОВКУ
 * и вычисленный стиль, а `renderToStaticMarkup` не считает ни того, ни другого:
 * он не знает про скролл-контейнеры и не строит дерево доступности. Настоящая
 * проверка — браузер, и она остаётся за XR-49. Здесь стоит сторож против
 * ВОЗВРАТА: чтобы правку нельзя было откатить молча, оставив классы на месте.
 *
 * Поэтому проверки ниже сформулированы как «второго родового имени не
 * заводим» и «ограничение высоты у скроллпорта есть» — то есть на отсутствие
 * условий, при которых дефект вернётся.
 */
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { AccountsTable } from "@/components/views/AccountsView";

const ROOT = path.resolve(__dirname, "..", "..");
const читать = (rel: string) => readFileSync(path.join(ROOT, rel), "utf8");

describe("у фильтров листа разные доступные имена", () => {
  it("SelectField умеет принимать имя, а не только плейсхолдер", () => {
    /* Плейсхолдер для этого не годится: он ещё и рисуется, когда выбора нет.
       Чинить доступность за счёт видимого текста — это менять один дефект на
       другой. */
    const control = читать("components/studio/control.tsx");
    expect(control).toContain("label?: string");
    expect(control).toContain('aria-label={label || placeholder || "select"}');
  });

  it("оба фильтра листа названы, и названы ПО-РАЗНОМУ", () => {
    const view = читать("components/views/AccountsView.tsx");
    const имена = [...view.matchAll(/label="([^"]+)"/g)].map((m) => m[1]);
    expect(имена).toContain("Filter by profile");
    expect(имена).toContain("Filter by account status");
    /* Совпадение имён — это и есть исходный дефект, просто с другими словами. */
    expect(new Set(имена).size, `совпали доступные имена: ${имена.join(" | ")}`)
      .toBe(имена.length);
    /* И родовое имя на этом листе не встречается ни у одного поля. */
    expect(view).not.toMatch(/label="select"/i);
  });
});

describe("шапка таблицы правда может прилипнуть", () => {
  const view = читать("components/views/AccountsView.tsx");

  it("классы sticky на месте", () => {
    expect(view).toContain("sticky top-0");
  });

  it("у скроллпорта есть ограничение высоты — иначе sticky бессмыслен", () => {
    /* ГЛАВНАЯ ПРОВЕРКА ЭТОГО ФАЙЛА. Классы `sticky` без прокручиваемого предка
       выглядят как работающая функция и не делают ничего — ровно то, что
       уехало в PR и было поймано только глазами. Ограничение обязано быть на
       ОБОИХ разрешениях: канвас оболочки задаёт высоту только с `lg`. */
    expect(view).toMatch(/max-h-\[70dvh\][^"]*overflow-auto/);
    expect(view).toContain("lg:min-h-0 lg:flex-1");
    /* И сам лист обязан быть колонкой во всю высоту, иначе `lg:flex-1` не от
       чего отсчитывать. */
    expect(view).toContain("lg:flex lg:h-full lg:min-h-0 lg:flex-col");
  });

  it("подвал таблицы НЕ внутри скроллпорта", () => {
    /* Пролистав пятьдесят строк, человек обязан всё ещё видеть переключатель
       страниц — иначе следующие пятьдесят недостижимы. Проверяем порядок:
       закрывающий тег скроллпорта идёт РАНЬШЕ подвала. */
    const таблица = view.slice(view.indexOf("export function AccountsTable"));
    const конецСкролла = таблица.indexOf("</table>\n      </div>");
    const подвал = таблица.indexOf("{p.footer}");
    expect(конецСкролла).toBeGreaterThan(-1);
    expect(подвал).toBeGreaterThan(конецСкролла);
  });

  it("шапка рисуется и держит признак сортировки", () => {
    /* Отрицательный контроль к трём проверкам текста выше: они читают файл, а
       этот — разметку. Если шапки не станет вовсе, текстовые останутся
       зелёными, а таблица поедет. */
    const html = renderToStaticMarkup(createElement(AccountsTable, {
      flat: [],
      selected: new Set<string>(),
      onSelect: () => {},
      inGroup: new Map<string, string[]>(),
      allSelected: false,
      onSelectAll: () => {},
      cols: [
        { id: "cab", title: "ad account", w: 340 },
        { id: "spend", title: "spend", w: 120, right: true },
      ],
      colWidth: (c: { w: number }) => c.w,
      ряд: { id: "spend", desc: true },
      onРяд: () => {},
    }));
    expect(html).toContain("<thead");
    expect(html).toContain('aria-sort="descending"');
  });
});
