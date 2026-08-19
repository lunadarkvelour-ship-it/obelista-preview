"use client";

/* Лист «Users» — админский ростер: кто есть, кого завести, кого погасить/включить
 * обратно, кому перевыдать приглашение. Иссус #18 (блок Е плана переезда в облако,
 * `docs/PLAN-pereezd-v-oblako.md`), контракт — уже готовый клиент `lib/auth.ts` и
 * тексты `lib/auth-copy.ts` (оба отданы другим коммитом; этот лист их только читает).
 *
 * ГЛАВНОЕ ПРАВИЛО ЭКРАНА: админ НЕ задаёт пароль и не видит его никогда. Сервер
 * возвращает ССЫЛКУ-приглашение целиком, и она — единственный способ передать
 * доступ. Это исполнение обещания /privacy («никто в Обелисте не может прочитать
 * ваш пароль»), а не вопрос удобства. Отсюда и вид экрана «created» в диалоге ниже:
 * ссылка показывается один раз, крупно, с кнопкой копирования, и текст на экране
 * прямо говорит, что второй раз посмотреть её нельзя — лечение потери это
 * «перевыдать» (`auth.reinvite`), а не «показать снова».
 *
 * ЧЕГО ЗДЕСЬ НЕТ И НЕ БУДЕТ: поля «пароль» в любом виде, кнопки «показать пароль
 * пользователя», слова «восстановить». Не забыли — это прямое следствие того же
 * обещания.
 *
 * УДАЛЕНИЕ (#158) — НЕ «ГАШЕНИЕ ПОСИЛЬНЕЕ», И ЭКРАН ОБЯЗАН ЭТО ПОКАЗЫВАТЬ. Погашенного
 * включают обратно соседней кнопкой; удалённого нет нигде — ни в списке, ни во входе,
 * ни в журнале попыток, — и вернуть его нечем. Поэтому кнопка «Delete» стоит отдельно
 * от пары «Turn off/Turn on», а не вместо неё, и ведёт не к действию, а к вопросу: в
 * диалоге сказано, что именно уносится, и чтобы кнопка подтверждения ожила, надо
 * набрать почту человека руками. Это не церемония: строки в этом листе похожи одна на
 * другую, промах мышью здесь стоит чужой учётки вместе с её историей, а «отменить»
 * нет. Сервер про подтверждение не знает и знать не может — отличить осознанное
 * нажатие от промаха он не в состоянии, это работа экрана.
 *
 * ЛИСТ ВИДЕН ТОЛЬКО АДМИНУ, и это не украшение: `auth.me()` спрашивается первым, и
 * пока роль не подтверждена как `admin` — ни одна другая ручка (`listUsers` и
 * далее) не зовётся вовсе. На 403 в ответ на нажатие эта страница не полагается:
 * кнопки, которые сама же не показала бы неадмину, здесь не существует. Пункт меню
 * в `leaves.ts` виден всем (Sidebar о ролях не знает, это не в границах этого
 * листа) — но зашедший без роли увидит только короткое сообщение ниже, ни одного
 * реального вызова к чужим данным при этом не происходит.
 */

import * as React from "react";
import { Ban, Check, Copy, RotateCcw, Send, ShieldCheck, Trash2, UserPlus, X } from "lucide-react";
import { PAGE_PAD, PAGE_WIDTH } from "@/components/shell/page";
import { MotionDialog } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Segmented } from "@/components/ui/segmented";
import { auth, type AdminUser, type AuthUser } from "@/lib/auth";
import { authErrorText } from "@/lib/auth-copy";
import { whenShort } from "@/lib/analytics";
import { ageWords } from "@/lib/staleness";
import { copyText } from "@/lib/output";
import { cn } from "@/lib/utils";

type Gate = "checking" | "blocked" | "admin";
type DialogScreen = "form" | "created";

interface CreatedInvite {
  user: AuthUser;
  inviteUrl: string;
  expiresAt: string | null;
}

/** `status` — свободная строка с сервера (см. шапку `lib/auth.ts`): панель не
 *  заводит свой словарь состояний и показывает то, что пришло как есть. Но кнопке
 *  «выключить/включить» всё равно надо на чём-то решать — известное слово ровно
 *  одно, "suspended"; всё прочее (в том числе ещё не изобретённое сервером третье
 *  слово) ведём себя как активное. Это безопасный дефолт: молчаливо считать чужую
 *  рабочую учётку выключенной опаснее, чем один раз показать лишнюю кнопку
 *  «выключить» тому, кто и так активен. */
function isSuspended(status: string): boolean {
  return status.trim().toLowerCase() === "suspended";
}

function sameEmail(a: string, b: string): boolean {
  return a.trim().toLowerCase() === b.trim().toLowerCase();
}

/** «никогда» вместо `ageWords`-евского «unknown time»: пустая дата тут значит
 *  «ещё не заходил», а не «дата битая» — разные вещи, разные слова. */
function lastSeenText(iso?: string | null): string {
  if (!iso) return "never";
  return ageWords(iso);
}

const USER_COLS: Array<{ id: string; title: string; w: number }> = [
  { id: "person", title: "person", w: 260 },
  { id: "role", title: "role", w: 90 },
  { id: "status", title: "status", w: 120 },
  { id: "created", title: "created", w: 130 },
  { id: "last-signin", title: "last sign-in", w: 130 },
  { id: "actions", title: "actions", w: 320 },
];

const ROW_BTN =
  "focus-ring flex min-h-8 items-center gap-1.5 whitespace-nowrap rounded-lg border border-border " +
  "bg-card px-2.5 text-xs outline-none transition-colors duration-150 hover:border-border-strong " +
  "disabled:opacity-40";

export function UsersView() {
  const [gate, setGate] = React.useState<Gate>("checking");
  const [self, setSelf] = React.useState<AuthUser | null>(null);

  const [rows, setRows] = React.useState<AdminUser[] | null>(null);
  const [listPending, setListPending] = React.useState(false);
  const [listError, setListError] = React.useState<string | null>(null);

  const [dialogOpen, setDialogOpen] = React.useState(false);
  const [screen, setScreen] = React.useState<DialogScreen>("form");
  const [name, setName] = React.useState("");
  const [email, setEmail] = React.useState("");
  const [role, setRole] = React.useState<"user" | "admin">("user");
  const [formBusy, setFormBusy] = React.useState(false);
  const [formError, setFormError] = React.useState<string | null>(null);
  const [emailFieldError, setEmailFieldError] = React.useState<string | null>(null);
  const [created, setCreated] = React.useState<CreatedInvite | null>(null);
  const [copied, setCopied] = React.useState(false);

  const [actionBusyId, setActionBusyId] = React.useState<string | null>(null);
  const [actionError, setActionError] = React.useState<{ id: string; text: string } | null>(null);

  /* Удаление живёт своим состоянием, а не общим `dialogOpen`: у него другой конец
     (ничего не показать после) и другая цена промаха. Смешать их значило бы
     однажды открыть диалог удаления вместо экрана со ссылкой. */
  const [toDelete, setToDelete] = React.useState<AdminUser | null>(null);
  const [confirmEmail, setConfirmEmail] = React.useState("");
  const [deleteBusy, setDeleteBusy] = React.useState(false);
  const [deleteError, setDeleteError] = React.useState<string | null>(null);

  /* Гейт — первым делом, и это ЕДИНСТВЕННЫЙ вызов, который делает неадмин. Пока
     роль не подтверждена, ни `listUsers`, ни что-либо ещё не зовётся. */
  React.useEffect(() => {
    let живо = true;
    void auth
      .me()
      .then((r) => {
        if (!живо) return;
        if (r.ok && r.user.role === "admin") {
          setSelf(r.user);
          setGate("admin");
        } else {
          setGate("blocked");
        }
      })
      .catch(() => {
        if (живо) setGate("blocked");
      });
    return () => {
      живо = false;
    };
  }, []);

  const load = React.useCallback(async () => {
    setListPending(true);
    setListError(null);
    const r = await auth.listUsers();
    if (r.ok) setRows(r.users);
    else setListError(authErrorText(r.code));
    setListPending(false);
  }, []);

  React.useEffect(() => {
    if (gate === "admin") void load();
  }, [gate, load]);

  const openCreate = () => {
    setScreen("form");
    setCreated(null);
    setName("");
    setEmail("");
    setRole("user");
    setFormError(null);
    setEmailFieldError(null);
    setDialogOpen(true);
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (formBusy) return;
    setFormError(null);
    setEmailFieldError(null);
    if (!email.trim() || !name.trim()) {
      setFormError(authErrorText("empty_fields"));
      return;
    }
    setFormBusy(true);
    try {
      const r = await auth.createUser(email.trim(), name.trim(), role);
      if (r.ok) {
        setCreated({ user: r.user, inviteUrl: r.inviteUrl, expiresAt: r.expiresAt });
        setCopied(false);
        setScreen("created");
        void load();
        return;
      }
      // email_taken/bad_email — у поля почты, не общим сообщением (так просил иссус).
      if (r.code === "bad_email" || r.code === "email_taken") setEmailFieldError(authErrorText(r.code));
      else setFormError(authErrorText(r.code));
    } catch {
      setFormError("Could not reach the server. Check your connection and try again.");
    } finally {
      setFormBusy(false);
    }
  };

  const toggleActive = async (u: AdminUser) => {
    setActionBusyId(u.id);
    setActionError(null);
    const r = isSuspended(u.status) ? await auth.activateUser(u.id) : await auth.suspendUser(u.id);
    setActionBusyId(null);
    // Перечитываем список целиком, а не подкладываем `r.user` в строку руками:
    // у suspend/activate он типа AuthUser (без id/status), да и приём везде один
    // и тот же в этом файле — источник правды один, `listUsers()`.
    if (r.ok) void load();
    else setActionError({ id: u.id, text: authErrorText(r.code) });
  };

  const doReinvite = async (u: AdminUser) => {
    setActionBusyId(u.id);
    setActionError(null);
    const r = await auth.reinvite(u.id);
    setActionBusyId(null);
    if (r.ok) {
      setCreated({ user: r.user, inviteUrl: r.inviteUrl, expiresAt: r.expiresAt });
      setCopied(false);
      setScreen("created");
      setDialogOpen(true);
      void load();
    } else {
      setActionError({ id: u.id, text: authErrorText(r.code) });
    }
  };

  const askDelete = (u: AdminUser) => {
    setToDelete(u);
    setConfirmEmail("");
    setDeleteError(null);
  };

  const doDelete = async () => {
    if (!toDelete || deleteBusy) return;
    setDeleteBusy(true);
    setDeleteError(null);
    try {
      const r = await auth.deleteUser(toDelete.id);
      if (r.ok) {
        setToDelete(null);
        void load();
        return;
      }
      /* Отказ показываем В ДИАЛОГЕ и диалог не закрываем: last_admin и
         self_delete — это ответ на заданный вопрос, а не сбой рядом. Закрой мы
         его молча, человек решил бы, что удаление прошло. */
      setDeleteError(authErrorText(r.code));
    } catch {
      setDeleteError("Could not reach the server. Check your connection and try again.");
    } finally {
      setDeleteBusy(false);
    }
  };

  const doCopy = async () => {
    if (!created) return;
    await copyText(created.inviteUrl);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1800);
  };

  if (gate === "checking") {
    return (
      <div className={cn(PAGE_WIDTH, PAGE_PAD, "py-16 text-center")}>
        <p className="text-sm text-muted-foreground">Checking access…</p>
      </div>
    );
  }

  if (gate === "blocked") {
    // Одна короткая строка, без деталей причины: и «не вошёл», и «вошёл не
    // админом» здесь говорятся одинаково — см. шапку файла. Дальше ничего не
    // зовём, дальше и звать нечего.
    return (
      <div className={cn(PAGE_WIDTH, PAGE_PAD, "py-16 text-center")}>
        <p className="text-sm font-medium text-foreground">{authErrorText("not_admin")}</p>
      </div>
    );
  }

  const sortedRows = rows
    ? [...rows].sort((a, b) =>
        (a.name || a.email).toLowerCase().localeCompare((b.name || b.email).toLowerCase()),
      )
    : [];
  const activeAdmins = (rows ?? []).filter((u) => u.role === "admin" && !isSuspended(u.status)).length;

  return (
    <div className={cn(PAGE_WIDTH, PAGE_PAD, "py-5")}>
      <div className="mb-3 flex flex-wrap items-center gap-3">
        <h1 className="display text-lg leading-none">Users</h1>
        {rows && (
          <span className="tnum text-xs text-muted-foreground">
            {rows.length} account{rows.length === 1 ? "" : "s"}
          </span>
        )}
        {self && (
          <span
            className="tnum text-xs text-muted-foreground"
            title="Every account below belongs to this workspace — the list is already scoped
              server-side, so this number is the same on every row, and showing it once here is
              honester than repeating an identical value down a whole column."
          >
            workspace #{self.ws}
          </span>
        )}
        <button
          type="button"
          onClick={openCreate}
          className="focus-ring ml-auto flex h-8 items-center gap-1.5 rounded-lg bg-primary px-3 text-xs font-medium text-primary-foreground outline-none transition-colors duration-150 hover:bg-primary-hover"
        >
          <UserPlus className="size-3.5" strokeWidth={1.75} aria-hidden />
          New account
        </button>
      </div>

      {listError && (
        <div className="mb-3 flex-none rounded-xl border border-destructive/40 bg-destructive-soft px-3 py-2 text-xs text-destructive">
          {listError}
        </div>
      )}

      {listPending && !rows ? (
        <p className="text-xs text-muted-foreground">Loading…</p>
      ) : !sortedRows.length && !listPending ? (
        <div className="rounded-xl border border-dashed border-border px-4 py-8 text-center">
          <p className="text-sm font-medium">No accounts</p>
        </div>
      ) : sortedRows.length ? (
        <div className="overflow-x-auto rounded-xl border border-border bg-card">
          <table className="w-full min-w-[900px] table-fixed border-collapse text-sm">
            <thead className="sticky top-0 z-10 bg-elevated/95 backdrop-blur">
              <tr className="border-b border-border text-left">
                {USER_COLS.map((c) => (
                  <th
                    key={c.id}
                    style={{ width: c.w }}
                    className="microlabel px-2 py-2 text-2xs text-muted-foreground"
                  >
                    {c.title}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {sortedRows.map((u) => {
                const suspended = isSuspended(u.status);
                const isSelf = self ? sameEmail(u.email, self.email) : false;
                /* self_suspend раньше last_admin: когда оба верны разом (я — сам
                   себе последний админ), объяснение «это ты» ближе к делу, чем
                   абстрактное «ты последний админ». */
                const guard: "self_suspend" | "last_admin" | null = suspended
                  ? null
                  : isSelf
                    ? "self_suspend"
                    : u.role === "admin" && activeAdmins <= 1
                      ? "last_admin"
                      : null;
                /* У удаления стражи СВОИ, и они не те же самые. Себя не удаляют
                   никогда — даже когда админов в пространстве много. А вот
                   ПОГАШЕННОГО админа удалить можно: живой админ рядом остаётся,
                   без владельца пространство не остаётся, и запрещать это значило
                   бы мешать делу ради симметрии с соседней кнопкой. Оба ответа
                   всё равно приходят с сервера — здесь мы лишь не показываем
                   человеку кнопку, которая заведомо откажет. */
                const delGuard: "self_delete" | "last_admin" | null = isSelf
                  ? "self_delete"
                  : u.role === "admin" && !suspended && activeAdmins <= 1
                    ? "last_admin"
                    : null;
                return (
                  <tr
                    key={u.id}
                    className="border-b border-border/40 transition-colors duration-150 last:border-0 hover:bg-hover"
                  >
                    <td className="max-w-0 min-w-[180px] px-2 py-2">
                      <div className="flex min-w-0 items-center gap-1.5">
                        <span className="truncate text-sm" title={u.name || u.email}>
                          {u.name || u.email}
                        </span>
                        {isSelf && (
                          <span className="flex-none rounded border border-border-strong px-1 text-2xs text-muted-foreground">
                            you
                          </span>
                        )}
                      </div>
                      <div className="truncate font-mono text-2xs text-muted-foreground">{u.email}</div>
                    </td>
                    <td className="px-2 py-2">
                      {u.role === "admin" ? (
                        <span className="inline-flex items-center gap-1 text-xs font-medium text-foreground">
                          <ShieldCheck className="size-3.5 text-primary-ink" strokeWidth={2} aria-hidden />
                          admin
                        </span>
                      ) : (
                        <span className="text-xs text-muted-foreground">member</span>
                      )}
                    </td>
                    <td className="px-2 py-2">
                      <span
                        className={cn(
                          "inline-flex items-center gap-1.5 text-xs",
                          suspended ? "text-muted-foreground" : "text-success",
                        )}
                      >
                        <span
                          aria-hidden
                          className={cn(
                            "size-1.5 flex-none rounded-full",
                            suspended ? "bg-muted-foreground" : "bg-success",
                          )}
                        />
                        {u.status}
                      </span>
                    </td>
                    <td className="tnum px-2 py-2 text-xs text-muted-foreground">
                      {u.created_at ? whenShort(u.created_at) : "—"}
                    </td>
                    <td className="tnum px-2 py-2 text-xs text-muted-foreground">
                      {lastSeenText(u.last_login_at)}
                    </td>
                    <td className="px-2 py-2 align-top">
                      <div className="flex flex-col items-start gap-1">
                        <div className="flex flex-wrap gap-1.5">
                          {!u.last_login_at && (
                            <button
                              type="button"
                              disabled={actionBusyId === u.id}
                              onClick={() => void doReinvite(u)}
                              className={ROW_BTN}
                            >
                              <Send className="size-3.5" strokeWidth={1.75} aria-hidden />
                              Resend invite
                            </button>
                          )}
                          <button
                            type="button"
                            disabled={actionBusyId === u.id || !!guard}
                            title={guard ? authErrorText(guard) : undefined}
                            onClick={() => void toggleActive(u)}
                            className={cn(ROW_BTN, !suspended && "text-destructive hover:border-destructive/50")}
                          >
                            {suspended ? (
                              <>
                                <RotateCcw className="size-3.5" strokeWidth={1.75} aria-hidden />
                                Turn on
                              </>
                            ) : (
                              <>
                                <Ban className="size-3.5" strokeWidth={1.75} aria-hidden />
                                Turn off
                              </>
                            )}
                          </button>
                          <button
                            type="button"
                            disabled={actionBusyId === u.id || !!delGuard}
                            title={delGuard ? authErrorText(delGuard) : undefined}
                            onClick={() => askDelete(u)}
                            className={cn(ROW_BTN, "text-destructive hover:border-destructive/50")}
                          >
                            <Trash2 className="size-3.5" strokeWidth={1.75} aria-hidden />
                            Delete
                          </button>
                        </div>
                        {actionError?.id === u.id && (
                          <p role="alert" className="text-2xs leading-snug text-destructive">
                            {actionError.text}
                          </p>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      ) : null}

      <MotionDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        title={screen === "created" ? "Share this link" : "New account"}
        className="max-w-md"
      >
        <div className="flex flex-col gap-3.5 p-4">
          <div className="flex items-start justify-between gap-2">
            <h2 className="text-base font-semibold text-foreground">
              {screen === "created" ? "Share this link" : "New account"}
            </h2>
            <Button variant="ghost" size="icon-sm" onClick={() => setDialogOpen(false)} aria-label="Close">
              <X />
            </Button>
          </div>

          {screen === "form" ? (
            <form onSubmit={submit} className="flex flex-col gap-3.5" noValidate>
              <label className="flex flex-col gap-1.5">
                <span className="microlabel">name</span>
                <input
                  type="text"
                  autoFocus
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Jane Doe"
                  className={cn(
                    "focus-ring h-9 rounded-lg border border-border bg-input px-3",
                    "text-[13.5px] text-foreground outline-none placeholder:text-ghost",
                  )}
                />
              </label>

              <label className="flex flex-col gap-1.5">
                <span className="microlabel">email</span>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => {
                    setEmail(e.target.value);
                    if (emailFieldError) setEmailFieldError(null);
                  }}
                  placeholder="jane@company.com"
                  className={cn(
                    "focus-ring h-9 rounded-lg border border-border bg-input px-3",
                    "text-[13.5px] text-foreground outline-none placeholder:text-ghost",
                  )}
                />
                <div className="min-h-[18px]">
                  {emailFieldError && (
                    <p role="alert" className="text-2xs leading-snug text-destructive">
                      {emailFieldError}
                    </p>
                  )}
                </div>
              </label>

              <div className="flex flex-col gap-1.5">
                <span className="microlabel">role</span>
                <Segmented
                  size="sm"
                  options={[
                    { value: "user", label: "Member" },
                    { value: "admin", label: "Admin" },
                  ]}
                  value={role}
                  onChange={(v) => setRole(v === "admin" ? "admin" : "user")}
                />
              </div>

              <div className="min-h-[34px]">
                {formError && (
                  <p role="alert" className="text-[12.5px] leading-snug text-destructive">
                    {formError}
                  </p>
                )}
              </div>

              <button
                type="submit"
                disabled={formBusy}
                className={cn(
                  "focus-ring h-9 rounded-lg bg-primary text-[13.5px] font-medium",
                  "text-primary-foreground outline-none transition-colors duration-150",
                  "hover:bg-primary-hover disabled:opacity-60",
                )}
              >
                {formBusy ? "Creating…" : "Create account"}
              </button>
            </form>
          ) : created ? (
            <div className="flex flex-col gap-3">
              <p className="text-[13px] leading-relaxed text-muted-foreground">
                This is the only way to give {created.user.name || created.user.email} access — copy
                the link now and share it however you like. It will not be shown again; if it gets
                lost, come back to this list and resend a new one.
              </p>
              <div className="flex items-stretch gap-2">
                <input
                  readOnly
                  value={created.inviteUrl}
                  onFocus={(e) => e.currentTarget.select()}
                  aria-label="Invitation link"
                  className="focus-ring h-9 min-w-0 flex-1 rounded-lg border border-border bg-input px-3 font-mono text-xs text-foreground outline-none"
                />
                {/* Основная кнопка листа, не приглушённая: копирование — это и
                    есть весь смысл этого экрана, а не второстепенное действие
                    рядом с чем-то более важным. */}
                <button
                  type="button"
                  onClick={() => void doCopy()}
                  className="focus-ring flex h-9 flex-none items-center gap-1.5 rounded-lg bg-primary px-3 text-xs font-medium text-primary-foreground outline-none transition-colors duration-150 hover:bg-primary-hover"
                >
                  {copied ? (
                    <>
                      <Check className="size-3.5" strokeWidth={2} aria-hidden />
                      Copied
                    </>
                  ) : (
                    <>
                      <Copy className="size-3.5" strokeWidth={1.75} aria-hidden />
                      Copy
                    </>
                  )}
                </button>
              </div>
              <p className="text-2xs text-muted-foreground">
                {created.expiresAt ? (
                  <>Works until <span className="tnum">{whenShort(created.expiresAt)}</span>.</>
                ) : (
                  "This link is time-limited."
                )}
              </p>
              <button
                type="button"
                onClick={() => setDialogOpen(false)}
                className="focus-ring h-9 rounded-lg border border-border bg-card text-[13.5px] font-medium text-foreground outline-none transition-colors duration-150 hover:border-border-strong"
              >
                Done
              </button>
            </div>
          ) : null}
        </div>
      </MotionDialog>

      {/* Вопрос перед необратимым. Он спрашивает не «уверены?» — на этот вопрос
          все отвечают «да» не читая, — а требует набрать почту: единственное
          действие, которое нельзя совершить, промахнувшись мышью по соседней
          строке. Список того, что уносится, стоит здесь же, потому что человек
          иначе узнает об этом уже после. */}
      <MotionDialog
        open={!!toDelete}
        onOpenChange={(open) => {
          if (!open) setToDelete(null);
        }}
        title="Delete account"
        className="max-w-md"
      >
        {toDelete && (
          <div className="flex flex-col gap-3.5 p-4">
            <div className="flex items-start justify-between gap-2">
              <h2 className="text-base font-semibold text-foreground">Delete account</h2>
              <Button variant="ghost" size="icon-sm" onClick={() => setToDelete(null)} aria-label="Close">
                <X />
              </Button>
            </div>

            <p className="text-[13px] leading-relaxed text-muted-foreground">
              <span className="font-medium text-foreground">{toDelete.name || toDelete.email}</span>{" "}
              will be removed from this workspace for good, together with their open sessions,
              any invitation links, and their sign-in history. They will disappear from this
              list and will not be able to sign in. This cannot be undone — the only way back
              is creating the account again, from scratch.
            </p>

            <label className="flex flex-col gap-1.5">
              <span className="microlabel">type {toDelete.email} to confirm</span>
              <input
                type="text"
                autoFocus
                value={confirmEmail}
                onChange={(e) => setConfirmEmail(e.target.value)}
                placeholder={toDelete.email}
                aria-label={`Type ${toDelete.email} to confirm deletion`}
                className={cn(
                  "focus-ring h-9 rounded-lg border border-border bg-input px-3",
                  "font-mono text-[13px] text-foreground outline-none placeholder:text-ghost",
                )}
              />
            </label>

            <div className="min-h-[18px]">
              {deleteError && (
                <p role="alert" className="text-2xs leading-snug text-destructive">
                  {deleteError}
                </p>
              )}
            </div>

            <div className="flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setToDelete(null)}
                className="focus-ring h-9 rounded-lg border border-border bg-card px-3 text-[13.5px] font-medium text-foreground outline-none transition-colors duration-150 hover:border-border-strong"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={deleteBusy || !sameEmail(confirmEmail, toDelete.email)}
                onClick={() => void doDelete()}
                className={cn(
                  "focus-ring flex h-9 items-center gap-1.5 rounded-lg bg-destructive px-3",
                  "text-[13.5px] font-medium text-destructive-foreground outline-none",
                  "transition-colors duration-150 hover:opacity-90 disabled:opacity-40",
                )}
              >
                <Trash2 className="size-3.5" strokeWidth={1.75} aria-hidden />
                {deleteBusy ? "Deleting…" : "Delete account"}
              </button>
            </div>
          </div>
        )}
      </MotionDialog>
    </div>
  );
}
