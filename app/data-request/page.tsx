import type { Metadata } from "next";
import Link from "next/link";
import { Logo } from "@/components/brand/Logo";

/* Инструкция по доступу к данным и их удалению.
 *
 * Мета требует ОТДЕЛЬНЫЙ адрес под это — «Data Deletion Instructions URL» в
 * настройках приложения, помимо адреса политики. Ревьюер открывает его без
 * входа и без демона, поэтому страница статическая и живёт вне продукта.
 *
 * Главное здесь — первый способ: отключить аккаунт может сам юзер, кнопкой,
 * без переписки и без ожидания. Это правда, а не обещание: кнопка «отключить»
 * на листе «Соцы» стирает токен немедленно. Второй и третий способы нужны
 * тем, у кого доступа к панели уже нет.
 */

export const metadata: Metadata = {
  title: "Obelista — Data Deletion & Access Requests",
  description:
    "How to disconnect your Facebook account, request a copy of your data, or delete it entirely.",
};

const EMAIL = "robertgoodell1994@sikatanc.com";

function Mail() {
  return (
    <a className="text-primary-ink underline underline-offset-2" href={`mailto:${EMAIL}`}>
      {EMAIL}
    </a>
  );
}

function Step({
  n,
  title,
  children,
}: {
  n: string;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="mt-7 rounded-xl border border-border bg-card px-5 py-4">
      <div className="flex items-baseline gap-2.5">
        <span className="tnum text-[13px] font-semibold text-primary-ink">{n}</span>
        <h2 className="font-heading text-[16px] font-semibold text-foreground">
          {title}
        </h2>
      </div>
      <div className="mt-2 space-y-2.5 text-[14px] leading-relaxed text-muted-foreground">
        {children}
      </div>
    </section>
  );
}

export default function Page() {
  return (
    <main className="mx-auto max-w-[720px] px-6 py-12">
      {/* Подпись продукта над документом. Эти три страницы — первое и часто
          единственное, что ревьюер Меты видит своими глазами: Site URL ведёт
          сюда. Документ без имени продукта читается как чужой шаблон, а
          совпадение имени в документе и на экране — ровно то, что ревьюер
          сверяет. Ссылка на главную по той же причине: ему надо туда попасть. */}
      <Link href="/" aria-label="Obelista — home" className="mb-7 block w-fit text-foreground">
        <Logo className="h-5 w-auto" />
      </Link>

      <h1 className="font-heading text-[28px] font-semibold text-foreground">
        Data deletion and access requests
      </h1>
      <p className="mt-2 text-[14px] leading-relaxed text-muted-foreground">
        Obelista is an advertising analytics tool operated by Digital Theory.
        This page explains how to stop our access to your Facebook data, obtain
        a copy of what we hold, or have it deleted. There are three ways, and
        the first one is instant and entirely in your hands.
      </p>

      <Step n="1" title="Disconnect the account yourself — takes a second">
        <p>
          Sign in to Obelista, open the <b className="text-foreground">Socials</b>{" "}
          page, find the connected account and press{" "}
          <b className="text-foreground">Disconnect</b>.
        </p>
        <p>
          The access token issued by Meta is deleted from our systems
          immediately. From that moment we can no longer read your advertising
          accounts, spend, or delivery statuses. Nothing is queued and nobody
          reviews the request — it simply happens.
        </p>
      </Step>

      <Step n="2" title="Revoke access from Facebook">
        <p>
          You can also revoke our access from Meta’s side, without opening
          Obelista at all: go to{" "}
          <b className="text-foreground">
            Facebook → Settings &amp; Privacy → Settings → Apps and Websites
          </b>
          , find the app, and remove it.
        </p>
        <p>
          This works even if you have lost access to your Obelista account. Once
          revoked, the token we hold stops working immediately, and we delete
          it.
        </p>
      </Step>

      <Step n="3" title="Ask us — for a copy, or for full deletion">
        <p>
          Write to <Mail /> from the email address you used to sign in, and say
          which of these you want:
        </p>
        <ul className="ml-5 list-disc space-y-1.5">
          <li>
            <b className="text-foreground">A copy of your data</b> — we will
            send you everything we hold that relates to you.
          </li>
          <li>
            <b className="text-foreground">Correction</b> — if something we hold
            about you is wrong.
          </li>
          <li>
            <b className="text-foreground">Full deletion</b> — your account, the
            advertising data collected under it, and any remaining tokens.
          </li>
        </ul>
        <p>
          We acknowledge every request within 30 days of receiving it and act on
          it without unjustifiable delay. If we cannot fulfil a request, we will
          tell you why.
        </p>
        <p>
          We may need to confirm that the request really comes from you before
          acting on it. We will never ask you for your password to do so, and we
          could not check it against ours even if you sent it — we do not keep
          passwords in a readable form. Anyone asking you for your Obelista
          password is not us.
        </p>
      </Step>

      <section className="mt-8">
        <h2 className="font-heading text-[16px] font-semibold text-foreground">
          What happens to backups
        </h2>
        <p className="mt-2 text-[14px] leading-relaxed text-muted-foreground">
          Deletion removes your data from our active systems straight away.
          Copies may survive in encrypted backup archives for a short period
          until those archives expire in the ordinary course. During that time
          the data is isolated from any further processing — it is not read,
          used, or shared.
        </p>
      </section>

      <section className="mt-8">
        <h2 className="font-heading text-[16px] font-semibold text-foreground">
          Contact
        </h2>
        <div className="mt-2 space-y-2 text-[14px] leading-relaxed text-muted-foreground">
          <p>
            Email: <Mail />
          </p>
          <address className="not-italic">
            Digital Theory
            <br />7 rue George Sand
            <br />
            Rueil-Malmaison 92500
            <br />
            France
          </address>
        </div>
      </section>

      <footer className="mt-12 flex flex-wrap gap-4 border-t border-border pt-4">
        <Link
          href="/privacy"
          className="text-[13px] text-primary-ink underline underline-offset-2"
        >
          Privacy Policy
        </Link>
        <Link href="/terms" className="text-[13px] text-primary-ink underline underline-offset-2">
          Terms of Service
        </Link>
      </footer>
    </main>
  );
}
