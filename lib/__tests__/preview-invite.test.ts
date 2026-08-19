/* Смотрелка экрана приглашения. Рисует ЧЕТЫРЕ состояния сразу: годная ссылка
   (форма), invite_used, invite_expired и weak_password после отправки. Их четыре,
   потому что на живом сайте человек попадает в каждое, а увидеть их по одному,
   кликая, — значит увидеть три из четырёх и решить, что готово.

   Запуск: PREVIEW_OUT=/tmp/invite.html npx vitest run lib/__tests__/preview-invite.test.ts */
import { describe, it } from "vitest";
import * as fs from "node:fs";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { Logo } from "@/components/brand/Logo";
import { authErrorText, passwordRule } from "@/lib/auth-copy";

async function panelCss(base = "http://localhost:8790"): Promise<string> {
  const page = await fetch(base + "/accounts").then((r) => r.text());
  const hrefs = [...page.matchAll(/\/_next\/static\/css\/[^"]+\.css/g)].map((m) => m[0]);
  const files = await Promise.all(
    [...new Set(hrefs)].map((h) => fetch(base + h).then((r) => r.text())),
  );
  return files.join("\n");
}

/* Разметка повторяет app/invite/page.tsx. Сама страница сюда не импортируется:
   она клиентская и висит на useRouter/useSearchParams, которых вне Next нет.
   Значит смотрелка проверяет РАСКЛАДКУ И ТЕКСТЫ, а не поведение формы, — и об
   этом надо помнить, читая её: она не докажет, что checkInvite и правда зовётся
   первым или что отправка формы работает. */
const logo = renderToStaticMarkup(createElement(Logo, { className: "h-5 w-auto" }));

/** Один из трёх концов приглашения: заголовок, текст и необязательное действие —
 *  повторяет `EndScreen` из самой страницы. */
function endScreen(title: string, text: string, action = "") {
  return `<h1 class="font-heading text-[22px] font-semibold tracking-tight text-foreground">${title}</h1>
    <p class="mt-2.5 text-[13px] leading-relaxed text-muted-foreground">${text}</p>
    ${action}`;
}

/** Форма установки пароля: правило видно ДО поля, ошибка (если есть) — под ним. */
function formScreen(opts: { email: string; error?: string }) {
  return `<h1 class="font-heading text-[22px] font-semibold tracking-tight text-foreground">Set your password</h1>
    <p class="mt-1.5 text-[13px] text-muted-foreground">Create a password for ${opts.email}.</p>
    <p class="mt-3 text-[12.5px] leading-relaxed text-muted-foreground">${passwordRule(10)}</p>
    <form class="mt-5 flex flex-col gap-3.5">
      <label class="flex flex-col gap-1.5">
        <span class="flex items-baseline justify-between"><span class="microlabel">password</span><span class="text-2xs text-muted-foreground">show</span></span>
        <input type="password" value=""
          class="focus-ring h-9 rounded-lg border border-border bg-input px-3 text-[13.5px] text-foreground outline-none placeholder:text-ghost">
      </label>
      <div class="min-h-[34px]">${opts.error ? `<p class="text-[12.5px] leading-snug text-destructive">${opts.error}</p>` : ""}</div>
      <div class="focus-ring grid h-9 place-items-center rounded-lg bg-primary text-[13.5px] font-medium text-primary-foreground">Set password</div>
    </form>
    <p class="mt-8 text-[11.5px] leading-relaxed text-muted-foreground">Your password is stored in a form that cannot be turned back — nobody at Obelista can read it, and we never ask you for it. <span class="underline underline-offset-2">Privacy</span></p>`;
}

function screen(inner: string) {
  return `<div style="width:356px">
    <div class="mb-9 text-foreground">${logo}</div>
    ${inner}</div>`;
}

describe("смотрелка экрана приглашения", () => {
  it("рисует HTML, когда задан PREVIEW_OUT", async () => {
    if (!process.env.PREVIEW_OUT) {
      console.log("приглашение: задай PREVIEW_OUT=/tmp/invite.html, чтобы посмотреть");
      return;
    }
    const cols = [
      screen(formScreen({ email: "dana@example.com" })),
      screen(
        endScreen(
          "Already set",
          authErrorText("invite_used"),
          `<a class="mt-6 inline-block text-[12.5px] text-primary-ink underline underline-offset-2">Go to sign in</a>`,
        ),
      ),
      screen(endScreen("Link expired", authErrorText("invite_expired"))),
      screen(formScreen({ email: "dana@example.com", error: authErrorText("weak_password") })),
    ].join("");
    const css = await panelCss();
    const page = (theme: string) =>
      `<!doctype html><html data-theme="${theme}"><meta charset="utf-8">` +
      `<title>invite · ${theme}</title><style>${css}</style>` +
      `<body class="bg-background text-foreground" style="padding:28px">` +
      `<div style="display:flex;gap:44px;align-items:flex-start;flex-wrap:wrap">${cols}</div></body></html>`;
    const out = process.env.PREVIEW_OUT!;
    fs.writeFileSync(out, page("light"));
    fs.writeFileSync(out.replace(/\.html$/, "") + "-dark.html", page("dark"));
  });
});
