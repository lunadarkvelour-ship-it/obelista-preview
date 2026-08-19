/* Смотрелка ШАПКИ, а не логотипа. Разница дорогая: 14.08 логотип в отдельной
   смотрелке выглядел правильно, а на живой панели шапка рисовала совсем другой
   знак — потому что в панели их было два, и шапка брала не тот. Компонент в
   вакууме выглядит правильно ровно тогда, когда сломан контекст.

   Запуск: PREVIEW_OUT=/tmp/shell.html npx vitest run lib/__tests__/preview-shell.test.ts */
import { describe, it } from "vitest";
import * as fs from "node:fs";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { Topbar } from "@/components/studio/Topbar";

async function panelCss(base = "http://localhost:8790"): Promise<string> {
  const page = await fetch(base + "/accounts").then((r) => r.text());
  const hrefs = [...page.matchAll(/\/_next\/static\/css\/[^"]+\.css/g)].map((m) => m[0]);
  const files = await Promise.all(
    [...new Set(hrefs)].map((h) => fetch(base + h).then((r) => r.text())),
  );
  return files.join("\n");
}

describe("смотрелка шапки", () => {
  it("рисует HTML, когда задан PREVIEW_OUT", async () => {
    if (!process.env.PREVIEW_OUT) {
      console.log("шапка: задай PREVIEW_OUT=/tmp/shell.html, чтобы посмотреть");
      return;
    }
    const body = renderToStaticMarkup(createElement(Topbar));
    const css = await panelCss();
    const page = (theme: string) =>
      `<!doctype html><html data-theme="${theme}"><meta charset="utf-8">` +
      `<title>shell · ${theme}</title><style>${css}</style>` +
      `<body class="bg-background text-foreground">${body}` +
      `<p style="padding:24px;font:13px system-ui;opacity:.6">` +
      `Ниже — пусто намеренно: смотрим шапку.</p></body></html>`;
    const out = process.env.PREVIEW_OUT!;
    fs.writeFileSync(out, page("light"));
    fs.writeFileSync(out.replace(/\.html$/, "") + "-dark.html", page("dark"));
  });
});
