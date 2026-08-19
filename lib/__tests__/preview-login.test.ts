/* Смотрелка экрана входа. Рисует ЧЕТЫРЕ состояния сразу: чистая форма, форма с
   отказом, «сессия истекла» и экран сброса после отправки. Их четыре, потому что
   на живом сайте человек попадает в каждое, а увидеть их по одному, кликая, —
   значит увидеть три из четырёх и решить, что готово.

   Запуск: PREVIEW_OUT=/tmp/login.html npx vitest run lib/__tests__/preview-login.test.ts */
import { describe, it } from "vitest";
import * as fs from "node:fs";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { Logo } from "@/components/brand/Logo";
import { authErrorText } from "@/lib/auth-copy";

async function panelCss(base = "http://localhost:8790"): Promise<string> {
  const page = await fetch(base + "/accounts").then((r) => r.text());
  const hrefs = [...page.matchAll(/\/_next\/static\/css\/[^"]+\.css/g)].map((m) => m[0]);
  const files = await Promise.all(
    [...new Set(hrefs)].map((h) => fetch(base + h).then((r) => r.text())),
  );
  return files.join("\n");
}

/* Разметка повторяет app/login/page.tsx. Сама страница сюда не импортируется:
   она клиентская и висит на useRouter/useSearchParams, которых вне Next нет.
   Значит смотрелка проверяет РАСКЛАДКУ И ТЕКСТЫ, а не поведение формы, — и об
   этом надо помнить, читая её: она не докажет, что кнопка отправляет. */
const logo = renderToStaticMarkup(createElement(Logo, { className: "h-5 w-auto" }));

function screen(opts: { title: string; sub: string; error?: string; sent?: boolean }) {
  const field = (label: string, extra = "", type = "text", value = "") => `
    <label class="flex flex-col gap-1.5">
      <span class="flex items-baseline justify-between"><span class="microlabel">${label}</span>${extra}</span>
      <input type="${type}" value="${value}" placeholder="you@company.com"
        class="focus-ring h-9 rounded-lg border border-border bg-input px-3 text-[13.5px] text-foreground outline-none placeholder:text-ghost">
    </label>`;
  const body = opts.sent
    ? `<p class="mt-2.5 text-[13px] leading-relaxed text-muted-foreground">If that address has an account, a reset link is on its way.</p>
       <p class="mt-3 rounded-lg border border-border bg-card px-3 py-2.5 text-[12.5px] leading-relaxed text-muted-foreground">Email delivery is not switched on yet. Until it is, the way to get back in is to ask your admin for a fresh invitation link — it works the same way.</p>
       <a class="mt-6 inline-block text-[12.5px] text-primary-ink underline underline-offset-2">Back to sign in</a>`
    : `<form class="mt-7 flex flex-col gap-3.5">
         ${field("email")}
         ${field("password", `<span class="text-2xs text-muted-foreground">show</span>`, "password", "")}
         <div class="min-h-[34px]">${opts.error ? `<p class="text-[12.5px] leading-snug text-destructive">${opts.error}</p>` : ""}</div>
         <div class="focus-ring grid h-9 place-items-center rounded-lg bg-primary text-[13.5px] font-medium text-primary-foreground">Sign in</div>
       </form>
       <p class="mt-6 text-[12.5px] text-muted-foreground">Forgot your password? <span class="text-primary-ink underline underline-offset-2">Reset it</span>.</p>
       <p class="mt-8 text-[11.5px] leading-relaxed text-muted-foreground">Your password is stored in a form that cannot be turned back — nobody at Obelista can read it, and we never ask you for it. <span class="underline underline-offset-2">Privacy</span></p>`;
  return `<div style="width:356px">
    <div class="mb-9 text-foreground">${logo}</div>
    <h1 class="font-heading text-[22px] font-semibold tracking-tight text-foreground">${opts.title}</h1>
    <p class="mt-1.5 text-[13px] text-muted-foreground">${opts.sub}</p>
    ${body}</div>`;
}

describe("смотрелка экрана входа", () => {
  it("рисует HTML, когда задан PREVIEW_OUT", async () => {
    if (!process.env.PREVIEW_OUT) {
      console.log("вход: задай PREVIEW_OUT=/tmp/login.html, чтобы посмотреть");
      return;
    }
    const cols = [
      screen({ title: "Sign in", sub: "Accounts are created by your admin — there is no sign-up here." }),
      screen({ title: "Sign in", sub: "Accounts are created by your admin — there is no sign-up here.", error: authErrorText("bad_pair") }),
      screen({ title: "Sign in", sub: authErrorText("session_expired") }),
      screen({ title: "Reset your password", sub: "", sent: true }),
    ].join("");
    const css = await panelCss();
    const page = (theme: string) =>
      `<!doctype html><html data-theme="${theme}"><meta charset="utf-8">` +
      `<title>login · ${theme}</title><style>${css}</style>` +
      `<body class="bg-background text-foreground" style="padding:28px">` +
      `<div style="display:flex;gap:44px;align-items:flex-start;flex-wrap:wrap">${cols}</div></body></html>`;
    const out = process.env.PREVIEW_OUT!;
    fs.writeFileSync(out, page("light"));
    fs.writeFileSync(out.replace(/\.html$/, "") + "-dark.html", page("dark"));
  });
});
