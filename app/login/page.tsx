"use client";

/* Экран входа — первая дверь продукта и первое, что видит чужой человек.
 *
 * ЧТО ЗДЕСЬ РЕШЕНО И ПОЧЕМУ
 *
 * Одна форма и ничего больше. Ни «запомнить меня» (срок и так 30 дней, галочка
 * обманывала бы), ни входа по ссылке на почту (решение 27 спеки: дверь остаётся
 * паролем), ни регистрации — учётки заводит админ, и человек, попавший сюда без
 * приглашения, должен это прочитать, а не искать кнопку, которой нет.
 *
 * ПРИЧИНА ОТКАЗА ГОВОРИТСЯ СЛОВАМИ, но ровно та, которую можно говорить. Сервер
 * намеренно отвечает одинаково и когда почты нет, и когда пароль неверный: иначе
 * форма превращается в проверялку «есть ли у вас такой человек». Панель это
 * повторяет — тексты в `lib/auth-copy`, и там же объяснено, чего в них нет.
 *
 * ПОЧЕМУ ФОРМА НЕ ЖДЁТ ОТВЕТА `/auth/me`. Человек, пришедший сюда по 401, вводить
 * начинает сразу, и блокировать поля на время проверки значит съесть первые
 * нажатия. Проверка идёт параллельно и нужна для другого: если сессия ЖИВА (сюда
 * можно попасть по ссылке из закладок), незачем заставлять входить заново.
 *
 * `?next=` ПРОВЕРЯЕТСЯ, и это не паранойя. Параметр приходит из адресной строки,
 * то есть от кого угодно; переход по нему как есть — открытый редирект, а человек
 * в этот момент ТОЛЬКО ЧТО ВВЁЛ ПАРОЛЬ. Разбор — `lib/session.loginHref`,
 * тамошние тесты ловят `https://чужой.сайт`, `//чужой.сайт` и `javascript:`.
 */

import * as React from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { Logo } from "@/components/brand/Logo";
import { auth } from "@/lib/auth";
import { authErrorText } from "@/lib/auth-copy";
import { safeNext } from "@/lib/session";
import { дверь, дверьДоОтвета } from "@/lib/auth-screen";
import { cn } from "@/lib/utils";

function LoginScreen() {
  const router = useRouter();
  const params = useSearchParams();
  const next = safeNext(params.get("next"));

  const [email, setEmail] = React.useState("");
  const [password, setPassword] = React.useState("");
  const [show, setShow] = React.useState(false);
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  /* Отдельно от `error`: это не отказ формы, а объяснение, ПОЧЕМУ человек тут
     оказался. «Сессия истекла» и «пара не подошла» — разные разговоры, и
     показывать второе вместо первого значит обвинить его в чужой ошибке. */
  const [why, setWhy] = React.useState<string | null>(null);
  /* Имя нужно только регистрации. Держится здесь, а не внутри формы: смена
     двери не должна стирать уже набранное. */
  const [name, setName] = React.useState("");
  /* Ответ `/auth/me`: пришёл ли и свежая ли установка (`first_tenant`).
     Признак приходит И в успехе, И в 401 — и вторая ветка тут главная: свежая
     установка отвечает именно отказом, потому что войти в неё ещё некем.

     ИМЕННО `firstTenant`, а не `registrationOpen`. Второй отвечает на другой
     вопрос — «можно ли завести учётку», сегодня всегда да, — и до 15.08 это был
     один и тот же вопрос с одним именем. Иссус #143 ровно про то, что имя
     пережило смысл, а панель читает поле по имени. */
  const [отвечено, setОтвечено] = React.useState(false);
  const [свежая, setСвежая] = React.useState<boolean | undefined>(undefined);
  /* Что человек выбрал ссылкой внизу. Сильнее любого признака с
     сервера: он нажал и ждёт другую форму. */
  const [выбор, setВыбор] = React.useState<"вход" | "регистрация" | undefined>(undefined);

  const режим = отвечено
    ? дверь({ отвечено, вошёл: false, свежаяУстановка: свежая, выбор })
    : (выбор ?? дверьДоОтвета());
  const регистрация = режим === "регистрация";

  /* Пришёл с живой сессией — не мучаем формой. Ошибку глотаем: если проверка не
     удалась, человек просто увидит форму, и это верное поведение по умолчанию. */
  React.useEffect(() => {
    let живо = true;
    void auth.me().then((r) => {
      if (!живо) return;
      setСвежая(r.firstTenant);
      setОтвечено(true);
      if (r.ok) router.replace(next);
      else if (r.code === "session_expired" || r.code === "session_revoked") {
        setWhy(authErrorText(r.code));
      }
    }).catch(() => {
      /* Сервер не ответил — остаёмся на входе. Показать форму первой
         регистрации на молчании значило бы предложить завести админа
         установке, где учётки, возможно, давно есть. */
      if (живо) setОтвечено(true);
    });
    return () => {
      живо = false;
    };
  }, [router, next]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (busy) return;
    setError(null);
    setWhy(null);
    if (!email.trim() || !password) {
      setError(authErrorText("empty_fields"));
      return;
    }
    setBusy(true);
    try {
      const r = регистрация
        ? await auth.register(email.trim(), name.trim(), password)
        : await auth.login(email.trim(), password);
      if (r.ok) {
        /* `replace`, а не `push`: кнопка «назад» не должна возвращать на форму
           входа, с которой человек только что успешно ушёл. */
        router.replace(next);
        return;
      }
      setError(
        r.code === "too_many" && r.retryAfterS
          ? `${authErrorText("too_many")} (${r.retryAfterS}s)`
          : authErrorText(r.code),
      );
      /* Пароль стираем, почту оставляем: набирать адрес заново после опечатки в
         пароле — это наказание за чужую ошибку. */
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

        <h1 className="font-heading text-[22px] font-semibold tracking-tight text-foreground">
          {регистрация ? "Set up Obelista" : "Sign in"}
        </h1>

        {why ? (
          <p className="mt-1.5 text-[13px] text-muted-foreground">{why}</p>
        ) : регистрация ? (
          /* Что человек получает — своё пространство, а не место в чужом.
             Сказать это важнее, чем звучать приветливо: он заводит рабочий
             инструмент, а не подписывается на рассылку. */
          <p className="mt-1.5 text-[13px] leading-relaxed text-muted-foreground">
            You get your own workspace: your profiles, your ad accounts, your numbers. Nobody
            else can see them, and you cannot see anybody else&apos;s.
          </p>
        ) : (
          <p className="mt-1.5 text-[13px] text-muted-foreground">
            Sign in to your workspace.
          </p>
        )}

        <form onSubmit={submit} className="mt-7 flex flex-col gap-3.5" noValidate>
          {регистрация && (
            <label className="flex flex-col gap-1.5">
              <span className="microlabel">your name</span>
              <input
                type="text"
                name="name"
                autoComplete="name"
                autoFocus
                value={name}
                onChange={(e) => setName(e.target.value)}
                className={cn(
                  "focus-ring h-9 rounded-lg border border-border bg-input px-3",
                  "text-[13.5px] text-foreground outline-none placeholder:text-ghost",
                )}
                placeholder="Alex"
              />
            </label>
          )}

          <label className="flex flex-col gap-1.5">
            <span className="microlabel">email</span>
            <input
              type="email"
              name="email"
              autoComplete="username"
              autoFocus={!регистрация}
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className={cn(
                "focus-ring h-9 rounded-lg border border-border bg-input px-3",
                "text-[13.5px] text-foreground outline-none placeholder:text-ghost",
              )}
              placeholder="you@company.com"
            />
          </label>

          <label className="flex flex-col gap-1.5">
            <span className="flex items-baseline justify-between">
              <span className="microlabel">password</span>
              {/* «Показать» — не украшение: длинный пароль из менеджера набирают
                  руками, когда менеджер не сработал, и вслепую это делают трижды.
                  Кнопка, а не чекбокс: состояние видно по надписи. */}
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
              autoComplete={регистрация ? "new-password" : "current-password"}
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
            {busy
              ? регистрация
                ? "Creating…"
                : "Signing in…"
              : регистрация
                ? "Create account"
                : "Sign in"}
          </button>
        </form>

        {/* ПЕРЕКЛЮЧАТЕЛЬ ДВЕРИ. Владелец 15.08: «просто фразу — нет аккаунта?
            Sign up, кнопочка, и переключает на регу; и так же обратно».

            Кнопка, а не ссылка на /signup: человек, промахнувшийся формой, не
            уходит со страницы и не теряет введённую почту. Отдельный адрес
            понадобился бы, только чтобы слать на него ссылки, а ссылки у нас
            ведут на вход — и оттуда до регистрации одно нажатие. */}
        <p className="mt-6 text-[12.5px] text-muted-foreground">
          {регистрация ? "Already have an account? " : "No account yet? "}
          <button
            type="button"
            onClick={() => {
              setВыбор(регистрация ? "вход" : "регистрация");
              /* Ошибку прошлой формы уносим: «Fill in both fields» над формой
                 регистрации — это упрёк за то, чего человек тут не делал. */
              setError(null);
            }}
            className="focus-ring rounded text-primary-ink underline underline-offset-2 outline-none"
          >
            {регистрация ? "Sign in" : "Sign up"}
          </button>
        </p>

        {/* Сброса нет там, где ещё нечего сбрасывать: на форме регистрации эта
            ссылка ведёт к форме, которая молча ничего не сделает. */}
        {!регистрация && (
        <p className="mt-6 text-[12.5px] text-muted-foreground">
          Forgot your password?{" "}
          <Link href="/login/reset" className="text-primary-ink underline underline-offset-2">
            Reset it
          </Link>
          .
        </p>
        )}

        {/* Обещание с юрстраницы, повторённое там, где оно нужнее всего: человек
            вводит пароль и вправе знать, что с ним будет. Формулировка та же, что
            в /privacy, — расхождение между документом и экраном ревьюер Меты
            замечает, и это одна из частых причин отказа. */}
        <p className="mt-8 text-[11.5px] leading-relaxed text-muted-foreground">
          Your password is stored in a form that cannot be turned back — nobody at Obelista
          can read it, and we never ask you for it.{" "}
          <Link href="/privacy" className="underline underline-offset-2">
            Privacy
          </Link>
        </p>
      </div>
    </main>
  );
}

/* То же, что на /invite: `useSearchParams()` без <Suspense> роняет `next build`,
 * а не страницу. Держим обёртку и здесь — вход читает `?next=`, значит уязвим
 * ровно так же; сборка просто остановилась на /invite первой и до /login не
 * дошла. Чинить один из двух означало бы поймать ту же аварию через минуту. */
export default function LoginPage() {
  return (
    <React.Suspense
      fallback={<main className="grid min-h-dvh place-items-center px-6 py-12" />}
    >
      <LoginScreen />
    </React.Suspense>
  );
}
