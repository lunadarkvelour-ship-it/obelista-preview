/* Посадочная страница корневого домена `obelista.com`.
 *
 * ЗАЧЕМ ОНА ОТДЕЛЬНАЯ ОТ `/`. Сюда приходит человек, который ещё НЕ клиент:
 * ему нужно понять, что это, и войти или завести учётку. На `app.obelista.com`
 * приходит тот, кто уже работает, и первое, что он должен увидеть, — свою
 * панель, а не рассказ о продукте. Одна страница на две эти задачи всегда
 * обслуживает одну из них плохо.
 *
 * ЧТО ЗДЕСЬ ПОЯВИЛОСЬ (#134). Каркас был заглушкой с текстами, перенесёнными
 * со старой публичной страницы: они проверены ревью Меты и потому безопасны,
 * но ничего не продают — там сказано ЧТО продукт делает и не сказано, зачем
 * человеку менять то, как он работает сегодня. Дописано ровно это: чем это
 * лучше рук в Ads Manager, кому подходит, сколько стоит и на каких условиях
 * пробовать.
 *
 * ПРИОРИТЕТ КАЧЕСТВА ЗДЕСЬ НИЗКИЙ — слова владельца: «можно выполнять около
 * заглушечно». Поэтому страница честная и по делу, но не вылизанная: ни
 * скриншотов продукта, ни отзывов, ни анимаций. Кто придёт вылизывать —
 * дописывает поверх, а не переписывает: разметка разделов уже отвечает на
 * вопросы в том порядке, в каком их задают.
 *
 * ЦЕНЫ И ТРИАЛЫ ЖИВУТ НЕ ЗДЕСЬ, а в `@/lib/billing-plans` (см. шапку
 * `components/landing/Pricing.tsx`): второе число на второй странице — это
 * вторая цена, и разъезжаются такие пары молча.
 */
import Link from "next/link";
import { Logo } from "@/components/brand/Logo";
import { Pricing } from "@/components/landing/Pricing";
import { PLANS } from "@/lib/billing-plans";

const ПАНЕЛЬ = process.env.NEXT_PUBLIC_PANEL_URL || "https://app.obelista.com";

function Способность({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-border bg-card p-5 transition-colors duration-200 hover:border-border-strong">
      <h3 className="font-heading text-[15px] font-semibold text-foreground">{title}</h3>
      <p className="mt-2 text-[13.5px] leading-relaxed text-muted-foreground">{children}</p>
    </div>
  );
}

/** Строка сравнения «рукой» / «здесь». Пара, а не два независимых списка:
 *  утверждение о продукте без утверждения о сегодняшнем дне читателю нечем
 *  измерить, и он пропускает оба. */
function Пара({ рукой, здесь }: { рукой: string; здесь: string }) {
  return (
    <>
      <li className="border-t border-border py-3 text-[13.5px] leading-relaxed text-muted-foreground">
        {рукой}
      </li>
      <li className="border-t border-border py-3 text-[13.5px] leading-relaxed text-foreground">
        {здесь}
      </li>
    </>
  );
}

function Шаг({ n, title, children }: { n: number; title: string; children: React.ReactNode }) {
  return (
    <li className="flex gap-4">
      <span className="tnum mt-0.5 flex size-7 flex-none items-center justify-center rounded-lg border border-border text-[12px] text-muted-foreground">
        {n}
      </span>
      <div className="min-w-0">
        <div className="text-[14.5px] font-medium text-foreground">{title}</div>
        <p className="mt-1 text-[13.5px] leading-relaxed text-muted-foreground">{children}</p>
      </div>
    </li>
  );
}

export default function Landing() {
  return (
    <div className="min-h-dvh">
      {/* ── Шапка. Вход и регистрация СПРАВА ВВЕРХУ ─────────────────────────
          Там их ищут, и там их ждёт человек, пришедший по ссылке из переписки:
          он не читает страницу, он ищет дверь. */}
      <header className="sticky top-0 z-10 border-b border-border bg-background/80 backdrop-blur">
        <div className="mx-auto flex h-14 max-w-4xl items-center gap-4 px-5">
          <Link href="/" aria-label="Obelista" className="text-foreground">
            <Logo className="h-5 w-auto" />
          </Link>
          <nav className="ml-auto flex items-center gap-2">
            <Link
              href={`${ПАНЕЛЬ}/login`}
              className="focus-ring rounded-lg px-3 py-1.5 text-[13px] text-muted-foreground outline-none transition-colors duration-150 hover:text-foreground"
            >
              Log in
            </Link>
            <Link
              href={`${ПАНЕЛЬ}/login`}
              className="focus-ring rounded-lg bg-primary px-3.5 py-1.5 text-[13px] font-medium text-primary-foreground! outline-none transition-colors duration-150 hover:bg-primary-hover"
            >
              Sign up
            </Link>
          </nav>
        </div>
      </header>

      <main className="mx-auto max-w-4xl px-5 pb-20 pt-16">
        {/* ── ГЕРОЙ ─────────────────────────────────────────────────────────
            Обещание одним предложением, без превосходных степеней: человек,
            который льёт трафик, читает их как шум. «Лучший», «мощный» и
            «революционный» на этой странице не появятся намеренно. */}
        <p className="microlabel text-muted-foreground">for media buyers</p>
        <h1 className="mt-3 max-w-2xl text-balance font-heading text-[34px] font-semibold leading-[1.15] tracking-tight text-foreground sm:text-[42px]">
          Every creative, every account, one table
        </h1>
        <p className="mt-4 max-w-xl text-[15px] leading-relaxed text-muted-foreground">
          Obelista connects to your Meta advertising accounts and shows what each creative
          costs — across every account at once. From the same place you set a campaign up once
          and create it on all the accounts you choose.
        </p>
        <div className="mt-7 flex flex-wrap items-center gap-3">
          <Link
            href={`${ПАНЕЛЬ}/login`}
            className="focus-ring rounded-lg bg-primary px-4 py-2.5 text-[14px] font-medium text-primary-foreground! outline-none transition-colors duration-150 hover:bg-primary-hover"
          >
            Get started
          </Link>
          <Link
            href="#pricing"
            className="focus-ring rounded-lg border border-border px-4 py-2.5 text-[14px] text-muted-foreground outline-none transition-colors duration-150 hover:border-border-strong hover:text-foreground"
          >
            See pricing
          </Link>
          <span className="text-[13px] text-muted-foreground">
            Your own workspace. Nothing shared with anyone.
          </span>
        </div>

        {/* ── СПОСОБНОСТИ ───────────────────────────────────────────────── */}
        <section className="mt-16 grid gap-3 sm:grid-cols-3">
          <Способность title="Spend by creative">
            Daily spend, clicks and results per ad, grouped by the creative behind them — so you
            see which one earns and which one burns.
          </Способность>
          <Способность title="Delivery at a glance">
            Which ads are active, paused, rejected or stopped for billing, without opening each
            account by hand.
          </Способность>
          <Способность title="Launch in bulk">
            One setup — objective, budget, targeting, placements, creatives — created across the
            accounts you choose.
          </Способность>
        </section>

        {/* ── ЧЕМ ЭТО ЛУЧШЕ РУК В ADS MANAGER ────────────────────────────
            Главный вопрос человека, у которого уже открыт Ads Manager: он
            умеет там всё, и «у нас удобнее» ему ничего не говорит. Поэтому
            сравнение конкретное и попарное — слева то, что он делает сегодня,
            справа то, что вместо этого. Ни одной строки про то, чего Ads
            Manager «не умеет»: он умеет, вопрос в том, сколько это стоит рук
            при двадцати кабинетах. */}
        <section className="mt-16">
          <h2 className="font-heading text-[19px] font-semibold tracking-tight text-foreground">
            Why not just Ads Manager
          </h2>
          <p className="mt-2 max-w-xl text-[13.5px] leading-relaxed text-muted-foreground">
            Everything below can be done by hand. The question is what it costs you at twenty
            accounts, every day, before you have made a single decision.
          </p>
          <div className="mt-6 grid grid-cols-[1fr_1fr] gap-x-6">
            <div className="microlabel pb-1 text-faint">by hand</div>
            <div className="microlabel pb-1 text-primary-ink">with Obelista</div>
            <Пара
              рукой="One account per tab. Twenty accounts is twenty tabs and a spreadsheet assembled by evening — and it is stale by morning."
              здесь="Every connected account in one table, collected in the cloud while your machine is off."
            />
            <Пара
              рукой="Spend is reported per ad. Which creative earns and which burns is something you piece together yourself, by ad names."
              здесь="Spend, clicks and results grouped by the creative behind the ads, across all accounts at once."
            />
            <Пара
              рукой="A campaign is built once per account. The same clicks twenty times, and the one typo you find on the third day."
              здесь="One spec, created on every account you choose — and always paused, so nothing spends before you look at it."
            />
            <Пара
              рукой="Watching for a threshold means someone actually watching, at night and on weekends."
              здесь="Rules act on the numbers themselves: a metric crosses a line, the ad set is paused without you."
            />
          </div>
        </section>

        {/* ── КОМУ ПОДХОДИТ ──────────────────────────────────────────────
            Берём формулировки из тарифов, а не сочиняем вторые: «кому это» и
            «за что он платит» обязаны быть одним предложением, иначе человек
            узнаёт себя в описании и не находит себя в ценах. */}
        <section className="mt-16">
          <h2 className="font-heading text-[19px] font-semibold tracking-tight text-foreground">
            Who it is for
          </h2>
          <ul className="mt-5 space-y-3">
            {PLANS.map((p) => (
              <li key={p.id} className="flex flex-wrap items-baseline gap-x-2.5">
                <span className="text-[14px] font-medium text-foreground">{p.name}</span>
                <span className="text-[13.5px] leading-relaxed text-muted-foreground">
                  {p.tagline}
                </span>
              </li>
            ))}
          </ul>
          <p className="mt-5 max-w-xl text-[13.5px] leading-relaxed text-muted-foreground">
            It is not for someone running one account by hand — one account fits in Ads Manager,
            and paying for a second screen to look at it would be a worse deal than doing nothing.
          </p>
        </section>

        {/* ── ПОЗИЦИЯ ПРО ВОРОНКУ ───────────────────────────────────────────
            ЭТО НЕ ДИСКЛЕЙМЕР МЕЛКИМ ШРИФТОМ, а требование владельца сказать
            прямо. Поэтому блок стоит ДО цены, занимает целую полосу и написан
            обычным кеглем: сноска под ценой читается после решения, а речь идёт
            о том, имеет ли смысл платить вообще.

            Довод не маркетинговый. Спенд отвечает только на «сколько стоило»;
            «сколько принесло» знает воронка, и без неё автоправило действует по
            половине картины — то есть тушит по цене клика то, что окупалось
            депозитами. Продавая продукт без этой строки, мы продавали бы
            уверенность, которой он в таком виде не даёт. */}
        <section className="mt-16 rounded-xl border border-warning/40 bg-warning-soft px-5 py-5">
          <h2 className="font-heading text-[17px] font-semibold tracking-tight text-foreground">
            Connect your funnel data. Without it, we do not recommend using this.
          </h2>
          <p className="mt-2.5 max-w-2xl text-[13.5px] leading-relaxed text-muted-foreground">
            Spend tells you what an ad cost. It never tells you what it earned. Registrations,
            contacts and deposits come back from your tracker or your CRM — and every decision this
            product helps you make rests on them: which creative to scale, which ad set to stop,
            and what an automation rule is allowed to do while you sleep.
          </p>
          <p className="mt-2.5 max-w-2xl text-[13.5px] leading-relaxed text-muted-foreground">
            Without that data the table on your screen is half the picture, and a rule acting on
            half a picture pauses the wrong thing — confidently, and at night. We would rather say
            this here than have you find it out on your own money. Trackers and CRMs connect from
            inside the workspace; do that first, then trust the numbers.
          </p>
        </section>

        {/* ── КАК ЭТО РАБОТАЕТ ──────────────────────────────────────────── */}
        <section className="mt-16">
          <h2 className="font-heading text-[19px] font-semibold tracking-tight text-foreground">
            How it works
          </h2>
          <ol className="mt-5 space-y-5">
            <Шаг n={1} title="Connect your advertising accounts">
              You sign in with Facebook Login for Business and grant Obelista access to the
              advertising accounts you choose. Nothing is connected without your consent.
            </Шаг>
            <Шаг n={2} title="Obelista reads your advertising data">
              The list of your ad accounts, their status and currency, daily spend per ad, and
              the delivery status of each ad. That is what the analytics is built from.
            </Шаг>
            <Шаг n={3} title="You launch campaigns">
              You configure the campaign and Obelista creates it through the Marketing API.
              Everything is created paused — nothing starts spending until you review it and
              switch it on yourself.
            </Шаг>
          </ol>
        </section>

        {/* ── ЦЕНЫ ──────────────────────────────────────────────────────────
            Последним разделом, и это порядок вопросов, а не скромность: цену
            спрашивают, когда уже поняли, за что платят. Кто пришёл именно за
            ней — жмёт «See pricing» в герое и попадает сюда. */}
        <Pricing панель={ПАНЕЛЬ} />

        {/* ── ЮРСНОСКИ МЕЛКО ────────────────────────────────────────────────
            Владелец просил убрать их с глаз и «запрятать в микро-ссылочки».
            Убрать СОВСЕМ нельзя: без достижимых privacy и terms не подать ни
            заявку на верификацию бизнеса, ни App Review. */}
        <footer className="mt-20 border-t border-border pt-6">
          <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-[11.5px] text-faint">
            <span>Obelista is operated by Digital Theory.</span>
            <Link href="/privacy" className="underline underline-offset-2 hover:text-muted-foreground">
              Privacy
            </Link>
            <Link href="/terms" className="underline underline-offset-2 hover:text-muted-foreground">
              Terms
            </Link>
            <Link href="/data-request" className="underline underline-offset-2 hover:text-muted-foreground">
              Data request
            </Link>
          </div>
        </footer>
      </main>
    </div>
  );
}
