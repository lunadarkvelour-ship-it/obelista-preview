"use client";

/* Экран установки пароля по приглашению — вторая (и последняя) дверь для человека,
 * который получил ссылку от админа, а не завёл себе учётку сам.
 *
 * checkInvite ЗОВЁТСЯ ПЕРВЫМ, до того как человек увидит поле пароля. Иначе он
 * придумает пароль, наберёт его — и только тогда узнает, что ссылка протухла двое
 * суток назад. Пока ответ не пришёл, экран держит состояние "checking" и формы не
 * показывает вовсе; токена в адресной строке нет совсем — та же судьба, что у
 * мёртвой ссылки, и сетевой вызов на пустой токен не делаем.
 *
 * ТРИ КОНЦА ПРИГЛАШЕНИЯ — ТРИ РАЗНЫХ ЭКРАНА, не один «ссылка недействительна».
 * `invite_used` зовёт войти обычным входом (пароль по ссылке уже есть),
 * `invite_expired` — просить новую ссылку у админа (48 часов прошли),
 * `invite_invalid` (и отсутствие токена) — такой ссылки нет вовсе. Действия
 * разные, и слитый текст отправил бы две трети людей не туда. Тексты — из
 * `lib/auth-copy`, не свои: тот же код там уже проверен тестом на то, что разные
 * концы говорятся разными словами и что нигде не звучит обещание, которого
 * /privacy не даёт.
 *
 * ЭТИ ЖЕ ТРИ КОДА МОГУТ ПРИЙТИ И С ОТПРАВКИ ФОРМЫ (`acceptInvite`), не только с
 * проверки: ссылка способна умереть между тем, как экран открылся, и тем, как
 * человек нажал кнопку, — например, если приглашение погашено во второй вкладке.
 * Тогда меняется весь экран, а не только текст в форме: поля тут больше ни при
 * чём, дальше только новым путём. `weak_password` — другое дело, это отказ самой
 * формы, а не судьбы ссылки, и остаётся рядом с полем.
 *
 * ПАРОЛЬ ОДИН РАЗ, БЕЗ «ПОВТОРИТЕ». Кнопка «показать» вместо второго поля — тот
 * же приём, что на /login: не гонять человека вслепую по клавиатуре дважды.
 *
 * ЧЕГО ТУТ НЕТ. Юрстраница /privacy обещает: пароль хранится необратимо, никто в
 * Обелисте его не читает, и мы никогда его не спрашиваем. Значит здесь нет ни
 * «подтвердите администратору», ни показа старого пароля, ни слова
 * «восстановить» — только заведение нового.
 */

import * as React from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { Logo } from "@/components/brand/Logo";
import { auth } from "@/lib/auth";
import { authErrorText, passwordProblem, passwordRule } from "@/lib/auth-copy";
import { cn } from "@/lib/utils";

/** "checking" держит форму от глаз, пока сервер не подтвердил ссылку; остальные
 *  четыре — реальные судьбы приглашения (см. шапку файла). */
type Screen = "checking" | "form" | "used" | "expired" | "invalid";

/** Общий вид для трёх концов приглашения: заголовок, текст из `auth-copy` и
 *  необязательное действие. Один компонент, а не три копии одной вёрстки. */
function EndScreen({
  title,
  text,
  action,
}: {
  title: string;
  text: string;
  action?: React.ReactNode;
}) {
  return (
    <>
      <h1 className="font-heading text-[22px] font-semibold tracking-tight text-foreground">
        {title}
      </h1>
      <p className="mt-2.5 text-[13px] leading-relaxed text-muted-foreground">{text}</p>
      {action}
    </>
  );
}

function InviteScreen() {
  const router = useRouter();
  const params = useSearchParams();
  const token = params.get("token");

  const [screen, setScreen] = React.useState<Screen>(token ? "checking" : "invalid");
  const [email, setEmail] = React.useState("");
  const [minLen, setMinLen] = React.useState<number | undefined>(undefined);

  const [password, setPassword] = React.useState("");
  const [show, setShow] = React.useState(false);
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (!token) return;
    let живо = true;
    void auth
      .checkInvite(token)
      .then((r) => {
        if (!живо) return;
        if (r.ok) {
          setEmail(r.email);
          setMinLen(r.minLen);
          setScreen("form");
        } else if (r.code === "invite_used") {
          setScreen("used");
        } else if (r.code === "invite_expired") {
          setScreen("expired");
        } else {
          /* invite_invalid и любой незнакомый код — та же судьба: разбираться
             дальше нечем, ссылки с таким содержимым не существует. */
          setScreen("invalid");
        }
      })
      .catch(() => {
        if (живо) setScreen("invalid");
      });
    return () => {
      живо = false;
    };
  }, [token]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (busy || !token) return;
    setError(null);
    /* Видно сразу — не гоняем по сети ради этого (см. auth-copy). Сервер знает
       больше (словари, утечки) и остаётся последним словом. */
    const problem = passwordProblem(password, email, minLen);
    if (problem) {
      setError(problem);
      return;
    }
    setBusy(true);
    try {
      const r = await auth.acceptInvite(token, password);
      if (r.ok) {
        /* Кука уже стоит — сервер впустил сразу, второй раз входить незачем. */
        router.replace("/");
        return;
      }
      if (r.code === "invite_used" || r.code === "invite_expired" || r.code === "invite_invalid") {
        /* Ссылка умерла между открытием экрана и отправкой — см. шапку файла. */
        setScreen(
          r.code === "invite_used" ? "used" : r.code === "invite_expired" ? "expired" : "invalid",
        );
        return;
      }
      /* weak_password — отказ формы, а не ссылки; остаётся на месте, у поля.
         Свежий minLen подхватываем, если сервер его прислал. */
      if (typeof r.minLen === "number") setMinLen(r.minLen);
      setError(authErrorText(r.code));
      setPassword("");
    } catch {
      setError("Could not reach the server. Check your connection and try again.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <main className="grid min-h-dvh place-items-center px-6 py-12">
      <div className="w-full max-w-[356px]">
        <Link href="/" aria-label="Obelista — home" className="mb-9 block w-fit text-foreground">
          <Logo className="h-5 w-auto" />
        </Link>

        {screen === "checking" && (
          <h1 className="font-heading text-[22px] font-semibold tracking-tight text-foreground">
            Checking your invitation…
          </h1>
        )}

        {screen === "used" && (
          <EndScreen
            title="Already set"
            text={authErrorText("invite_used")}
            action={
              <Link
                href="/login"
                className="mt-6 inline-block text-[12.5px] text-primary-ink underline underline-offset-2"
              >
                Go to sign in
              </Link>
            }
          />
        )}

        {screen === "expired" && (
          <EndScreen title="Link expired" text={authErrorText("invite_expired")} />
        )}

        {screen === "invalid" && (
          <EndScreen title="Invalid link" text={authErrorText("invite_invalid")} />
        )}

        {screen === "form" && (
          <>
            <h1 className="font-heading text-[22px] font-semibold tracking-tight text-foreground">
              Set your password
            </h1>
            <p className="mt-1.5 text-[13px] text-muted-foreground">
              Create a password for {email}.
            </p>
            {/* Правило — ДО ввода, не после отказа (см. auth-copy и шапку файла). */}
            <p className="mt-3 text-[12.5px] leading-relaxed text-muted-foreground">
              {passwordRule(minLen)}
            </p>

            <form onSubmit={submit} className="mt-5 flex flex-col gap-3.5" noValidate>
              <label className="flex flex-col gap-1.5">
                <span className="flex items-baseline justify-between">
                  <span className="microlabel">password</span>
                  {/* «Показать» — не украшение: без второго поля это единственный
                      способ проверить, что напечаталось, раньше отправки. */}
                  <button
                    type="button"
                    onClick={() => setShow((v) => !v)}
                    className="focus-ring rounded text-2xs text-muted-foreground outline-none hover:text-foreground"
                  >
                    {show ? "hide" : "show"}
                  </button>
                </span>
                <input
                  type={show ? "text" : "password"}
                  name="password"
                  autoComplete="new-password"
                  autoFocus
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className={cn(
                    "focus-ring h-9 rounded-lg border border-border bg-input px-3",
                    "text-[13.5px] text-foreground outline-none placeholder:text-ghost",
                  )}
                />
              </label>

              {/* Место под ошибку держится всегда: иначе появление текста дёргает
                  кнопку вниз ровно в тот момент, когда по ней целятся. */}
              <div className="min-h-[34px]">
                {error && (
                  <p role="alert" className="text-[12.5px] leading-snug text-destructive">
                    {error}
                  </p>
                )}
              </div>

              <button
                type="submit"
                disabled={busy}
                className={cn(
                  "focus-ring h-9 rounded-lg bg-primary text-[13.5px] font-medium",
                  "text-primary-foreground outline-none transition-colors duration-150",
                  "hover:bg-primary-hover disabled:opacity-60",
                )}
              >
                {busy ? "Setting password…" : "Set password"}
              </button>
            </form>

            {/* Обещание с юрстраницы, дословно как на /login: расхождение между
                документом и экраном ревьюер Меты замечает. */}
            <p className="mt-8 text-[11.5px] leading-relaxed text-muted-foreground">
              Your password is stored in a form that cannot be turned back — nobody at Obelista
              can read it, and we never ask you for it.{" "}
              <Link href="/privacy" className="underline underline-offset-2">
                Privacy
              </Link>
            </p>
          </>
        )}
      </div>
    </main>
  );
}

/* Граница ожидания стоит СНАРУЖИ, а не внутри экрана. `useSearchParams()` в
 * Next заставляет отложить рендер до клиента, и без <Suspense> падает не экран,
 * а `next build` целиком — то есть доставка всего продукта, а не одной страницы.
 * Так и случилось 14.08: сборка образа встала на этом файле, и вместе с ней
 * встали два десятка уже влитых PR.
 * Заглушка повторяет рамку экрана, чтобы предрендер отдал ту же геометрию и
 * форма не «прыгала» в момент, когда её показывают. */
export default function InvitePage() {
  return (
    <React.Suspense
      fallback={<main className="grid min-h-dvh place-items-center px-6 py-12" />}
    >
      <InviteScreen />
    </React.Suspense>
  );
}
