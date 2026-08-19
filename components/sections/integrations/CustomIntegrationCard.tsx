/* Карточка «свой источник» — дверь для самописного трекера.
 *
 * СТОИТ ПЕРВОЙ И НА ВСЮ ШИРИНУ, и это прямое требование владельца с высоким
 * приоритетом: место под самописный источник должно быть ВИДНО, даже пока
 * подключать нечего. Список из шести чужих имён читается как «поддерживается
 * только это»; у байера трекер часто свой, и он обязан понять с первого
 * экрана, что дверь для него есть.
 *
 * ВИДНА ДВЕРЬ, А НЕ ИНСТРУКЦИЯ (#157). До сжатия карточка разворачивала на
 * пол-экрана два столбца: четыре шага контракта с описаниями, четыре правила и
 * два «чего не хватает». Это документация для того, кто СЕЙЧАС садится писать
 * модуль, — а лист читают, чтобы узнать, что подключено. Объём пояснений сам по
 * себе обещает работающий механизм, которого нет. Поэтому наверху осталась
 * дверь одной строкой, а контракт уехал в раскрывашку: ни слова не потеряно,
 * лист короче.
 *
 * У карточки НЕТ состояния подключения, и это не забывчивость. Состояние
 * описывает конкретное подключение, а здесь его не существует: подключать
 * нечего, пока человек не написал модуль. Вечное «не подключено» было бы
 * неправдой — это не поломка и не незавершённая настройка, а приглашение.
 * Поэтому рамка пунктирная и цвета состояния на ней нет ни одного.
 */

import { ChevronRight, Code2 } from "lucide-react";
import { CUSTOM_INTEGRATION } from "@/lib/integrations-custom";

export function CustomIntegrationCard() {
  const doc = CUSTOM_INTEGRATION;
  return (
    <article className="rounded-xl border border-dashed border-border-strong bg-elevated">
      <div className="flex items-start gap-2.5 px-3 pt-3">
        <span
          aria-hidden
          className="flex size-9 flex-none items-center justify-center rounded-lg border border-border bg-card text-muted-foreground"
        >
          <Code2 className="size-4" strokeWidth={1.8} />
        </span>
        <div className="min-w-0">
          <h3 className="font-heading text-sm font-semibold">{doc.title}</h3>
          <p className="mt-0.5 text-xs leading-relaxed text-muted-foreground">{doc.blurb}</p>
        </div>
      </div>

      {/* Раскрывашка нативная — странице не нужен ни один хук. Сторож
          `integrations.test.ts` проверяет, что имя и приглашение стоят ВЫШЕ
          неё: дверь обязана быть видна без нажатия, а инструкция — нет. */}
      <details className="group mt-2.5 border-t border-border">
        <summary className="flex cursor-pointer list-none items-center gap-1.5 px-3 py-2 text-xs font-medium text-primary-ink outline-none hover:bg-hover focus-visible:ring-2 focus-visible:ring-ring">
          <ChevronRight
            className="size-3.5 flex-none transition-transform group-open:rotate-90"
            strokeWidth={2}
            aria-hidden
          />
          What writing one takes
        </summary>

        <div className="grid gap-4 border-t border-border px-3 py-2.5 lg:grid-cols-2">
          <section>
            <div className="text-2xs font-medium text-muted-foreground">
              Four answers a source has to give
            </div>
            <p className="mt-1 text-2xs text-faint">
              One module, and it lives at <code className="font-mono text-foreground">{doc.where}</code>.
            </p>
            <ol className="mt-2 flex flex-col gap-2">
              {doc.steps.map((s, i) => (
                <li key={s.name} className="flex gap-2">
                  <span
                    aria-hidden
                    className="mt-0.5 flex size-4 flex-none items-center justify-center rounded-full border border-border bg-card font-mono text-[9px] text-faint"
                  >
                    {i + 1}
                  </span>
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-baseline gap-x-1.5">
                      <span className="text-xs font-medium">{s.title}</span>
                      <code className="font-mono text-2xs text-faint">{s.name}</code>
                    </div>
                    <p className="mt-0.5 text-2xs leading-relaxed text-muted-foreground">{s.body}</p>
                  </div>
                </li>
              ))}
            </ol>
          </section>

          <section className="flex flex-col gap-4">
            <div>
              <div className="text-2xs font-medium text-muted-foreground">
                Rules that break the numbers quietly if ignored
              </div>
              <ul className="mt-2 flex flex-col gap-1.5">
                {doc.rules.map((r) => (
                  <li key={r} className="flex gap-1.5 text-2xs leading-relaxed text-muted-foreground">
                    <span aria-hidden className="mt-1.5 size-1 flex-none rounded-full bg-ghost" />
                    <span>{r}</span>
                  </li>
                ))}
              </ul>
            </div>

            <div>
              <div className="text-2xs font-medium text-muted-foreground">What this page can&apos;t do for you</div>
              <ul className="mt-2 flex flex-col gap-1.5">
                {doc.missing.map((m) => (
                  <li key={m} className="flex gap-1.5 text-2xs leading-relaxed text-faint">
                    <span aria-hidden className="mt-1.5 size-1 flex-none rounded-full bg-ghost" />
                    <span>{m}</span>
                  </li>
                ))}
              </ul>
            </div>
          </section>
        </div>
      </details>
    </article>
  );
}
