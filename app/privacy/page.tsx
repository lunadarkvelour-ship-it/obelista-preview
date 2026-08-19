import type { Metadata } from "next";
import Link from "next/link";
import { Logo } from "@/components/brand/Logo";

/* Политика конфиденциальности Obelista — публичный документ.
 *
 * Живёт вне продукта: ни сайдбара, ни входа, ни демона. Ревьюер Меты не будет
 * запускать локальный сервер и не будет логиниться — страница обязана
 * открываться сама по себе, иначе приложение не подать ни на верификацию
 * бизнеса, ни на App Review.
 *
 * Текст — из генератора Termly, но с семью правками по факту системы. Каждая
 * правка отмечена комментарием ПРАВКА: там, где она сделана. Генератор не
 * знает ни про Graph API, ни про то, чего у нас нет, а расхождение между
 * документом и поведением приложения — самая частая причина отказа.
 *
 * По-английски намеренно: документ читает ревьюер Меты, а не пользователь
 * панели. Русская версия панели тут ни при чём.
 */

export const metadata: Metadata = {
  title: "Obelista — Privacy Policy",
  description:
    "How Obelista collects, uses, stores, and deletes your information, including data received from Meta.",
};

const UPDATED = "August 6, 2026";
const EMAIL = "robertgoodell1994@sikatanc.com";

const TOC: { id: string; label: string }[] = [
  { id: "collect", label: "What information do we collect?" },
  { id: "process", label: "How do we process your information?" },
  { id: "bases", label: "What legal bases do we rely on?" },
  { id: "share", label: "When and with whom do we share your information?" },
  { id: "cookies", label: "Do we use cookies and other tracking technologies?" },
  { id: "ai", label: "Do we offer artificial intelligence-based products?" },
  { id: "social", label: "How do we handle your social logins?" },
  { id: "international", label: "Is your information transferred internationally?" },
  { id: "retention", label: "How long do we keep your information?" },
  { id: "safety", label: "How do we keep your information safe?" },
  { id: "minors", label: "Do we collect information from minors?" },
  { id: "rights", label: "What are your privacy rights?" },
  { id: "dnt", label: "Controls for do-not-track features" },
  { id: "updates", label: "Do we make updates to this notice?" },
  { id: "contact", label: "How can you contact us about this notice?" },
  { id: "review", label: "How can you review, update, or delete your data?" },
];

function Section({
  id,
  n,
  title,
  children,
}: {
  id: string;
  n: number;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section id={id} className="mt-10 scroll-mt-6">
      <h2 className="font-heading text-[19px] font-semibold leading-snug text-foreground">
        {n}. {title}
      </h2>
      <div className="mt-3 space-y-3">{children}</div>
    </section>
  );
}

function Short({ children }: { children: React.ReactNode }) {
  return (
    <p className="border-l-2 border-primary-line pl-3 text-[13.5px] italic leading-relaxed text-muted-foreground">
      <b className="not-italic text-foreground">In short: </b>
      {children}
    </p>
  );
}

function P({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-[14px] leading-relaxed text-muted-foreground">{children}</p>
  );
}

function H3({ children }: { children: React.ReactNode }) {
  return (
    <h3 className="pt-2 font-heading text-[15px] font-semibold text-foreground">
      {children}
    </h3>
  );
}

function UL({ children }: { children: React.ReactNode }) {
  return (
    <ul className="ml-5 list-disc space-y-1.5 text-[14px] leading-relaxed text-muted-foreground">
      {children}
    </ul>
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
    <main className="mx-auto max-w-[760px] px-6 py-12">
      {/* Подпись продукта над документом. Эти три страницы — первое и часто
          единственное, что ревьюер Меты видит своими глазами: Site URL ведёт
          сюда. Документ без имени продукта читается как чужой шаблон, а
          совпадение имени в документе и на экране — ровно то, что ревьюер
          сверяет. Ссылка на главную по той же причине: ему надо туда попасть. */}
      <Link href="/" aria-label="Obelista — home" className="mb-7 block w-fit text-foreground">
        <Logo className="h-5 w-auto" />
      </Link>

      <h1 className="font-heading text-[28px] font-semibold text-foreground">
        Privacy Policy
      </h1>
      <p className="mt-1.5 text-[13px] text-muted-foreground">
        Last updated {UPDATED}
      </p>

      <div className="mt-7 space-y-3">
        {/* ПРАВКА 1. Генератор написал «Download and use our mobile application
            (Laundry v1)». Мобильного приложения не существует, а имя не то:
            продукт называется Obelista. Ревьюер открывает документ и продукт
            рядом — расхождение видно первым же взглядом. */}
        <P>
          This Privacy Notice for Digital Theory (doing business as{" "}
          <b className="text-foreground">Obelista</b>) (“we”, “us”, or “our”)
          describes how and why we might access, collect, store, use, and/or
          share (“process”) your personal information when you use our services
          (“Services”), including when you:
        </P>
        <UL>
          <li>
            Use Obelista, our web-based advertising analytics tool for media
            buyers, or any other application of ours that links to this Privacy
            Notice;
          </li>
          <li>
            Connect a Facebook advertising account to Obelista through Meta’s
            official login;
          </li>
          <li>Engage with us in other related ways, including support.</li>
        </UL>
        <P>
          <b className="text-foreground">Questions or concerns? </b>
          Reading this Privacy Notice will help you understand your privacy
          rights and choices. We are responsible for making decisions about how
          your personal information is processed. If you do not agree with our
          policies and practices, please do not use our Services. If you still
          have any questions or concerns, please contact us at <Mail />.
        </P>
      </div>

      <h2 className="mt-10 font-heading text-[19px] font-semibold text-foreground">
        Summary of key points
      </h2>
      <div className="mt-3 space-y-3">
        <P>
          <b className="text-foreground">What personal information do we process? </b>
          We process the email address you use to sign in, the access token
          Meta issues when you connect an advertising account, and the API key
          you enter to connect your local antidetect browser. We also receive
          advertising data from Meta on your behalf.
        </P>
        <P>
          <b className="text-foreground">Do we process sensitive personal information? </b>
          No. We do not process information such as racial or ethnic origin,
          sexual orientation, or religious beliefs.
        </P>
        {/* ПРАВКА 2. Генератор написал «We do not collect any information from
            third parties», а разделы 6 и 7 говорят обратное: данные приходят и
            от Меты, и уходят к AI-провайдерам. Документ не должен спорить сам
            с собой — разводим формулировку. */}
        <P>
          <b className="text-foreground">Do we collect information from third parties? </b>
          We do not buy or receive personal information about you from data
          brokers or advertising networks. We do receive data from Meta, but
          only the advertising data you explicitly authorise when you connect
          your account, and only for as long as that authorisation lasts.
        </P>
        <P>
          <b className="text-foreground">How do we process your information? </b>
          To provide, improve, and administer our Services, to communicate with
          you, for security and fraud prevention, and to comply with law. We
          process your information only when we have a valid legal reason.
        </P>
        <P>
          <b className="text-foreground">How do we keep your information safe? </b>
          We have organisational and technical measures in place. However, no
          electronic transmission or storage technology can be guaranteed to be
          100% secure.
        </P>
        <P>
          <b className="text-foreground">How do you exercise your rights? </b>
          Contact us at <Mail />, or follow the instructions on our{" "}
          <Link
            href="/data-request"
            className="text-primary-ink underline underline-offset-2"
          >
            data request page
          </Link>
          .
        </P>
      </div>

      <h2 className="mt-10 font-heading text-[19px] font-semibold text-foreground">
        Table of contents
      </h2>
      <ol className="mt-3 space-y-1 text-[14px] leading-relaxed">
        {TOC.map((t, i) => (
          <li key={t.id}>
            <a
              href={`#${t.id}`}
              className="text-primary-ink underline underline-offset-2"
            >
              {i + 1}. {t.label}
            </a>
          </li>
        ))}
      </ol>

      <Section id="collect" n={1} title="What information do we collect?">
        <H3>Personal information you disclose to us</H3>
        <Short>We collect personal information that you provide to us.</Short>
        <P>
          We collect personal information that you voluntarily provide to us
          when you register on the Services, when you connect an advertising
          account, or when you contact us. The personal information we collect
          may include the following:
        </P>
        <UL>
          <li>
            <b className="text-foreground">Email addresses</b> — used to create
            your account, to confirm it is yours, and to send you account emails
            such as a password reset.
          </li>
          <li>
            <b className="text-foreground">Your password</b> — stored only in a
            scrambled form that cannot be turned back into the password you
            typed. Nobody at Obelista can read it, and we never ask you for it.
          </li>
          <li>
            <b className="text-foreground">Contact or authentication data</b> —
            the access token issued by Meta when you connect an advertising
            account, and the local API key you enter to connect your antidetect
            browser.
          </li>
        </UL>
        <P>
          <b className="text-foreground">Sensitive information. </b>
          We do not process sensitive information.
        </P>

        {/* ПРАВКА 3. Раздела про разрешения Меты у генератора нет вовсе, а
            без него App Review не проходит: ревьюер требует, чтобы документ
            называл КАЖДОЕ запрошенное разрешение и то, что по нему берётся. */}
        <H3>Information we receive from Meta</H3>
        <P>
          When you connect a Facebook advertising account, Meta asks you to
          approve a specific set of permissions. We request only the following,
          and use each of them only as described here:
        </P>
        <UL>
          <li>
            <b className="text-foreground">ads_read</b> — to read your
            advertising accounts, their status and currency, and the
            impressions, clicks, spend, and delivery status of your ads. This is
            what the analytics in Obelista is built from.
          </li>
          <li>
            <b className="text-foreground">ads_management</b> — to create and
            change campaigns, ad sets, and ads at your explicit instruction.
            Everything Obelista creates is created paused.
          </li>
          <li>
            <b className="text-foreground">business_management</b> — to
            determine which business portfolio an advertising account belongs
            to, so accounts are grouped correctly.
          </li>
          <li>
            <b className="text-foreground">pages_show_list</b> and{" "}
            <b className="text-foreground">pages_read_engagement</b> — to list
            the Pages you may run ads from and to read the Instagram account
            linked to a Page.
          </li>
          <li>
            <b className="text-foreground">public_profile</b> — to show your
            name in the interface so you can tell connected accounts apart.
          </li>
        </UL>
        <P>
          We do not request and do not read your private messages, friends list,
          news feed, photos, or anything unrelated to advertising accounts.
        </P>

        <H3>Information automatically collected</H3>
        <Short>
          Some information — such as your IP address and browser characteristics
          — is collected automatically when you visit our Services.
        </Short>
        <P>
          We automatically collect certain information when you visit, use, or
          navigate the Services. This information does not reveal your specific
          identity but may include your IP address, browser type and settings,
          operating system, language preferences, referring URLs, and
          information about how and when you use our Services. It is needed to
          maintain the security and operation of our Services and for our
          internal analytics and reporting purposes.
        </P>
        <P>
          <b className="text-foreground">Log and usage data. </b>
          Service-related, diagnostic, usage, and performance information our
          servers automatically collect when you access or use our Services and
          which we record in log files.
        </P>
      </Section>

      <Section id="process" n={2} title="How do we process your information?">
        <Short>
          We process your information to provide, improve, and administer our
          Services, communicate with you, for security and fraud prevention, and
          to comply with law.
        </Short>
        <UL>
          <li>
            <b className="text-foreground">
              To facilitate account creation and authentication and otherwise
              manage user accounts.
            </b>{" "}
            So you can create and sign in to your account and keep it in working
            order.
          </li>
          <li>
            <b className="text-foreground">
              To deliver and facilitate delivery of services to the user.
            </b>{" "}
            To provide you with the analytics and campaign tools you asked for.
          </li>
          <li>
            <b className="text-foreground">
              To respond to user inquiries and offer support.
            </b>
          </li>
          <li>
            <b className="text-foreground">To send administrative information.</b>{" "}
            Including confirming your email address, password resets you ask
            for, and changes to our terms and policies.
          </li>
          <li>
            <b className="text-foreground">To protect our Services.</b>{" "}
            Including diagnosing problems, and monitoring and preventing fraud
            and abuse.
          </li>
          <li>
            <b className="text-foreground">To identify usage trends.</b> To
            understand how the Services are used so we can improve them.
          </li>
          <li>
            <b className="text-foreground">
              To save or protect an individual’s vital interest.
            </b>{" "}
            Where necessary to prevent harm.
          </li>
        </UL>
      </Section>

      <Section id="bases" n={3} title="What legal bases do we rely on to process your information?">
        <Short>
          We only process your personal information when we believe it is
          necessary and we have a valid legal reason to do so under applicable
          law.
        </Short>
        <P>
          The General Data Protection Regulation (GDPR) and UK GDPR require us
          to explain the valid legal bases we rely on. We may rely on the
          following:
        </P>
        <UL>
          <li>
            <b className="text-foreground">Consent.</b> Where you have given us
            permission to use your personal information for a specific purpose.
            You may withdraw your consent at any time.
          </li>
          <li>
            <b className="text-foreground">Performance of a contract.</b> Where
            necessary to fulfil our obligations to you, including providing our
            Services.
          </li>
          <li>
            <b className="text-foreground">Legitimate interests.</b> To analyse
            how our Services are used so we can improve them, and to diagnose
            problems and prevent fraudulent activity.
          </li>
          <li>
            <b className="text-foreground">Legal obligations.</b> Where
            necessary for compliance with law, or to exercise or defend our
            legal rights.
          </li>
          <li>
            <b className="text-foreground">Vital interests.</b> Where necessary
            to protect your vital interests or those of a third party.
          </li>
        </UL>
      </Section>

      <Section id="share" n={4} title="When and with whom do we share your personal information?">
        <Short>
          We may share information in the specific situations described in this
          section, and with the categories of third parties listed here.
        </Short>
        <P>
          <b className="text-foreground">
            Vendors, consultants, and other third-party service providers.{" "}
          </b>
          We may share your data with third parties who perform services for us
          or on our behalf and require access to do that work. We have contracts
          in place with them, designed to safeguard your personal information.
          They cannot do anything with your personal information unless we have
          instructed them to, and they may not share it with anyone apart from
          us.
        </P>
        <P>The categories of third parties we may share personal information with are:</P>
        <UL>
          <li>Cloud computing services</li>
          <li>Data storage service providers</li>
          <li>Website hosting service providers</li>
          <li>User account registration and authentication services</li>
          <li>Social networks — specifically Meta, whose API provides your advertising data</li>
        </UL>
        <P>
          <b className="text-foreground">Business transfers. </b>
          We may share or transfer your information in connection with, or
          during negotiations of, any merger, sale of company assets, financing,
          or acquisition of all or a portion of our business to another company.
        </P>
        <P>
          We do not sell your personal information, and we do not share it with
          advertisers or data brokers.
        </P>
      </Section>

      <Section id="cookies" n={5} title="Do we use cookies and other tracking technologies?">
        <Short>
          We use a small number of cookies, and only the ones needed for the
          Services to work.
        </Short>
        {/* ПРАВКА 4. Убраны два куска генератора: ссылка на несуществующий
            Cookie Notice (мёртвая ссылка в документе, который читает ревьюер)
            и абзац о том, что мы пускаем на сайт рекламные технологии третьих
            лиц — этого нет вовсе. */}
        <P>
          We use cookies to keep you signed in, to remember your interface
          preferences, and to maintain the security of your account. We do not
          use cookies for advertising, and we do not allow third parties to
          place advertising or tracking technologies on our Services.
        </P>
        <P>
          Most browsers accept cookies by default. You can set your browser to
          remove or reject cookies, but if you do, parts of the Services will
          stop working — you will not be able to stay signed in.
        </P>
      </Section>

      <Section id="ai" n={6} title="Do we offer artificial intelligence-based products?">
        <Short>
          We offer optional features powered by artificial intelligence. They
          run only when you start them.
        </Short>
        <P>
          As part of our Services, we offer features powered by artificial
          intelligence (“AI Products”). The terms in this Privacy Notice govern
          your use of the AI Products within our Services.
        </P>
        <H3>Use of AI technologies</H3>
        <P>
          We provide the AI Products through third-party service providers (“AI
          Service Providers”), including Anthropic and OpenAI. Where you use an
          AI Product, your input and the resulting output are shared with and
          processed by these AI Service Providers. You must not use the AI
          Products in any way that violates the terms or policies of any AI
          Service Provider.
        </P>
        <H3>Our AI Products</H3>
        <P>Our AI Products are designed for the following functions:</P>
        <UL>
          <li>
            <b className="text-foreground">AI insights</b> — analysing the
            performance of your creatives and suggesting what to scale or stop.
          </li>
          <li>
            <b className="text-foreground">AI automation</b> — assembling and
            launching campaigns from a specification you have approved.
          </li>
        </UL>
        <H3>How to opt out</H3>
        <P>
          The AI Products are optional and run only when you explicitly start
          them. If you never use them, none of your information is sent to any
          AI Service Provider. You can also contact us at <Mail /> with any
          question about this.
        </P>
      </Section>

      <Section id="social" n={7} title="How do we handle your social logins?">
        <Short>
          When you connect a Facebook advertising account, we receive a limited
          set of profile information from Meta.
        </Short>
        {/* ПРАВКА 5. Генератор перечислял «name, email address, friends list,
            and profile picture». Список друзей мы не запрашиваем и получить не
            можем — заявлять доступ, которого нет, на ревью Меты особенно
            опасно. Здесь перечислено то, что реально приходит. */}
        <P>
          Our Services let you connect your Facebook advertising account through
          Meta’s official login dialog. Where you choose to do this, we receive
          your name and your Facebook user ID, together with the advertising
          data covered by the permissions you approve — see{" "}
          <a href="#collect" className="text-primary-ink underline underline-offset-2">
            information we receive from Meta
          </a>{" "}
          above. We do not receive your friends list, your profile picture, your
          messages, or your feed.
        </P>
        <P>
          We use the information we receive only for the purposes described in
          this Privacy Notice. Please note that we do not control, and are not
          responsible for, other uses of your personal information by Meta. We
          recommend that you review their privacy notice to understand how they
          collect, use, and share your personal information.
        </P>
      </Section>

      <Section id="international" n={8} title="Is your information transferred internationally?">
        <Short>
          We may transfer, store, and process your information in countries
          other than your own.
        </Short>
        <P>
          Our servers are located in the United States. Regardless of your
          location, your information may be transferred to, stored by, and
          processed by us and by the third parties with whom we share it (see{" "}
          <a href="#share" className="text-primary-ink underline underline-offset-2">
            when and with whom do we share your personal information
          </a>
          ), including facilities in the United States and other countries.
        </P>
        <P>
          If you are a resident of the European Economic Area (EEA), the United
          Kingdom (UK), or Switzerland, these countries may not have data
          protection laws as comprehensive as those in your own. However, we
          will take all necessary measures to protect your personal information
          in accordance with this Privacy Notice and applicable law.
        </P>
        {/* ПРАВКА 6. Генератор писал про переносы «between our group
            companies». Группы компаний не существует — остаются только
            поставщики услуг. */}
        <H3>European Commission’s Standard Contractual Clauses</H3>
        <P>
          We rely on the European Commission’s Standard Contractual Clauses for
          transfers of personal information between us and our third-party
          service providers. These clauses require all recipients to protect
          personal information originating from the EEA or UK in accordance with
          European data protection law. Details can be provided on request.
        </P>
      </Section>

      <Section id="retention" n={9} title="How long do we keep your information?">
        <Short>
          We keep your information for as long as you have an account with us,
          unless a longer period is required by law.
        </Short>
        <P>
          We will only keep your personal information for as long as it is
          necessary for the purposes set out in this Privacy Notice, unless a
          longer retention period is required or permitted by law. No purpose in
          this notice will require us to keep your personal information for
          longer than the period in which you have an account with us.
        </P>
        {/* ПРАВКА 7. Отдельный абзац про немедленное удаление токена. Мета
            проверяет это на ревью прицельно, а кнопка «отключить» в панели уже
            работает — то есть это правда, а не обещание. */}
        <P>
          <b className="text-foreground">Access tokens are an exception. </b>
          When you disconnect an advertising account in Obelista, or revoke
          access from within your Facebook settings, the access token is deleted
          from our systems immediately — we do not wait for your account to be
          closed. From that moment we can no longer read anything from Meta on
          your behalf.
        </P>
        <P>
          When we have no ongoing legitimate business need to process your
          personal information, we will either delete or anonymise it, or, if
          this is not possible (for example, because it has been stored in
          backup archives), we will securely store it and isolate it from any
          further processing until deletion is possible.
        </P>
      </Section>

      <Section id="safety" n={10} title="How do we keep your information safe?">
        <Short>
          We aim to protect your personal information through a system of
          organisational and technical security measures.
        </Short>
        <P>
          We have implemented appropriate and reasonable technical and
          organisational security measures designed to protect the security of
          any personal information we process. However, despite our safeguards,
          no electronic transmission over the Internet or information storage
          technology can be guaranteed to be 100% secure, so we cannot promise
          or guarantee that hackers, cybercriminals, or other unauthorised third
          parties will not be able to defeat our security and improperly
          collect, access, steal, or modify your information. You should only
          access the Services within a secure environment.
        </P>
      </Section>

      <Section id="minors" n={11} title="Do we collect information from minors?">
        <Short>
          We do not knowingly collect data from or market to children under 18
          years of age.
        </Short>
        <P>
          We do not knowingly collect, solicit data from, or market to children
          under 18 years of age, nor do we knowingly sell such personal
          information. By using the Services, you represent that you are at
          least 18. If we learn that personal information from users less than
          18 years of age has been collected, we will deactivate the account and
          take reasonable measures to promptly delete such data from our
          records. If you become aware of any data we may have collected from
          children under age 18, please contact us at <Mail />.
        </P>
      </Section>

      <Section id="rights" n={12} title="What are your privacy rights?">
        <Short>
          In some regions, such as the EEA, the UK, and Switzerland, you have
          rights that allow you greater access to and control over your personal
          information.
        </Short>
        <P>
          These may include the right (i) to request access and obtain a copy of
          your personal information, (ii) to request rectification or erasure,
          (iii) to restrict the processing of your personal information, (iv) if
          applicable, to data portability, and (v) not to be subject to
          automated decision-making. In certain circumstances, you may also have
          the right to object to the processing of your personal information.
        </P>
        <P>
          You can make such a request by contacting us at <Mail />, or through
          our{" "}
          <Link
            href="/data-request"
            className="text-primary-ink underline underline-offset-2"
          >
            data request page
          </Link>
          . We will consider and act upon any request in accordance with
          applicable data protection laws.
        </P>

        <H3>Complaints</H3>
        <P>
          If you are located in the EEA or UK and you believe we are unlawfully
          processing your personal information, you have the right to complain
          to your Member State data protection authority or the UK Information
          Commissioner’s Office. If you are located in Switzerland, you may
          contact the Federal Data Protection and Information Commissioner.
        </P>
        <P>
          If you complain to us first: we will acknowledge your complaint within
          30 days of receiving it, investigate without unjustifiable delay, and
          keep you informed of progress and of the outcome.
        </P>

        <H3>Withdrawing your consent</H3>
        <P>
          If we are relying on your consent to process your personal
          information, you have the right to withdraw it at any time by
          contacting us at <Mail />. Please note that this will not affect the
          lawfulness of the processing before its withdrawal, nor will it affect
          processing conducted in reliance on lawful grounds other than consent.
        </P>

        <H3>Account information</H3>
        <P>
          If you would at any time like to review or change the information in
          your account, or terminate your account, you can contact us using the
          contact information provided. Upon your request to terminate your
          account, we will deactivate or delete your account and information
          from our active databases. However, we may retain some information to
          prevent fraud, troubleshoot problems, assist with investigations,
          enforce our legal terms, and/or comply with applicable legal
          requirements.
        </P>
      </Section>

      <Section id="dnt" n={13} title="Controls for do-not-track features">
        <P>
          Most web browsers and some mobile operating systems include a
          Do-Not-Track (“DNT”) feature you can activate to signal your privacy
          preference not to have data about your online browsing activities
          monitored and collected. At this stage, no uniform technology standard
          for recognising and implementing DNT signals has been finalised. As
          such, we do not currently respond to DNT browser signals or any other
          mechanism that automatically communicates your choice not to be
          tracked online. If a standard for online tracking is adopted that we
          must follow in the future, we will inform you about that practice in a
          revised version of this Privacy Notice.
        </P>
      </Section>

      <Section id="updates" n={14} title="Do we make updates to this notice?">
        <Short>
          Yes, we will update this notice as necessary to stay compliant with
          relevant laws.
        </Short>
        <P>
          We may update this Privacy Notice from time to time. The updated
          version will be indicated by an updated date at the top of this
          Privacy Notice. If we make material changes, we may notify you either
          by prominently posting a notice of such changes or by directly sending
          you a notification. We encourage you to review this Privacy Notice
          frequently.
        </P>
      </Section>

      <Section id="contact" n={15} title="How can you contact us about this notice?">
        <P>
          If you have questions or comments about this notice, you may email us
          at <Mail /> or contact us by post at:
        </P>
        <address className="not-italic text-[14px] leading-relaxed text-muted-foreground">
          Digital Theory
          <br />7 rue George Sand
          <br />
          Rueil-Malmaison 92500
          <br />
          France
        </address>
      </Section>

      <Section id="review" n={16} title="How can you review, update, or delete the data we collect from you?">
        <P>
          Based on the applicable laws of your country, you may have the right
          to request access to the personal information we collect from you,
          details about how we have processed it, correct inaccuracies, or
          delete your personal information. You may also have the right to
          withdraw your consent to our processing. These rights may be limited
          in some circumstances by applicable law.
        </P>
        <P>
          To review, update, or delete your personal information, follow the
          instructions on our{" "}
          <Link
            href="/data-request"
            className="text-primary-ink underline underline-offset-2"
          >
            data request page
          </Link>
          , or write to us at <Mail />.
        </P>
      </Section>

      <footer className="mt-12 flex flex-wrap gap-4 border-t border-border pt-4">
        <Link
          href="/data-request"
          className="text-[13px] text-primary-ink underline underline-offset-2"
        >
          Request access to or deletion of your data
        </Link>
        <Link href="/terms" className="text-[13px] text-primary-ink underline underline-offset-2">
          Terms of Service
        </Link>
      </footer>
    </main>
  );
}
