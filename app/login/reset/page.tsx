"use client";

/* Сброс пароля.
 *
 * ОДИН И ТОТ ЖЕ ОТВЕТ, ЕСТЬ ТАКАЯ ПОЧТА ИЛИ НЕТ. Сервер всегда отвечает 200, и
 * панель обязана этому соответствовать: любая разница — «письмо отправлено» против
 * «такого адреса нет» — превращает форму сброса в проверялку существующих учёток,
 * ровно ту, которую мы закрыли на входе. Поэтому здесь нет ветки «не нашли»: её
 * нет не потому, что забыли, а потому, что она и есть дыра.
 *
 * ЧЕСТНО ПРО СЕГОДНЯ. Почтового контура ещё нет: `mail.obelista.com` не поднят, и
 * ручка сброса пишет запрос в журнал, а письма не шлёт. Врать «письмо отправлено»
 * нельзя — человек будет ждать его и не дождётся. Поэтому текст говорит то, что
 * есть на самом деле: запрос принят, а рабочий путь сегодня — попросить админа
 * перевыдать приглашение. Когда почта поднимется, отсюда уйдёт один абзац, и
 * контракт при этом не изменится.
 *
 * ВОССТАНОВЛЕНИЯ НЕТ, ЕСТЬ СБРОС — и это не формальность, а исполнение того, что
 * уже опубликовано на /privacy: пароль хранится в виде, который нельзя превратить
 * обратно. Никакого «напомнить пароль» здесь появиться не может в принципе.
 */

import * as React from "react";
import Link from "next/link";
import { Logo } from "@/components/brand/Logo";
import { auth } from "@/lib/auth";
import { cn } from "@/lib/utils";

export default function ResetPage() {
  const [email, setEmail] = React.useState("");
  const [busy, setBusy] = React.useState(false);
  const [sent, setSent] = React.useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (busy || !email.trim()) return;
    setBusy(true);
    /* Ответ не разбираем намеренно: разбирать нечего, он всегда одинаковый. */
    await auth.requestReset(email.trim());
    setBusy(false);
    setSent(true);
  };

  return (
    <main className="grid min-h-dvh place-items-center px-6 py-12">
      <div className="w-full max-w-[356px]">
        <Link href="/" aria-label="Obelista — home" className="mb-9 block w-fit text-foreground">
          <Logo className="h-5 w-auto" />
        </Link>

        <h1 className="font-heading text-[22px] font-semibold tracking-tight text-foreground">
          Reset your password
        </h1>

        {sent ? (
          <>
            {/* Ни слова о том, нашлась учётка или нет. */}
            <p className="mt-2.5 text-[13px] leading-relaxed text-muted-foreground">
              If that address has an account, a reset link is on its way.
            </p>
            <p className="mt-3 rounded-lg border border-border bg-card px-3 py-2.5 text-[12.5px] leading-relaxed text-muted-foreground">
              Email delivery is not switched on yet. Until it is, the way to get back in is
              to ask your admin for a fresh invitation link — it works the same way.
            </p>
            <Link
              href="/login"
              className="mt-6 inline-block text-[12.5px] text-primary-ink underline underline-offset-2"
            >
              Back to sign in
            </Link>
          </>
        ) : (
          <>
            <p className="mt-1.5 text-[13px] text-muted-foreground">
              We will send a link that lets you set a new one. Your current password cannot be
              shown to anyone — it is not stored in a readable form.
            </p>

            <form onSubmit={submit} className="mt-7 flex flex-col gap-3.5" noValidate>
              <label className="flex flex-col gap-1.5">
                <span className="microlabel">email</span>
                <input
                  type="email"
                  name="email"
                  autoComplete="username"
                  autoFocus
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@company.com"
                  className={cn(
                    "focus-ring h-9 rounded-lg border border-border bg-input px-3",
                    "text-[13.5px] text-foreground outline-none placeholder:text-ghost",
                  )}
                />
              </label>

              <button
                type="submit"
                disabled={busy || !email.trim()}
                className={cn(
                  "focus-ring h-9 rounded-lg bg-primary text-[13.5px] font-medium",
                  "text-primary-foreground outline-none transition-colors duration-150",
                  "hover:bg-primary-hover disabled:opacity-60",
                )}
              >
                {busy ? "Sending…" : "Send reset link"}
              </button>
            </form>

            <Link
              href="/login"
              className="mt-6 inline-block text-[12.5px] text-muted-foreground underline underline-offset-2 hover:text-foreground"
            >
              Back to sign in
            </Link>
          </>
        )}
      </div>
    </main>
  );
}
