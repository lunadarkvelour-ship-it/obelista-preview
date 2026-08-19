"use client";

/* Выбор периода для листа кампаний — и подпись под ним, которая не даёт
 * ошибиться в том, что именно посчитано (#154).
 *
 * ПОЧЕМУ ЭТО ОДИН КОМПОНЕНТ, А НЕ РЯД КНОПОК В ВЁРСТКЕ ЛИСТА. Владелец
 * потребовал прямым текстом: «не должно быть приблизительных значений,
 * случайного смешивания lifetime-данных, другого периода или неправильных
 * границ дня». Кнопки без подписи ровно это и дают: человек нажал «7 days»,
 * увидел сумму и ДОСТРОИЛ остальное сам — что окно кончается сегодня, что
 * данные есть за все семь дней, что сутки его. Любое из трёх может быть
 * неправдой, и ни одно не видно из кнопки.
 *
 * Поэтому здесь два этажа, и второй обязателен:
 *
 *   1. чем управляют — пресеты и произвольный диапазон;
 *   2. ЧТО ПОЛУЧИЛОСЬ — даты из ответа демона, пояс, из скольких дней собрана
 *      сумма, и оговорка про кабинет, чьи сутки не совпадают с нашими.
 *
 * Второй этаж читает ТОЛЬКО ответ (`resolved`), а не выбор человека. Разница
 * принципиальная: выбор — это просьба, а ответ — это то, что посчитано. Пока
 * запрос не вернулся, подпись честно говорит, что периода ещё не знает, вместо
 * того чтобы подписать старые цифры новыми датами.
 *
 * Арифметики дат здесь нет ни одной: «какое сегодня число» знает `core/period.py`
 * в поясе продукта, панель получает готовые даты. Причина — в `lib/period.ts`.
 */

import * as React from "react";
import { Button } from "@/components/coss";
import { CalendarRange } from "lucide-react";
import { cn } from "@/lib/utils";
import { CTRL, CTRL_IDLE, CTRL_ON, SEG, SEG_OFF, SEG_ON, SEG_WRAP } from "@/components/analytics/controls";
import { DateRangeField } from "@/components/ui/DateRangeField";
import { Tip } from "@/components/ui/tooltip";
import { ПРЕСЕТЫ, TZ_ПО_УМОЛЧАНИЮ, type PeriodQuery } from "@/lib/period";
import type { Period } from "@/lib/campaigns";

/** Что сказать про сутки кабинета. Отдельной функцией, потому что это
 *  утверждение о точности, а не украшение: три состояния и три разных текста.
 *
 *  `null` — пояса кабинета мы не знаем (на живом парке таких больше половины:
 *  137 кабинетов из 268 с пустым `tz`), и это НЕ «совпадает». Молчание здесь
 *  читалось бы как подтверждение. */
export function оСутках(p?: Period | null): string {
  if (!p) return "";
  if (p.same_day_boundary === true) {
    return `Day boundaries match: this ad account runs on ${p.account_tz}, the same offset as ${p.tz}.`;
  }
  if (p.same_day_boundary === false) {
    return (
      `Meta cuts days by the ad account's own clock (${p.account_tz}), not by ${p.tz}. ` +
      `The numbers are that account's ${p.since}…${p.until}, which starts and ends at a ` +
      `different moment than yours. There is no finer breakdown to convert — this is how ` +
      `Meta reports daily spend.`
    );
  }
  return (
    `We do not know this ad account's timezone, so we cannot say whether its day ` +
    `boundaries match ${p.tz}. Meta cuts days by the account's own clock, not ours.`
  );
}

/** Из скольких дней окна собрана сумма — словами и без обвинений.
 *
 *  День без строк расхода НЕ ЗНАЧИТ «не собрали»: сбор заводит строки только
 *  там, где деньги были. Замер на живой базе 15.08, окно 08.08–14.08, ПО
 *  КАБИНЕТАМ С ДЕНЬГАМИ В ЭТОМ ОКНЕ (их 86 из 268 в парке): у 19 из них данные
 *  есть ровно за один день недели просто потому, что остальные шесть они не
 *  крутились. Поэтому текст называет факт и не трактует его — трактовка была бы
 *  тем самым сторожем, который запрещает больше, чем должен. */
export function оПолноте(p?: Period | null): string {
  if (!p || p.days_with_data == null) return "";
  if (p.days <= 1) return "";
  return `Spend rows for ${p.days_with_data} of ${p.days} days in this range. ` +
    `A day with no rows means the account either did not run or was not collected that day.`;
}

/** Глубина хранения: почему за длинный период пусто. Показываем только когда
 *  окно реально уходит за неё — иначе это шум на каждом экране. */
export function оХранении(p?: Period | null): string {
  if (!p?.stored_from || p.since >= p.stored_from) return "";
  return `The earliest day we hold spend for is ${p.stored_from}. Anything before that is ` +
    `empty because it is not kept (retention) or was never collected — not because the ` +
    `money went missing.`;
}

export function PeriodPicker({
  value,
  resolved,
  onChange,
  busy,
  className,
  суткиТекст,
}: {
  /** Что выбрано — просьба человека. */
  value: PeriodQuery;
  /** Что посчитано — ответ демона. `null`, пока ответа нет. */
  resolved?: Period | null;
  onChange: (next: PeriodQuery) => void;
  busy?: boolean;
  className?: string;
  /** Своя фраза про границы суток вместо `оСутках`.
   *
   *  Нужна листу, который считает деньги ПОПЕРЁК ПАРКА: там кабинетов много, и
   *  «this ad account runs on…» — неправда по форме, а не только по смыслу.
   *  Фразу собирает `оСуткахПарка` из `lib/period`, и она приезжает сюда
   *  готовой, чтобы у продукта не завелось двух мест, решающих, что сказать про
   *  сутки. Не передали — работает `оСутках`, то есть лист одного кабинета
   *  ничего не замечает. */
  суткиТекст?: string;
}) {
  /* Календарь открывается по кнопке, а не стоит развёрнутым: произвольный
     диапазон — редкий случай (байеру нужны «вчера» и «неделя»), а поле дат в
     ряду занимает места больше всех пресетов вместе. */
  const свой = !value.preset;
  const [открыт, setОткрыт] = React.useState(свой);

  /* Даты для календаря. Свои — из выбора, иначе из ОТВЕТА: тогда открытие
     календаря на пресете начинается с тех дат, которые человек сейчас видит, а
     не с пустого поля. Пока ответа нет — пусто, и это честно. */
  const since = value.since || resolved?.since || "";
  const until = value.until || resolved?.until || "";

  const пояс = resolved?.tz || TZ_ПО_УМОЛЧАНИЮ;
  const подпись = resolved
    ? `${resolved.since} … ${resolved.until} · ${пояс}`
    : `period not confirmed yet · ${пояс}`;
  const оговорки = [оПолноте(resolved), оХранении(resolved),
                    суткиТекст ?? оСутках(resolved)]
    .filter(Boolean)
    .join("\n\n");

  return (
    <div className={cn("flex flex-wrap items-center gap-2", className)}>
      <div className={SEG_WRAP}>
        {ПРЕСЕТЫ.map((п) => {
          const on = value.preset === п.id;
          return (
            <Button
              key={п.id}
              disabled={!!busy}
              onClick={() => onChange({ preset: п.id })}
              className={cn(SEG, on ? SEG_ON : SEG_OFF)}
            >
              {п.label}
            </Button>
          );
        })}
      </div>

      <Button
        disabled={!!busy}
        onClick={() => setОткрыт((v) => !v)}
        className={cn(CTRL, свой ? CTRL_ON : CTRL_IDLE)}
      >
        <CalendarRange className="size-3.5 flex-none" />
        Custom
      </Button>

      {открыт && (
        <DateRangeField
          since={since}
          until={until}
          /* Пара дат заменяет пресет целиком, а не дополняет его: демон
             принимает ЛИБО одно, ЛИБО другое, и отправить оба значило бы
             задать один вопрос дважды. */
          onChange={(a, b) => onChange({ since: a, until: b })}
        />
      )}

      {/* ── Что именно посчитано ────────────────────────────────────────────
          Даты стоят НА ЭКРАНЕ, а не в подсказке: пресет «7 days» без них — это
          обещание, которое человек толкует сам. У Меты `last_7d` сегодня не
          включает, у нас включает; оба варианта законны, незаконна догадка. */}
      <Tip content={оговорки || `Numbers are computed for this range in ${пояс}.`}>
        <span
          className={cn(
            "tnum inline-flex items-center gap-1.5 rounded-lg border border-border",
            "bg-card px-2.5 py-[6px] text-[12px] tabular-nums",
            resolved ? "text-muted-foreground" : "text-ghost",
          )}
        >
          {подпись}
          {/* Знак «есть оговорка» — точкой, а не текстом: оговорка длинная и
              нужна не всем, но её наличие обязано быть видно боковым зрением.
              Молчаливая оговорка равна её отсутствию. */}
          {оговорки && <span className="size-1.5 flex-none rounded-full bg-warning" />}
        </span>
      </Tip>
    </div>
  );
}
