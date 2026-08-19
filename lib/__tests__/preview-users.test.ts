/* Смотрелка листа «Users». Рисует состояния, которых ни один юнит-тест не ловит:
   список из нескольких учёток (админ, обычный, погашенный), форму заведения и
   экран «учётка заведена, вот ссылка» — тот самый момент, который обязан быть
   невозможно не заметить (см. шапку `app/users/UsersView.tsx`).

   Разметка повторяет UsersView.tsx classNames-в-classNames. Сама страница сюда не
   импортируется по тем же причинам, что и в preview-login.test.ts: она клиентская
   и живёт на fetch/useEffect, а не на пропсах — смотрелка проверяет РАЗМЕТКУ И
   ТЕКСТЫ, а не поведение (что кнопка правда шлёт запрос, здесь не доказано).

   Запуск: PREVIEW_OUT=/tmp/users.html npx vitest run lib/__tests__/preview-users.test.ts */
import { describe, it } from "vitest";
import * as fs from "node:fs";

async function panelCss(base = "http://localhost:8790"): Promise<string> {
  const page = await fetch(base + "/accounts").then((r) => r.text());
  const hrefs = [...page.matchAll(/\/_next\/static\/css\/[^"]+\.css/g)].map((m) => m[0]);
  const files = await Promise.all(
    [...new Set(hrefs)].map((h) => fetch(base + h).then((r) => r.text())),
  );
  return files.join("\n");
}

const ROW_BTN =
  "focus-ring flex min-h-8 items-center gap-1.5 whitespace-nowrap rounded-lg border border-border " +
  "bg-card px-2.5 text-xs outline-none transition-colors duration-150 hover:border-border-strong " +
  "disabled:opacity-40";

/** Строка листа — те же три судьбы, что просит иссус: админ (я), обычный
 *  активный и погашенный. */
function row(opts: {
  name: string;
  email: string;
  role: "admin" | "user";
  status: string;
  created: string;
  lastSeen: string;
  you?: boolean;
  neverSignedIn?: boolean;
  guardTitle?: string;
}) {
  const suspended = opts.status === "suspended";
  return `
    <tr class="border-b border-border/40 last:border-0 hover:bg-hover">
      <td class="max-w-0 min-w-[180px] px-2 py-2">
        <div class="flex min-w-0 items-center gap-1.5">
          <span class="truncate text-sm">${opts.name}</span>
          ${opts.you ? `<span class="flex-none rounded border border-border-strong px-1 text-2xs text-muted-foreground">you</span>` : ""}
        </div>
        <div class="truncate font-mono text-2xs text-muted-foreground">${opts.email}</div>
      </td>
      <td class="px-2 py-2">
        ${
          opts.role === "admin"
            ? `<span class="inline-flex items-center gap-1 text-xs font-medium text-foreground">✓ admin</span>`
            : `<span class="text-xs text-muted-foreground">member</span>`
        }
      </td>
      <td class="px-2 py-2">
        <span class="inline-flex items-center gap-1.5 text-xs ${suspended ? "text-muted-foreground" : "text-success"}">
          <span class="size-1.5 flex-none rounded-full ${suspended ? "bg-muted-foreground" : "bg-success"}"></span>
          ${opts.status}
        </span>
      </td>
      <td class="tnum px-2 py-2 text-xs text-muted-foreground">${opts.created}</td>
      <td class="tnum px-2 py-2 text-xs text-muted-foreground">${opts.lastSeen}</td>
      <td class="px-2 py-2 align-top">
        <div class="flex flex-col items-start gap-1">
          <div class="flex flex-wrap gap-1.5">
            ${opts.neverSignedIn ? `<button class="${ROW_BTN}">Resend invite</button>` : ""}
            <button class="${ROW_BTN} ${!suspended ? "text-destructive hover:border-destructive/50" : ""}" ${opts.guardTitle ? `title="${opts.guardTitle}" disabled` : ""}>
              ${suspended ? "Turn on" : "Turn off"}
            </button>
            <button class="${ROW_BTN} text-destructive hover:border-destructive/50" ${opts.you ? `title="You cannot delete your own account — another admin can do it for you." disabled` : ""}>
              Delete
            </button>
          </div>
        </div>
      </td>
    </tr>`;
}

const USER_COLS = [
  ["person", 260],
  ["role", 90],
  ["status", 120],
  ["created", 130],
  ["last sign-in", 130],
  ["actions", 260],
] as const;

function listScreen() {
  return `<div style="width:900px">
    <div class="mb-3 flex flex-wrap items-center gap-3">
      <h1 class="display text-lg leading-none">Users</h1>
      <span class="tnum text-xs text-muted-foreground">3 accounts</span>
      <span class="tnum text-xs text-muted-foreground">workspace #1</span>
      <button class="focus-ring ml-auto flex h-8 items-center gap-1.5 rounded-lg bg-primary px-3 text-xs font-medium text-primary-foreground">New account</button>
    </div>
    <div class="overflow-x-auto rounded-xl border border-border bg-card">
      <table class="w-full min-w-[900px] table-fixed border-collapse text-sm">
        <thead class="sticky top-0 z-10 bg-elevated/95 backdrop-blur">
          <tr class="border-b border-border text-left">
            ${USER_COLS.map(([t, w]) => `<th style="width:${w}px" class="microlabel px-2 py-2 text-2xs text-muted-foreground">${t}</th>`).join("")}
          </tr>
        </thead>
        <tbody>
          ${row({ name: "Dana Frost", email: "dana@obelista.com", role: "admin", status: "active", created: "3 Aug", lastSeen: "12 min ago", you: true })}
          ${row({ name: "Ivan Petrov", email: "ivan@obelista.com", role: "user", status: "active", created: "10 Aug", lastSeen: "never", neverSignedIn: true })}
          ${row({ name: "Grace Lee", email: "grace@obelista.com", role: "user", status: "suspended", created: "1 Aug", lastSeen: "2 d ago" })}
        </tbody>
      </table>
    </div>
  </div>`;
}

/* Гейт: тот, кого auth.me() не подтвердил админом, видит только эту строку —
   ни списка, ни формы, ни одного вызова к чужим данным. */
function blockedScreen() {
  return `<div style="width:420px;text-align:center;padding-top:48px">
    <p class="text-sm font-medium text-foreground">That is available to admins only.</p>
  </div>`;
}

function dialogChrome(title: string, body: string) {
  return `<div style="width:420px;border-radius:12px" class="border border-border bg-card p-0">
    <div class="flex flex-col gap-3.5 p-4">
      <div class="flex items-start justify-between gap-2">
        <h2 class="text-base font-semibold text-foreground">${title}</h2>
        <span class="text-muted-foreground">✕</span>
      </div>
      ${body}
    </div>
  </div>`;
}

function formScreen() {
  const field = (label: string, type: string, value: string, placeholder: string) => `
    <label class="flex flex-col gap-1.5">
      <span class="microlabel">${label}</span>
      <input type="${type}" value="${value}" placeholder="${placeholder}"
        class="focus-ring h-9 rounded-lg border border-border bg-input px-3 text-[13.5px] text-foreground outline-none placeholder:text-ghost">
    </label>`;
  return dialogChrome(
    "New account",
    `<form class="flex flex-col gap-3.5">
      ${field("name", "text", "", "Jane Doe")}
      ${field("email", "email", "", "jane@company.com")}
      <div class="flex flex-col gap-1.5">
        <span class="microlabel">role</span>
        <div class="inline-flex w-fit rounded-lg border border-border p-0.5 text-xs">
          <span class="rounded-md bg-primary px-3 py-1 text-primary-foreground">Member</span>
          <span class="px-3 py-1 text-muted-foreground">Admin</span>
        </div>
      </div>
      <div class="min-h-[34px]"></div>
      <div class="focus-ring grid h-9 place-items-center rounded-lg bg-primary text-[13.5px] font-medium text-primary-foreground">Create account</div>
    </form>`,
  );
}

/* email_taken — у поля почты, не общим сообщением (иссус #18 требует это прямо). */
function formEmailTakenScreen() {
  const field = (label: string, type: string, value: string, placeholder: string, err?: string) => `
    <label class="flex flex-col gap-1.5">
      <span class="microlabel">${label}</span>
      <input type="${type}" value="${value}" placeholder="${placeholder}"
        class="focus-ring h-9 rounded-lg border border-border bg-input px-3 text-[13.5px] text-foreground outline-none placeholder:text-ghost">
      ${err ? `<div class="min-h-[18px]"><p class="text-2xs leading-snug text-destructive">${err}</p></div>` : ""}
    </label>`;
  return dialogChrome(
    "New account",
    `<form class="flex flex-col gap-3.5">
      ${field("name", "text", "Jane Doe", "Jane Doe")}
      ${field("email", "email", "jane@company.com", "jane@company.com", "An account with that email already exists.")}
      <div class="flex flex-col gap-1.5">
        <span class="microlabel">role</span>
        <div class="inline-flex w-fit rounded-lg border border-border p-0.5 text-xs">
          <span class="rounded-md bg-primary px-3 py-1 text-primary-foreground">Member</span>
          <span class="px-3 py-1 text-muted-foreground">Admin</span>
        </div>
      </div>
      <div class="min-h-[34px]"></div>
      <div class="focus-ring grid h-9 place-items-center rounded-lg bg-primary text-[13.5px] font-medium text-primary-foreground">Create account</div>
    </form>`,
  );
}

/* Момент, ради которого написан весь лист: ссылку нельзя не заметить, и рядом
   сказано, до какого часа она годна и что делать, если её потеряли. */
function createdScreen() {
  return dialogChrome(
    "Share this link",
    `<div class="flex flex-col gap-3">
      <p class="text-[13px] leading-relaxed text-muted-foreground">This is the only way to give Jane Doe access — copy the link now and share it however you like. It will not be shown again; if it gets lost, come back to this list and resend a new one.</p>
      <div class="flex items-stretch gap-2">
        <input readonly value="https://app.obelista.com/invite?token=9f3a7c2e1b6d4a58"
          class="focus-ring h-9 min-w-0 flex-1 rounded-lg border border-border bg-input px-3 font-mono text-xs text-foreground outline-none">
        <div class="focus-ring flex h-9 flex-none items-center gap-1.5 rounded-lg bg-primary px-3 text-xs font-medium text-primary-foreground">Copy</div>
      </div>
      <p class="text-2xs text-muted-foreground">Works until <span class="tnum">16 Aug 09:14</span>.</p>
      <div class="focus-ring grid h-9 place-items-center rounded-lg border border-border bg-card text-[13.5px] font-medium text-foreground">Done</div>
    </div>`,
  );
}

/* Вопрос перед необратимым (#158). Он спрашивает не «уверены?» — на это все
   отвечают «да» не читая, — а требует набрать почту руками: единственное
   действие, которым нельзя промахнуться по соседней строке. Рядом сказано, что
   именно уносится, потому что иначе человек узнает об этом уже после. */
function deleteScreen() {
  return dialogChrome(
    "Delete account",
    `<div class="flex flex-col gap-3.5">
      <p class="text-[13px] leading-relaxed text-muted-foreground">
        <span class="font-medium text-foreground">Grace Lee</span> will be removed from this
        workspace for good, together with their open sessions, any invitation links, and their
        sign-in history. They will disappear from this list and will not be able to sign in.
        This cannot be undone — the only way back is creating the account again, from scratch.
      </p>
      <label class="flex flex-col gap-1.5">
        <span class="microlabel">type grace@obelista.com to confirm</span>
        <input type="text" value="" placeholder="grace@obelista.com"
          class="focus-ring h-9 rounded-lg border border-border bg-input px-3 font-mono text-[13px] text-foreground outline-none placeholder:text-ghost">
      </label>
      <div class="min-h-[18px]"></div>
      <div class="flex items-center justify-end gap-2">
        <div class="focus-ring grid h-9 place-items-center rounded-lg border border-border bg-card px-3 text-[13.5px] font-medium text-foreground">Cancel</div>
        <div class="focus-ring grid h-9 place-items-center rounded-lg bg-destructive px-3 text-[13.5px] font-medium text-destructive-foreground opacity-40">Delete account</div>
      </div>
    </div>`,
  );
}

describe("смотрелка листа Users", () => {
  it("рисует HTML, когда задан PREVIEW_OUT", async () => {
    if (!process.env.PREVIEW_OUT) {
      console.log("users: задай PREVIEW_OUT=/tmp/users.html, чтобы посмотреть");
      return;
    }
    const cols = [
      listScreen(), blockedScreen(), formScreen(), formEmailTakenScreen(), createdScreen(),
      deleteScreen(),
    ].join("");
    const css = await panelCss();
    const page = (theme: string) =>
      `<!doctype html><html data-theme="${theme}"><meta charset="utf-8">` +
      `<title>users · ${theme}</title><style>${css}</style>` +
      `<body class="bg-background text-foreground" style="padding:28px">` +
      `<div style="display:flex;gap:44px;align-items:flex-start;flex-wrap:wrap">${cols}</div></body></html>`;
    const out = process.env.PREVIEW_OUT!;
    fs.writeFileSync(out, page("light"));
    fs.writeFileSync(out.replace(/\.html$/, "") + "-dark.html", page("dark"));
  });
});
