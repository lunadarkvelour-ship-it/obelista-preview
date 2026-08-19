"use client";

/* Всё, что лист аналитики показывает ВМЕСТО таблицы.
 *
 * Вынесено из `AnalyticsView` не ради опрятности, а чтобы стало проверяемым.
 * `panel/vitest.config.ts` собирает только `lib/**`, тестов в `components/`
 * нет ни одного, и приёмка 14.08 показала цену этого: из вёрстки вырезали
 * пустое состояние целиком и подменили его заголовок ровно на признак поломки
 * — оба раза 502 теста из 502 остались зелёными. То есть между честным текстом
 * и признаком аварии не стояло ничего, кроме глаз читающего дифф.
 *
 * Лист целиком отрисовать в тесте нельзя: данные приезжают эффектом, а
 * `renderToStaticMarkup` эффектов не выполняет — до пустого среза так не
 * добраться. Отдельный компонент, принимающий готовый `kind`, добраться даёт.
 *
 * ПОЧЕМУ ТЕКСТ ЗДЕСЬ ВАЖНЕЕ ОБЫЧНОГО. Прод — чистый лист: у каждого юзера
 * панель начинается с нуля и наполняется с первого OAuth. Значит это не редкий
 * случай, а ПЕРВОЕ, что человек видит, и по нему он решает, работает продукт
 * или сломан.
 *
 * ДВЕ ВЕТКИ ПУСТОТЫ ЧЕСТНЫ ОБЕ, И ЭТО НАМЕРЕННО. На нулевой базе в облаке
 * заранее неизвестно, что придёт: пустой ответ (`empty-range`) или упавший
 * запрос (`error`). Пока честной была одна, различать успех и аварию можно
 * было только угадав, какая из них появится. Теперь обе говорят, что
 * произошло и что делать дальше, — и гадать не нужно вовсе.
 */

import Link from "next/link";
import { Button } from "@/components/coss";
import type { EmptyKind } from "@/lib/analytics-empty";

const БЛОК = "rounded-xl border border-border bg-card px-4 py-10 text-center";
const ДЕЙСТВИЕ =
  "focus-ring mt-3 inline-flex min-h-9 items-center rounded-lg border border-border "
  + "bg-card px-3 text-xs outline-none transition-colors duration-150 hover:border-border-strong";

/** Пустое состояние листа аналитики.
 *
 *  `kind === "table"` сюда не приходит: в этом случае лист рисует таблицу и
 *  этот компонент не зовётся вовсе. Возвращаем `null`, а не бросаем: падать
 *  на экране человека из-за нашей же ошибки в ветвлении — худшее из двух. */
export function AnalyticsEmpty({
  kind,
  detail,
  onRetry,
}: {
  kind: EmptyKind;
  /** Что именно ответила сеть. Показывается приглушённо и только при ошибке. */
  detail?: string | null;
  onRetry: () => void;
}) {
  if (kind === "table") return null;

  if (kind === "empty-range") {
    /* Причин у пустоты две — не с чего собирать и нечего показать за ЭТОТ
       диапазон, — и различить их отсюда нечем: список профилей антидетекта в
       облаке пуст всегда. Поэтому текст не ставит диагноз, а называет механизм
       и оба выхода. Утверждать «у тебя не подключён аккаунт», не проверив, —
       то же враньё, только свежее. */
    return (
      <div className={БЛОК}>
        <p className="text-[13px] font-medium">Nothing in this range yet</p>
        <p className="mx-auto mt-1 max-w-md text-xs leading-relaxed text-muted-foreground">
          Spend and creatives come from Meta for the accounts you have connected. Pick a wider
          date range above, or connect an account to start collecting.
        </p>
        <Link href="/socials" className={ДЕЙСТВИЕ}>
          Go to profiles
        </Link>
      </div>
    );
  }

  if (kind === "error") {
    /* Прежде здесь не было ничего: ошибка показывалась узкой красной полосой
       наверху, а на месте таблицы оставалась пустота. Пустота под полосой
       читается как «оно ещё и сломалось», и человек не знает, потеряны ли
       цифры. Не потеряны — и это надо сказать словами.
       Инструкции разработчика («запусти демон такой-то командой») здесь нет
       намеренно: в облаке этой команды у человека нет и быть не может. */
    return (
      <div className={БЛОК}>
        <p className="text-[13px] font-medium">Could not load the numbers</p>
        <p className="mx-auto mt-1 max-w-md text-xs leading-relaxed text-muted-foreground">
          The collector did not answer. Nothing is lost — your data is still there, this is only
          about showing it. Try again in a moment.
        </p>
        {detail && (
          <p className="mx-auto mt-1.5 max-w-md break-words text-2xs text-faint">{detail}</p>
        )}
        <Button onClick={onRetry} className={ДЕЙСТВИЕ}>
          Try again
        </Button>
      </div>
    );
  }

  return (
    <div className={`${БЛОК} text-[13px] text-muted-foreground`}>
      {kind === "loading"
        ? "Loading…"
        : kind === "all-columns-off"
          ? "Every column is turned off — pick at least one in the column picker above."
          : "The range has not been requested yet."}
    </div>
  );
}
