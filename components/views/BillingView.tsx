"use client";

/* Лист «Billing» — что человек подключает, сколько это стоит, как считается
 * срок у крипты и где встанет инвойс Cryptomus (иссус #128).
 *
 * ЧТО ИЗМЕНИЛОСЬ ПРОТИВ ПЕРВОЙ ВЕРСИИ ЛИСТА. Тогда провайдера не было вовсе,
 * и весь лист был про это. Теперь владелец выбрал: только крипта, Cryptomus.
 * Stripe отложен намеренно — юрлица нет. Ключей мерчанта тоже нет, поэтому
 * инвойс сегодня не создаётся ничем, и на его месте стоит ЧЕСТНАЯ заглушка:
 * она говорит, что оплата не подключена, и показывает, из каких шагов
 * оплата будет состоять. Не крутящийся спиннер, не кнопка, которая «сейчас
 * откроет окно», не форма — ровно текст о том, чего нет.
 *
 * КРАСНАЯ ЛИНИЯ ФАЙЛА ОСТАЛАСЬ ПРЕЖНЕЙ: здесь нет ни одного поля ввода. У
 * крипты реквизиты — это адрес кошелька провайдера, и показывает его
 * провайдер, а не мы. Своё поле «куда платить» — приглашение отправить
 * деньги в никуда, если строку однажды подменят.
 *
 * ВТОРАЯ КРАСНАЯ ЛИНИЯ: в этом файле нет ни одного числа про деньги. Цены,
 * их формат и длины триалов приезжают из `@/lib/billing-plans`, сроки и
 * грейс — из `@/lib/billing`. Владелец правит цену в одной строке, а не
 * ищет её по вёрстке.
 *
 * «use client» появился (раньше лист был серверным): выбор тарифа — это
 * состояние, и без него нельзя показать экран ожидания оплаты, который
 * задача требует прямо.
 */

import * as React from "react";
import {
  AlertTriangle,
  ArrowRight,
  BellRing,
  CalendarDays,
  Check,
  Coins,
  Lock,
  Minus,
  Timer,
  Wrench,
} from "lucide-react";
import { PAGE_PAD, PAGE_WIDTH } from "@/components/shell/page";
import { Button } from "@/components/ui/button";
import {
  BILLING_STATES,
  GRACE_DAYS,
  INVOICE_STEPS,
  NOT_CONNECTED_CONTEXT,
  PROVIDER,
  REMINDER_DAYS_BEFORE,
  RESTRICTED_KEEPS,
  RESTRICTED_STOPS,
  billingAccessLine,
  billingState,
  billingStateDescription,
  billingStateLabel,
  billingStateTone,
  invoiceReady,
  type BillingStateKind,
  type BillingTone,
} from "@/lib/billing";
import {
  PLANS,
  TRIALS,
  planById,
  planPriceLine,
  planSocialsLine,
  type Plan,
  type PlanId,
} from "@/lib/billing-plans";
import { cn } from "@/lib/utils";

const TONE_CLASS: Record<BillingTone, { dot: string; text: string; border: string; bg: string }> = {
  warning: { dot: "bg-warning", text: "text-warning", border: "border-warning/30", bg: "bg-warning-soft" },
  normal: { dot: "bg-muted-foreground", text: "text-foreground", border: "border-border", bg: "bg-card" },
};

export function BillingView() {
  /* Состояние сегодня одно и то же для любого посетителя: ключей мерчанта
     нет. Контекст не читается ниоткуда — источника у него не существует. */
  const state = billingState(NOT_CONNECTED_CONTEXT);
  /* Выбранный тариф — единственное настоящее состояние листа. Ничего никуда
     не отправляет: он открывает экран оплаты, который честно говорит, чего
     нет. */
  const [chosen, setChosen] = React.useState<PlanId | null>(null);

  return (
    <div className={cn(PAGE_WIDTH, PAGE_PAD, "flex flex-col gap-6 py-5")}>
      <header>
        <h1 className="font-heading text-lg font-semibold">Billing</h1>
        <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
          What each plan turns on, how a crypto subscription counts its term, and what happens when
          it runs out. Payment is by crypto only for now.
        </p>
      </header>

      <NotConnectedNotice />
      <PlansSection chosen={chosen} onChoose={setChosen} />
      <CheckoutSection chosen={chosen} onClear={() => setChosen(null)} />
      <TrialsSection />
      <TermSection />
      <RestrictedSection />
      <StatusSection state={state} />
      <StateGlossary />
    </div>
  );
}

/** Баннер сверху, один раз и крупно. Не «выберите тариф» и не «оплата
 *  временно недоступна»: провайдер ВЫБРАН, а нет у него ключей — это разные
 *  факты, и человек, который видит цены, должен сразу знать, что заплатить
 *  сегодня он не сможет. */
function NotConnectedNotice() {
  return (
    <div role="status" className="rounded-lg border border-warning/40 bg-warning-soft px-3 py-2.5">
      <div className="flex items-start gap-2">
        <AlertTriangle className="mt-0.5 size-4 flex-none text-warning" strokeWidth={1.8} aria-hidden />
        <div className="min-w-0">
          <div className="text-xs font-medium">Payments are not connected yet</div>
          <p className="mt-0.5 text-xs leading-relaxed text-muted-foreground">
            The provider is chosen — crypto through{" "}
            <span className="font-medium text-foreground">{PROVIDER.name}</span>. {PROVIDER.why} Cards
            are a separate story and deliberately postponed: they need a legal entity, and there is
            none yet.
          </p>
        </div>
      </div>
    </div>
  );
}

/* --- Тарифы --------------------------------------------------------------- */

function PlansSection({
  chosen,
  onChoose,
}: {
  chosen: PlanId | null;
  onChoose: (id: PlanId) => void;
}) {
  return (
    <section>
      <h2 className="font-heading text-base font-semibold">Plans</h2>
      <p className="mt-1 max-w-2xl text-xs leading-relaxed text-muted-foreground">
        Three plans, each a calendar month. What a plan promises but the product cannot do yet is
        marked as such right in the list — the same features show up as «not built yet» on your
        profile, and finding that out after paying would be a lie of the expensive kind.
      </p>
      <div className="mt-3 grid gap-3 lg:grid-cols-3">
        {PLANS.map((p) => (
          <PlanCard key={p.id} plan={p} chosen={chosen === p.id} onChoose={() => onChoose(p.id)} />
        ))}
      </div>
    </section>
  );
}

function PlanCard({ plan, chosen, onChoose }: { plan: Plan; chosen: boolean; onChoose: () => void }) {
  return (
    <div
      className={cn(
        "flex flex-col rounded-xl border bg-card p-4 transition",
        chosen ? "border-accent" : "border-border",
      )}
    >
      <div className="flex items-baseline justify-between gap-2">
        <span className="font-heading text-base font-semibold">{plan.name}</span>
        <span className="tnum text-sm font-medium text-foreground">{planPriceLine(plan)}</span>
      </div>
      <p className="mt-1 text-[11.5px] leading-relaxed text-muted-foreground">{plan.tagline}</p>
      <p className="mt-2 text-xs font-medium text-foreground">{planSocialsLine(plan)}</p>

      <ul className="mt-2 flex flex-1 flex-col gap-1.5">
        {plan.features.map((f) => (
          <li key={f.text} className="flex items-start gap-2 text-[11.5px] leading-relaxed">
            {f.built ? (
              <Check className="mt-0.5 size-3.5 flex-none text-success" strokeWidth={2} aria-hidden />
            ) : (
              <Wrench className="mt-0.5 size-3.5 flex-none text-warning" strokeWidth={1.8} aria-hidden />
            )}
            <span className={f.built ? "text-muted-foreground" : "text-muted-foreground"}>
              {f.text}
              {f.built ? null : <span className="ml-1 text-2xs text-warning">not built yet</span>}
            </span>
          </li>
        ))}
        {plan.missing.map((m) => (
          <li
            key={m}
            className="flex items-start gap-2 text-[11.5px] leading-relaxed text-faint"
          >
            <Minus className="mt-0.5 size-3.5 flex-none" strokeWidth={1.8} aria-hidden />
            <span>{m}</span>
          </li>
        ))}
      </ul>

      <Button
        className="mt-3 w-full"
        size="sm"
        variant={chosen ? "default" : "outline"}
        onClick={onChoose}
      >
        {chosen ? "Chosen" : "Choose " + plan.name}
      </Button>
    </div>
  );
}

/* --- Оплата: экран ожидания и честная заглушка ---------------------------- */

/** То, ради чего в задаче слова «зазор под открытие инвойса». Здесь стоял бы
 *  инвойс Cryptomus; сегодня стоит объяснение, чего нет, и из каких шагов
 *  будет состоять оплата, когда ключи появятся.
 *
 *  ПОЧЕМУ НЕ СПИННЕР И НЕ «СКОРО». Экран ожидания, который ничего не ждёт, —
 *  это работающая на вид оплата: человек оставляет вкладку открытой и
 *  считает, что платёж в пути. Поэтому «ждать» здесь нечего, и сказано это
 *  первым же предложением. */
function CheckoutSection({ chosen, onClear }: { chosen: PlanId | null; onClear: () => void }) {
  if (!chosen) return null;
  const plan = planById(chosen);
  const inv = invoiceReady();

  return (
    <section className="rounded-xl border border-border bg-card p-4">
      <div className="flex flex-wrap items-center gap-2">
        <Coins className="size-4 text-muted-foreground" strokeWidth={1.8} aria-hidden />
        <h2 className="font-heading text-base font-semibold">Pay with crypto</h2>
        <span className="text-xs text-muted-foreground">
          {plan.name} · <span className="tnum">{planPriceLine(plan)}</span>
        </span>
        <Button className="ml-auto" size="xs" variant="ghost" onClick={onClear}>
          Change plan
        </Button>
      </div>

      {inv.ready ? null : (
        <div className="mt-3 rounded-lg border border-dashed border-warning/40 bg-warning-soft px-3 py-2.5">
          <div className="flex items-start gap-2">
            <Lock className="mt-0.5 size-4 flex-none text-warning" strokeWidth={1.8} aria-hidden />
            <div>
              <div className="text-xs font-medium">
                No invoice can be created — payment is not connected
              </div>
              <p className="mt-0.5 text-[11.5px] leading-relaxed text-muted-foreground">
                {inv.why} Nothing is waiting in the background, nothing was reserved, and this plan
                is not selected anywhere but on your screen. When the keys exist, this block becomes
                the provider&apos;s invoice: an address, an amount and a countdown, shown by{" "}
                {PROVIDER.name} itself.
              </p>
            </div>
          </div>
        </div>
      )}

      <ol className="mt-3 flex flex-col gap-2">
        {INVOICE_STEPS.map((s, i) => (
          <li key={s.id} className="flex items-start gap-2.5 rounded-lg border border-border bg-elevated px-3 py-2.5">
            <span className="tnum mt-0.5 grid size-5 flex-none place-items-center rounded-full bg-card text-2xs text-muted-foreground">
              {i + 1}
            </span>
            <span className="min-w-0">
              <span className="block text-[12.5px] font-medium text-foreground">{s.title}</span>
              <span className="mt-0.5 block text-[11.5px] leading-relaxed text-muted-foreground">
                {s.description}
              </span>
            </span>
          </li>
        ))}
      </ol>
    </section>
  );
}

/* --- Триалы ---------------------------------------------------------------- */

/** Два триала, и разница между ними — не щедрость, а механика: карта умеет
 *  автосписание, крипта не умеет вовсе. Недоступны сегодня оба, но по разным
 *  причинам, и обе названы — общее «пока нельзя» скрыло бы, что одно ждёт
 *  юрлица, а другое ключей. */
function TrialsSection() {
  return (
    <section>
      <h2 className="font-heading text-base font-semibold">Trials</h2>
      <div className="mt-2 grid gap-2 sm:grid-cols-2">
        {TRIALS.map((t) => (
          <div key={t.id} className="rounded-xl border border-dashed border-border px-3 py-2.5">
            <div className="flex items-baseline justify-between gap-2">
              <span className="text-[12.5px] font-medium text-foreground">{t.title}</span>
              <span className="tnum text-xs text-muted-foreground">
                {t.days} {t.days === 1 ? "day" : "days"}
              </span>
            </div>
            <p className="mt-1 text-[11.5px] leading-relaxed text-muted-foreground">
              <span className="text-foreground">{t.requires}.</span> {t.ending}
            </p>
            {t.available ? null : (
              <p className="mt-1 text-2xs leading-relaxed text-faint">{t.why}</p>
            )}
          </div>
        ))}
      </div>
    </section>
  );
}

/* --- Срок ------------------------------------------------------------------ */

/** Главная сложность задачи, и она не в вёрстке: у крипты нет автосписания.
 *  Этот блок объясняет человеку ровно это — почему его никто не спишет, как
 *  считается месяц, что будет, если он пропустит срок. */
function TermSection() {
  const items = [
    {
      icon: CalendarDays,
      title: "A calendar month, counted from the day you paid",
      text: "Not thirty days. Paid on the 31st — the term ends on the 30th or 28th, whichever the next month has, and the anchor day never drifts on later renewals.",
    },
    {
      icon: Coins,
      title: "Nothing is ever charged on its own",
      text: "Crypto has no auto-charge — a wallet gives nobody the right to pull money from it. Renewing is always a payment you decide to make.",
    },
    {
      icon: BellRing,
      title: "Reminders before the end, not after",
      text: `Because renewal is manual, a reminder comes ${REMINDER_DAYS_BEFORE.join(", ")} days before the term ends — not once, and not every day either.`,
    },
    {
      icon: Timer,
      title: "A grace window after it",
      text: `When the term ends, access continues for ${GRACE_DAYS} more days. A transfer confirms in minutes, not instantly, and a payment made on Friday evening should not lock anyone out on Saturday.`,
    },
  ];
  return (
    <section className="rounded-xl border border-border bg-card p-4">
      <h2 className="font-heading text-base font-semibold">How the term works</h2>
      <p className="mt-1 max-w-2xl text-xs leading-relaxed text-muted-foreground">
        A crypto subscription is not a subscription the way a card one is: there is no standing
        permission to charge you. So the term is counted here, by us, and every step of it is
        announced before it happens.
      </p>
      <div className="mt-3 grid gap-2 sm:grid-cols-2">
        {items.map((i) => (
          <div key={i.title} className="rounded-lg border border-border bg-elevated px-3 py-2.5">
            <div className="flex items-center gap-2">
              <i.icon className="size-4 flex-none text-muted-foreground" strokeWidth={1.8} aria-hidden />
              <span className="text-[12.5px] font-medium text-foreground">{i.title}</span>
            </div>
            <p className="mt-1 text-[11.5px] leading-relaxed text-muted-foreground">{i.text}</p>
          </div>
        ))}
      </div>
    </section>
  );
}

/** «Ограничивается, а не пропадает» — требование владельца, разложенное на
 *  два списка. Без них слово «ограничен» каждый додумает по-своему, и
 *  половина решит, что у них удалили цифры. */
function RestrictedSection() {
  return (
    <section className="rounded-xl border border-border bg-card p-4">
      <h2 className="font-heading text-base font-semibold">If the term runs out</h2>
      <div className="mt-2 grid gap-3 sm:grid-cols-2">
        <div>
          <div className="text-xs font-medium text-foreground">What still works</div>
          <ul className="mt-1.5 flex flex-col gap-1.5">
            {RESTRICTED_KEEPS.map((t) => (
              <li key={t} className="flex items-start gap-2 text-[11.5px] leading-relaxed text-muted-foreground">
                <Check className="mt-0.5 size-3.5 flex-none text-success" strokeWidth={2} aria-hidden />
                <span>{t}</span>
              </li>
            ))}
          </ul>
        </div>
        <div>
          <div className="text-xs font-medium text-foreground">What stops</div>
          <ul className="mt-1.5 flex flex-col gap-1.5">
            {RESTRICTED_STOPS.map((t) => (
              <li key={t} className="flex items-start gap-2 text-[11.5px] leading-relaxed text-muted-foreground">
                <Minus className="mt-0.5 size-3.5 flex-none text-warning" strokeWidth={1.8} aria-hidden />
                <span>{t}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </section>
  );
}

/* --- Состояние и глоссарий -------------------------------------------------- */

function StateDot({ tone }: { tone: BillingTone }) {
  return <span aria-hidden className={cn("size-2.5 flex-none rounded-full", TONE_CLASS[tone].dot)} />;
}

function StateCard({ state }: { state: BillingStateKind }) {
  const tone = billingStateTone(state);
  const t = TONE_CLASS[tone];
  return (
    <div className={cn("rounded-lg border px-3 py-2.5", t.border, t.bg)}>
      <div className="flex items-center gap-1.5">
        <StateDot tone={tone} />
        <span className={cn("text-[12.5px] font-medium", t.text)}>{billingStateLabel(state)}</span>
        <code className="ml-auto font-mono text-2xs text-faint">{state}</code>
      </div>
      <p className="mt-1 text-[11.5px] leading-relaxed text-muted-foreground">
        {billingStateDescription(state)}
      </p>
      <p className="mt-1 text-2xs text-faint">{billingAccessLine(state)}</p>
    </div>
  );
}

function StatusSection({ state }: { state: BillingStateKind }) {
  return (
    <section className="rounded-xl border border-border bg-card p-4">
      <div className="flex items-center gap-2">
        <h2 className="font-heading text-base font-semibold">Your billing status</h2>
        <ArrowRight className="size-3.5 text-faint" strokeWidth={1.8} aria-hidden />
        <span className="text-xs text-muted-foreground">{billingStateLabel(state)}</span>
      </div>
      <p className="mt-1 max-w-xl text-xs leading-relaxed text-muted-foreground">
        This is the state every account is in right now, and it comes from the same model the rest of
        the page reads — not from a phrase written next to it.
      </p>
      <div className="mt-3">
        <StateCard state={state} />
      </div>
    </section>
  );
}

function StateGlossary() {
  return (
    <section>
      <h2 className="font-heading text-base font-semibold">All billing states</h2>
      <p className="mt-1 max-w-2xl text-xs text-muted-foreground">
        Seven, and a subscription is only ever in one of them. There is no «payment failed» and no
        «cancelled» among them on purpose: crypto has no charge that can fail and no renewal to
        cancel — not paying is the cancellation.
      </p>
      <div className="mt-2 flex flex-col gap-2">
        {BILLING_STATES.map((s) => (
          <StateCard key={s} state={s} />
        ))}
      </div>
    </section>
  );
}
