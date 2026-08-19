/* Смотрелка логотипа — тот же приём, что у листа кабинетов. Без PREVIEW_OUT
   ничего не рисует и говорит, как её запустить. */
import { describe, it } from "vitest";
import * as fs from "node:fs";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { Logo, LogoMark } from "@/components/brand/Logo";

async function panelCss(base = "http://localhost:8790"): Promise<string> {
  const page = await fetch(base + "/accounts").then((r) => r.text());
  const hrefs = [...page.matchAll(/\/_next\/static\/css\/[^"]+\.css/g)].map((m) => m[0]);
  const files = await Promise.all(
    [...new Set(hrefs)].map((h) => fetch(base + h).then((r) => r.text())),
  );
  return files.join("\n");
}

describe("смотрелка логотипа", () => {
  it("рисует HTML, когда задан PREVIEW_OUT", async () => {
    if (!process.env.PREVIEW_OUT) {
      console.log("логотип: задай PREVIEW_OUT=/tmp/logo.html, чтобы посмотреть");
      return;
    }
    const sizes = [64, 40, 28, 20, 16];
    const block = (label: string, node: string) =>
      `<div style="display:flex;align-items:center;gap:18px;padding:10px 0">
         <span style="width:96px;font:11px system-ui;opacity:.5">${label}</span>${node}</div>`;
    const body =
      sizes.map((h) =>
        block(`Logo ${h}px`,
          renderToStaticMarkup(createElement(Logo, { className: `block` })).replace(
            "<svg", `<svg style="height:${h}px;width:auto"`))).join("") +
      `<hr style="margin:20px 0;border:0;border-top:1px solid #8883">` +
      sizes.map((h) =>
        block(`Mark ${h}px`,
          renderToStaticMarkup(createElement(LogoMark, { className: `block` })).replace(
            "<svg", `<svg style="height:${h}px;width:auto"`))).join("");
    /* Главный вопрос по месту, а не по картинке: ВЛЕЗАЕТ ли подпись в сайдбар.
       Он 232px развёрнутый и 60px свёрнутый, а пропорция логотипа 8:1 — при
       высоте 20px слово занимает 160px, и это надо видеть, а не считать. */
    const rail = (w: number, inner: string, label: string) =>
      `<div style="margin:6px 0 18px">
         <div style="font:11px system-ui;opacity:.5;margin-bottom:6px">${label}</div>
         <div class="border-r border-border" style="width:${w}px;height:96px">
           <div style="padding:14px 12px">${inner}</div></div></div>`;
    const railBlock =
      rail(232, renderToStaticMarkup(createElement(Logo, {}))
             .replace("<svg", `<svg style="height:20px;width:auto"`),
           "сайдбар развёрнутый, 232px") +
      rail(60, `<div style="display:flex;justify-content:center">` +
             renderToStaticMarkup(createElement(LogoMark, {}))
               .replace("<svg", `<svg style="height:24px;width:auto"`) + `</div>`,
           "сайдбар свёрнутый, 60px");

    const css = await panelCss();
    const page = (theme: string) =>
      `<!doctype html><html data-theme="${theme}"><meta charset="utf-8">` +
      `<title>logo · ${theme}</title><style>${css}</style>` +
      `<body class="bg-background text-foreground" style="padding:28px">${railBlock}<hr style="margin:20px 0;border:0;border-top:1px solid #8883">${body}</body></html>`;
    const out = process.env.PREVIEW_OUT!;
    fs.writeFileSync(out, page("light"));
    fs.writeFileSync(out.replace(/\.html$/, "") + "-dark.html", page("dark"));
  });
});
