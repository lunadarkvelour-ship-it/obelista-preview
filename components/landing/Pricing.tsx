/* Цены и пробные периоды на публичной витрине (#134).
 *
 * НИ ОДНОГО ЧИСЛА В ЭТОМ ФАЙЛЕ НЕТ, И ЭТО ГЛАВНОЕ. Цены и длины триалов
 * приезжают из `@/lib/billing-plans` — там они лежат ровно в одном месте
 * (#128), и правка цены обязана оставаться правкой одной строки. Написать
 * «$19» здесь значит завести второй источник цены: витрина и биллинг разъедутся
 * в первый же день, когда владелец поправит одно из двух, — а расходятся такие
 * пары молча, и обнаруживает их клиент, которому выставили не то, что обещали.
 *
 * ЦЕНЫ — ПРЕДЛОЖЕНИЕ ВЛАДЕЛЬЦУ, А НЕ ЕГО РЕШЕНИЕ. Solo 19, Pro 39, Team 49 в
 * месяц названы устно как стартовая точка (ночь 15.08) и НЕ УТВЕРЖДЕНЫ. Пока
 * «да» не сказано, страница остаётся черновиком предложения; править цену —
 * `@/lib/billing-plans`, `priceUsdMonthly`.
 *
 * ЧТО ЕЩЁ НЕ НАПИСАНО — СКАЗАНО НА ВИТРИНЕ, А НЕ ПОСЛЕ ОПЛАТЫ. У части пунктов
 * тарифа стоит `built: false` (трекеры, CRM, общая медиатека). Продать строку
 * списка, за которой пока нет кода, — обман, который вскроется в первый же день;
 * поэтому такой пункт не выкидывается, а подписан прямо здесь.
 *
 * ТРИАЛ, КОТОРЫЙ НЕЛЬЗЯ НАЧАТЬ, НЕ ОБЕЩАЕТСЯ КАК ДОСТУПНЫЙ. Оба сегодня
 * `available: false` — оплата ещё не подключена. Условия показываем (владелец
 * просил именно условия), но рядом честно стоит, что открыть его прямо сейчас
 * нельзя. Признак читается из модели: как только оплату подключат и флаг
 * перевернут, витрина перестанет это писать сама.
 */
import { cn } from "@/lib/utils";
import {
  PLANS, TRIALS, planPriceLine, planSocialsLine, type Plan,
} from "@/lib/billing-plans";

function Тариф({ plan, выделен }: { plan: Plan; выделен: boolean }) {
  return (
    /* Средний тариф выделен рамкой, а не размером: карточка выше соседей ломает
       строку цен, по которой глаз идёт слева направо. */
    <div
      className={cn(
        "flex flex-col rounded-xl border bg-card p-5",
        выделен ? "border-primary/50" : "border-border",
      )}
    >
      <div className="flex items-baseline justify-between gap-2">
        <h3 className="font-heading text-[16px] font-semibold text-foreground">{plan.name}</h3>
        {выделен && (
          <span className="rounded-md bg-primary-soft px-2 py-0.5 text-[10.5px] font-medium text-primary-ink">
            most buyers
          </span>
        )}
      </div>
      <div className="tnum mt-2 font-heading text-[26px] font-semibold tracking-tight text-foreground">
        {planPriceLine(plan)}
      </div>
      <p className="mt-1.5 text-[13px] leading-relaxed text-muted-foreground">{plan.tagline}</p>
      <div className="mt-4 border-t border-border pt-4 text-[12.5px] font-medium text-foreground">
        {planSocialsLine(plan)}
      </div>
      <ul className="mt-3 space-y-2">
        {plan.features.map((f) => (
          <li key={f.text} className="flex gap-2 text-[13px] leading-relaxed text-muted-foreground">
            {/* Галка ТОЛЬКО у написанного. Галка рядом с подписью «not built
                yet» — это два противоположных утверждения в одной строке, и
                глаз верит значку, а не словам. */}
            <span
              aria-hidden
              className={cn("mt-[3px] text-[11px]", f.built ? "text-primary-ink" : "text-faint")}
            >
              {f.built ? "✓" : "○"}
            </span>
            <span className="min-w-0">
              {f.text}
              {!f.built && (
                /* Пункт назван владельцем, но кода за ним пока нет. Стоит
                   рядом со строкой, а не сноской внизу: сноску читают после
                   решения, а решение принимают здесь. */
                <span className="ml-1.5 whitespace-nowrap rounded border border-border px-1 py-px text-[10px] text-faint">
                  not built yet
                </span>
              )}
            </span>
          </li>
        ))}
      </ul>
      {!!plan.missing.length && (
        <ul className="mt-3 space-y-1.5 border-t border-border pt-3">
          {plan.missing.map((m) => (
            <li key={m} className="flex gap-2 text-[12.5px] leading-relaxed text-faint">
              <span aria-hidden className="mt-px">
                —
              </span>
              <span className="min-w-0">{m}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export function Pricing({ панель }: { панель: string }) {
  return (
    <section id="pricing" className="mt-20 scroll-mt-20">
      <h2 className="font-heading text-[19px] font-semibold tracking-tight text-foreground">
        Pricing
      </h2>
      <p className="mt-2 max-w-xl text-[13.5px] leading-relaxed text-muted-foreground">
        One workspace per subscription. The plan sets how many social profiles you connect —
        everything each plan includes is listed, and so is everything it leaves out.
      </p>

      <div className="mt-6 grid gap-3 sm:grid-cols-3">
        {PLANS.map((p) => (
          <Тариф key={p.id} plan={p} выделен={p.id === "pro"} />
        ))}
      </div>

      {/* ── ТРИАЛЫ ────────────────────────────────────────────────────────
          Их два, и они разные не по щедрости, а по механике оплаты: карта
          умеет автосписание, крипта не умеет вовсе. Поэтому по карте срок
          длиннее и с привязкой, а по крипте короче и без предоплаты. */}
      <div className="mt-6 grid gap-3 sm:grid-cols-2">
        {TRIALS.map((t) => (
          <div key={t.id} className="rounded-xl border border-border bg-card p-5">
            <div className="flex items-baseline gap-2">
              <h3 className="font-heading text-[14.5px] font-semibold text-foreground">
                {t.title}
              </h3>
              <span className="tnum text-[13px] text-muted-foreground">{t.days} days</span>
            </div>
            <p className="mt-2 text-[13px] leading-relaxed text-muted-foreground">
              <span className="text-foreground">To start:</span> {t.requires}
            </p>
            <p className="mt-1.5 text-[13px] leading-relaxed text-muted-foreground">
              <span className="text-foreground">When it ends:</span> {t.ending}
            </p>
            {!t.available && (
              /* Своя короткая фраза, а не поле `why` из модели: там внутренняя
                 причина для нас (юрлицо, ключи мерчанта), и посетителю она
                 ничего не объясняет. Сказать надо одно — начать нельзя. */
              <p className="mt-3 rounded-lg border border-border px-2.5 py-1.5 text-[12px] leading-relaxed text-faint">
                Not open yet — payment is still being set up. The terms above are what it will be.
              </p>
            )}
          </div>
        ))}
      </div>

      <div className="mt-6">
        <a
          href={`${панель}/login`}
          className="focus-ring inline-block rounded-lg bg-primary px-4 py-2.5 text-[14px] font-medium text-primary-foreground! outline-none transition-colors duration-150 hover:bg-primary-hover"
        >
          Create a workspace
        </a>
      </div>
    </section>
  );
}
