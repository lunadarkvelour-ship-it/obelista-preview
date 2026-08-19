/* Смотрелка листа «Integrations» — и заодно единственная проверка, что он
   вообще рисуется.

   ОТЛИЧИЕ ОТ СОСЕДНИХ СМОТРЕЛОК. `preview-users` и `preview-login` повторяют
   разметку своего листа руками, потому что их листы клиентские и живут на
   fetch/useEffect — отрисовать их вне браузера нечем. Этот лист чисто
   серверный: ни одного хука, ни одного запроса, только текст. Значит его можно
   отрисовать НАСТОЯЩИЙ, и копия разметки была бы не вынужденной мерой, а
   вторым источником правды, который разъедется с первым на первой же правке.

   Отсюда и ценность файла: `renderToStaticMarkup` доказывает, что дерево
   собирается целиком — с реестром, разделами и всеми карточками. Без него
   «лист готов» держалось бы на том, что `tsc` промолчал. Здесь же стоит сторож
   на КРАТКОСТЬ листа (#157): он меряет настоящую отрисовку, а не исходник.

   Отдельно проверяется главное обещание иссуса #126: на листе НЕТ НИ ОДНОГО
   поля ввода и ни одной формы. Сохранять введённое некуда, и поле, молча
   теряющее набранное, — это ровно та карточка, которая выглядит рабочей и
   ничего не делает.

   Запуск смотрелки: PREVIEW_OUT=/tmp/integrations.html npx vitest run \
     lib/__tests__/preview-integrations.test.ts
   (CSS берётся у живой панели на 8790; без PREVIEW_OUT файл не пишется и в
   сеть тест не ходит.) */
import { describe, expect, it } from "vitest";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import * as fs from "node:fs";
import { IntegrationsView } from "@/components/views/IntegrationsView";
import { ALL_VENDORS } from "@/lib/integrations-registry";
import { NO_BACKEND_CONTEXT, connState, connStateLabel } from "@/lib/integrations";

const HTML = renderToStaticMarkup(createElement(IntegrationsView));

/** Текст, который виден без единого нажатия: содержимое раскрывашек выкинуто,
 *  подпись самой раскрывашки оставлена — её человек читает. */
function видноСразу(html: string): string {
  return html
    .replace(/<details[\s\S]*?<\/details>/g, (d) => (d.match(/<summary[\s\S]*?<\/summary>/) || [""])[0])
    .replace(/<[^>]+>/g, " ")
    .replace(/&[a-z#0-9]+;/g, "x")
    .replace(/\s+/g, " ")
    .trim();
}

function write(css: string) {
  const out = process.env.PREVIEW_OUT!;
  fs.writeFileSync(
    out,
    `<!doctype html><meta charset="utf-8"><title>Integrations</title>
<style>${css}</style>
<body class="bg-background text-foreground"><div class="py-4">${HTML}</div></body>`,
  );
  console.log("написано:", out);
}

describe("лист подключений рисуется целиком", () => {
  it("на экране есть каждый вендор реестра", () => {
    for (const v of ALL_VENDORS) expect(HTML, v.id).toContain(v.name);
  });

  it("состояние стоит у каждой карточки", () => {
    /* Глоссария трёх состояний внизу листа больше нет (#157): «Not connected»
       не нуждается в абзаце-расшифровке. А вот сам статус обязан быть на каждой
       карточке — без него лист перестаёт отвечать на вопрос, ради которого
       сделан. Считаем по числу карточек, а не по одному вхождению: пропавший
       статус у одной из них иначе не виден. */
    const карточек = (HTML.match(/<article/g) || []).length;
    const статусов = HTML.split(connStateLabel(connState(NO_BACKEND_CONTEXT))).length - 1;
    expect(карточек).toBeGreaterThan(0);
    expect(статусов).toBe(ALL_VENDORS.length);
  });

  it("лист остаётся коротким — текст не отрастает обратно", () => {
    /* РАЗБОР ВЛАДЕЛЬЦА 15.08 (#157): раздел выглядел большим и работающим за
       счёт объёма текста, хотя подключить нельзя ни одного источника. Объём
       пояснений — это обещание механизма, и его нельзя было удержать словами в
       шапке файла: текст дописывают по одному абзацу, каждый выглядит уместным.

       Считаем то, что человек видит БЕЗ нажатий: свёрнутое содержимое
       раскрывашек на экране не видно, и мерить им «стало короче» значило бы
       мерить тем, чего он не читает. Порог — с запасом над сегодняшним числом:
       сторож ловит возврат абзацев, а не правку формулировки. */
    const слов = видноСразу(HTML).split(" ").length;
    expect(слов).toBeLessThan(600);
  });

  it("дверь для самописного источника видна без раскрывания", () => {
    expect(HTML).toContain("Custom integration");
    expect(HTML).toContain("core/sources/");
  });

  it("НИ ОДНОГО поля ввода и ни одной формы", () => {
    // Главное обещание листа. Проверяется по отрисованному HTML, а не по
    // исходнику: поле могло бы приехать из любого вложенного компонента.
    expect(HTML).not.toMatch(/<input/i);
    expect(HTML).not.toMatch(/<form/i);
    expect(HTML).not.toMatch(/<textarea/i);
  });

  it("сказано вслух, что подключить сегодня нечем", () => {
    expect(HTML).toMatch(/Nothing can be connected from this page yet/);
  });

  it("рисует HTML, когда задан PREVIEW_OUT", async () => {
    if (!process.env.PREVIEW_OUT) {
      console.log("подключения: задай PREVIEW_OUT=/tmp/integrations.html, чтобы посмотреть");
      return;
    }
    /* Готовый css можно подсунуть файлом. Живая панель — источник ненадёжный:
       она отдаёт то, что лежит в её сборке, и сборка бывает битой (15.08 один
       из трёх её css-чанков отвечал 400, а два оставшихся весили полторы
       килобайты вместо ста сорока — смотрелка выходила без единого класса, и
       выглядело это как «вёрстка не работает», а не как «панель не собрана»). */
    if (process.env.PREVIEW_CSS) {
      write(fs.readFileSync(process.env.PREVIEW_CSS, "utf8"));
      return;
    }
    const base = process.env.PREVIEW_BASE || "http://localhost:8790";
    const page = await fetch(base + "/accounts").then((r) => r.text());
    const hrefs = [...page.matchAll(/\/_next\/static\/css\/[^"]+\.css/g)].map((m) => m[0]);
    /* Отдавший НЕ 200 кусок пропускаем. Живая панель на 8790 отдаёт 400 на
       один из своих же css-чанков, и его тело — html страницы ошибки, внутри
       которой есть `</style>`. Вклеенное в `<style>`, оно закрывает стиль
       раньше времени: смотрелка выходит без единого класса Tailwind и с
       текстом ошибки посреди страницы, а выглядит это как «вёрстка сломана». */
    const css = (
      await Promise.all(
        [...new Set(hrefs)].map((h) =>
          fetch(base + h).then((r) => (r.ok ? r.text() : "")),
        ),
      )
    ).join("\n");
    write(css);
  });
});
