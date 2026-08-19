"use client";

/* Диапазон дат одним виджетом: «с … по …» плюс календарь на два месяца.
 *
 * Почему диапазонный, а не два отдельных поля. Срез всегда задаётся парой, и
 * при двух независимых календарях выбор «с 20 июля по 3 августа» — это два
 * захода вслепую: во втором не видно, откуда считаешь. В одном календаре
 * промежуток подсвечен целиком, и границу видно, пока её двигаешь.
 *
 * Почему сегменты, а не текстовое поле. Сегмент принимает только цифры в
 * допустимых пределах: тринадцатый месяц или 31 февраля туда физически не
 * набираются. Свободный ввод такого не гарантирует ничем.
 *
 * Русская локаль и понедельник первым днём приходят от I18nProvider в AppShell.
 */

import * as React from "react";
import { CalendarDays, ChevronLeft, ChevronRight } from "lucide-react";
import {
  Button,
  CalendarCell,
  CalendarGrid,
  CalendarGridBody,
  CalendarGridHeader,
  CalendarHeaderCell,
  CalendarHeading,
  DateInput,
  DateRangePicker,
  DateSegment,
  Dialog,
  Group,
  Popover,
  RangeCalendar,
} from "react-aria-components";
import { getLocalTimeZone, parseDate, today, type CalendarDate } from "@internationalized/date";
import { cn } from "@/lib/utils";

function toCalendar(iso: string): CalendarDate | null {
  try {
    return /^\d{4}-\d{2}-\d{2}$/.test(iso) ? parseDate(iso) : null;
  } catch {
    return null;
  }
}

/* Вариант пишется через data-атрибут: react-aria вешает на сегмент
   `data-type="day|month|year|literal"`. Короткой записи `type-literal:` в
   Tailwind нет — она молча выбрасывается, и точки между числами теряются. */
const segment =
  "tnum rounded px-[1px] text-[12.5px] tabular-nums outline-none " +
  "text-foreground focus:bg-primary focus:text-primary-foreground " +
  "data-[placeholder]:text-ghost " +
  "data-[type=literal]:px-0 data-[type=literal]:text-ghost " +
  "data-[type=literal]:focus:bg-transparent";

export function DateRangeField({
  since,
  until,
  onChange,
  className,
}: {
  /** ISO `гггг-мм-дд`. */
  since: string;
  until: string;
  onChange: (since: string, until: string) => void;
  className?: string;
}) {
  const value = React.useMemo(() => {
    const a = toCalendar(since);
    const b = toCalendar(until);
    return a && b ? { start: a, end: b } : null;
  }, [since, until]);

  return (
    <DateRangePicker
      aria-label="Date range"
      value={value}
      /* Будущее выбирать нечем: данных за него нет, а пустой срез читается как
         поломка. Верхняя граница — сегодня. */
      maxValue={today(getLocalTimeZone())}
      onChange={(v) => {
        if (v?.start && v?.end) onChange(v.start.toString(), v.end.toString());
      }}
      className={cn("flex flex-col", className)}
    >
      <Group className="focus-within:focus-ring flex items-center gap-1 rounded-lg border border-border bg-input py-1 pl-2 pr-1 transition-colors data-[open]:border-primary-line">
        <span className="microlabel select-none text-faint">from</span>
        <DateInput slot="start" className="flex items-center">
          {(s) => <DateSegment segment={s} className={segment} />}
        </DateInput>

        <span aria-hidden className="px-0.5 text-ghost">
          —
        </span>

        <span className="microlabel select-none text-faint">to</span>
        <DateInput slot="end" className="flex items-center">
          {(s) => <DateSegment segment={s} className={segment} />}
        </DateInput>

        <Button
          aria-label="Open calendar"
          /* Зона нажатия расширена псевдоэлементом до высоты поля. Замерено:
             видимая кнопка 22×22 при норме 40 — в плотном ряду это значит
             целиться, а промах ставит курсор в сегмент даты и начинает его
             править. Сама иконка остаётся мелкой: ряд рассчитан на 30px. */
          className="focus-ring relative ml-0.5 rounded-md p-1 text-faint outline-none
                     transition-colors after:absolute after:-inset-[7px] after:content-['']
                     hover:bg-secondary hover:text-foreground"
        >
          <CalendarDays aria-hidden className="size-3.5" />
        </Button>
      </Group>

      <Popover
        placement="bottom start"
        offset={6}
        className="rounded-xl border border-border bg-popover p-3 shadow-lg outline-none"
      >
        <Dialog className="outline-none">
          {/* Два месяца рядом: почти любой рабочий срез укладывается в них без
              перелистывания, а «с конца прошлого месяца по сегодня» видно
              целиком. */}
          <RangeCalendar visibleDuration={{ months: 2 }} className="flex gap-4">
            {[0, 1].map((i) => (
              <div key={i} className="w-[236px]">
                <header className="mb-2 flex items-center">
                  {i === 0 ? (
                    <Button
                      slot="previous"
                      className="focus-ring rounded-md p-1 text-muted-foreground outline-none transition-colors hover:bg-secondary hover:text-foreground"
                    >
                      <ChevronLeft aria-hidden className="size-4" />
                    </Button>
                  ) : (
                    <span className="size-6" />
                  )}
                  <CalendarHeading
                    offset={{ months: i }}
                    className="flex-1 text-center text-[13px] font-medium text-foreground"
                  />
                  {i === 1 ? (
                    <Button
                      slot="next"
                      className="focus-ring rounded-md p-1 text-muted-foreground outline-none transition-colors hover:bg-secondary hover:text-foreground"
                    >
                      <ChevronRight aria-hidden className="size-4" />
                    </Button>
                  ) : (
                    <span className="size-6" />
                  )}
                </header>

                <CalendarGrid offset={{ months: i }} className="w-full border-spacing-0">
                  <CalendarGridHeader>
                    {(day) => (
                      <CalendarHeaderCell className="pb-1 text-[11px] font-normal text-ghost">
                        {day}
                      </CalendarHeaderCell>
                    )}
                  </CalendarGridHeader>
                  <CalendarGridBody>
                    {(date) => (
                      <CalendarCell
                        date={date}
                        className={({
                          isSelected,
                          isSelectionStart,
                          isSelectionEnd,
                          isDisabled,
                          isUnavailable,
                          isOutsideMonth,
                        }) =>
                          cn(
                            "flex size-[30px] cursor-default items-center justify-center text-[12.5px] outline-none transition-colors",
                            isOutsideMonth && "invisible",
                            // Середина промежутка — сплошная полоса без скруглений,
                            // чтобы диапазон читался как отрезок, а не как точки.
                            isSelected && "bg-primary-soft text-foreground",
                            isSelectionStart && "rounded-l-full bg-primary text-primary-foreground",
                            isSelectionEnd && "rounded-r-full bg-primary text-primary-foreground",
                            !isSelected && !isDisabled && "rounded-full hover:bg-secondary",
                            (isDisabled || isUnavailable) && "text-ghost",
                          )
                        }
                      />
                    )}
                  </CalendarGridBody>
                </CalendarGrid>
              </div>
            ))}
          </RangeCalendar>
        </Dialog>
      </Popover>
    </DateRangePicker>
  );
}
