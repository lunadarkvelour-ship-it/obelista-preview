import type { Metadata } from "next";
import Link from "next/link";
import { Logo } from "@/components/brand/Logo";

/* Условия использования.
 *
 * Нужны Мете: поле Terms of Service URL в настройках приложения, и на ревью его
 * смотрят вместе с политикой. До этого там стоял https://www.facebook.com/ —
 * то есть поле было заполнено мусором.
 *
 * Написано намеренно СУХО и коротко. Условия — это обязательства: каждое
 * обещание про то, что сервис умеет и гарантирует, потом можно предъявить.
 * Поэтому здесь нет ни описания возможностей, ни маркетинга — только рамка
 * отношений, отказ от гарантий и порядок прекращения.
 */

export const metadata: Metadata = {
  title: "Obelista — Terms of Service",
  description: "Terms governing the use of Obelista.",
};

const UPDATED = "August 7, 2026";
const EMAIL = "robertgoodell1994@sikatanc.com";

function Section({ n, title, children }: { n: number; title: string; children: React.ReactNode }) {
  return (
    <section className="mt-8">
      <h2 className="font-heading text-[17px] font-semibold text-foreground">
        {n}. {title}
      </h2>
      <div className="mt-2 space-y-2.5 text-[14px] leading-relaxed text-muted-foreground">
        {children}
      </div>
    </section>
  );
}

function Mail() {
  return (
    <a className="text-primary-ink underline underline-offset-2" href={`mailto:${EMAIL}`}>
      {EMAIL}
    </a>
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
        Terms of Service
      </h1>
      <p className="mt-1.5 text-[13px] text-muted-foreground">Last updated {UPDATED}</p>

      <p className="mt-6 text-[14px] leading-relaxed text-muted-foreground">
        These Terms govern your use of Obelista (the “Service”), operated by
        Digital Theory (“we”, “us”). By creating an account or using the
        Service, you agree to these Terms. If you do not agree, do not use the
        Service.
      </p>

      <Section n={1} title="Who may use the Service">
        <p>
          You must be at least 18 years old and able to enter into a binding
          agreement. If you use the Service on behalf of a company, you confirm
          that you are authorised to accept these Terms for it.
        </p>
      </Section>

      <Section n={2} title="Your account">
        <p>
          You sign in with your email address and a password you choose. You
          are responsible for everything that happens under your account,
          including keeping that password and access to your email secure. Tell
          us at <Mail /> if you believe someone else has access to your
          account.
        </p>
      </Section>

      <Section n={3} title="Connected accounts">
        <p>
          The Service works with advertising accounts you connect to it. You
          confirm that you are entitled to access those accounts and to grant us
          the permissions you approve. You can disconnect an account at any time
          — see our{" "}
          <Link href="/data-request" className="text-primary-ink underline underline-offset-2">
            data request page
          </Link>
          .
        </p>
        <p>
          Your use of the connected platforms remains subject to their own terms
          and policies. Nothing here overrides them, and we are not responsible
          for their decisions about your accounts.
        </p>
      </Section>

      <Section n={4} title="Acceptable use">
        <p>You agree not to:</p>
        <ul className="ml-5 list-disc space-y-1.5">
          <li>use the Service in breach of any applicable law or of the rules of a connected platform;</li>
          <li>access accounts or data you are not authorised to access;</li>
          <li>attempt to disrupt, overload, or reverse-engineer the Service;</li>
          <li>resell or provide access to the Service to third parties without our agreement.</li>
        </ul>
      </Section>

      <Section n={5} title="Availability and changes">
        <p>
          We may change, suspend, or discontinue any part of the Service, and we
          do not guarantee that it will be available without interruption. Where
          a change materially affects you, we will make reasonable efforts to
          give notice.
        </p>
      </Section>

      <Section n={6} title="No warranty">
        <p>
          The Service is provided “as is” and “as available”, without warranties
          of any kind, whether express or implied. In particular, we do not
          warrant that data shown in the Service is complete, accurate, or fit
          for any decision you make on the basis of it. You remain responsible
          for your advertising spend and for the decisions you take.
        </p>
      </Section>

      <Section n={7} title="Limitation of liability">
        <p>
          To the extent permitted by law, we are not liable for indirect or
          consequential loss, lost profit, lost revenue, or lost data arising
          from your use of the Service. Nothing in these Terms limits liability
          that cannot be limited by law.
        </p>
      </Section>

      <Section n={8} title="Termination">
        <p>
          You may stop using the Service and close your account at any time. We
          may suspend or terminate access if these Terms are breached, or if
          required to do so by law or by a connected platform. On termination,
          the handling of your data follows our{" "}
          <Link href="/privacy" className="text-primary-ink underline underline-offset-2">
            Privacy Policy
          </Link>
          .
        </p>
      </Section>

      <Section n={9} title="Changes to these Terms">
        <p>
          We may update these Terms. The updated version will carry a new date
          at the top of this page. Continuing to use the Service after a change
          means you accept the updated Terms.
        </p>
      </Section>

      <Section n={10} title="Governing law and contact">
        <p>
          These Terms are governed by the laws of France. Questions about these
          Terms go to <Mail />.
        </p>
        <address className="not-italic">
          Digital Theory
          <br />7 rue George Sand
          <br />
          Rueil-Malmaison 92500
          <br />
          France
        </address>
      </Section>

      <footer className="mt-12 flex gap-4 border-t border-border pt-4">
        <Link href="/privacy" className="text-[13px] text-primary-ink underline underline-offset-2">
          Privacy Policy
        </Link>
        <Link href="/data-request" className="text-[13px] text-primary-ink underline underline-offset-2">
          Data requests
        </Link>
      </footer>
    </main>
  );
}
