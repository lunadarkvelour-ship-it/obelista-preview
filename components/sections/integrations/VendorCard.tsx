/* Карточка одного подключения — общая на оба раздела листа.
 *
 * В ЭТОМ ФАЙЛЕ НЕТ НИ ОДНОГО ИМЕНИ ВЕНДОРА, и это не стилистика. Иссус #126
 * требует, чтобы карточка не была прибита к имени, а иссус #26 объясняет
 * цену нарушения: плоский клиент, названный по имени в десяти файлах, стоил
 * отдельной работы «до адаптеров, а не вместе с ними». Здесь то же правило с
 * фронтовой стороны — трекер и антидетект рисует ОДИН компонент, а всё, чем
 * они отличаются, приезжает данными из модуля вендора. Тест
 * `lib/__tests__/integrations.test.ts` ищет имена вендоров в исходнике этого
 * файла и падает, если хоть одно вернулось.
 *
 * Форма раскрывается через нативный `<details>`: странице не нужен ни один
 * хук, и серверный рендер для неё дешевле и честнее клиентского — ровно как
 * у `RulesView` и `BillingView`, по образцу которых сделан лист.
 */

import { ChevronRight, KeyRound, Link2, Type } from "lucide-react";
import {
  JOIN_HINT,
  JOIN_LABEL,
  connCheckLine,
  connState,
  connStateLabel,
  connStateTone,
  funnelMissing,
  missingToConnect,
  ENGINE_SUPPORT_LABEL,
  FUNNEL_LABEL,
  type ConnContext,
  type ConnTone,
  type CredentialField,
  type FunnelStep,
  type Vendor,
} from "@/lib/integrations";
import { FunnelKeyBlock } from "@/components/sections/integrations/FunnelKeyBlock";
import { cn } from "@/lib/utils";

/** Цвет по тону состояния. Один источник на весь лист: строку «какой тон
 *  каким классом» не разбрасываем по JSX, иначе «не отвечает» рано или поздно
 *  где-нибудь потеряет красный и станет неотличимо от «не настроено» — ровно
 *  то различие, ради которого третье состояние и заведено. */
const TONE_CLASS: Record<ConnTone, { dot: string; text: string; border: string; bg: string }> = {
  // Не настроено — не поломка, и цвета у него нет намеренно: у нового
  // человека не настроено всё, и раскрасить это значит обесценить красный
  // там, где он действительно что-то значит.
  muted: { dot: "bg-ghost", text: "text-muted-foreground", border: "border-border", bg: "bg-card" },
  ok: { dot: "bg-success", text: "text-success", border: "border-success/35", bg: "bg-success-soft" },
  error: { dot: "bg-destructive", text: "text-destructive", border: "border-destructive/35", bg: "bg-destructive-soft" },
};

/** Иконка поля по его роли. Секрет обязан отличаться от адреса с первого
 *  взгляда: это единственное поле, которое нельзя ни показать, ни положить в
 *  адрес запроса. */
const FIELD_ICON = { url: Link2, secret: KeyRound, text: Type } as const;

function StateDot({ tone }: { tone: ConnTone }) {
  return <span aria-hidden className={cn("size-2.5 flex-none rounded-full", TONE_CLASS[tone].dot)} />;
}

/** Плитка-монограмма вместо логотипа.
 *
 *  Чужого логотипа у нас нет ни одного, а нарисованный «похожий» — это
 *  выдуманный товарный знак на экране арендатора. Монограмма ничего не
 *  обещает, не устаревает вместе с ребрендингом и одинаково выглядит у
 *  вендора, который появится завтра. Цвета у неё нет: в этой панели цвет
 *  означает состояние, и вендор не имеет права его тратить. */
function Mark({ mark }: { mark: string }) {
  return (
    <span
      aria-hidden
      className="flex size-9 flex-none items-center justify-center rounded-lg border border-border bg-elevated font-heading text-xs font-semibold tracking-tight text-muted-foreground"
    >
      {mark}
    </span>
  );
}

export function VendorCard({ vendor, ctx }: { vendor: Vendor; ctx: ConnContext }) {
  const state = connState(ctx);
  const tone = connStateTone(state);
  const t = TONE_CLASS[tone];
  const missing = missingToConnect(vendor);

  return (
    <article
      className={cn(
        "flex min-w-0 flex-col rounded-xl border border-border bg-card",
        /* КАРТОЧКА С КЛЮЧОМ ЗАНИМАЕТ ВСЮ ШИРИНУ, и это не про красоту.
           Внутри неё живёт единственное, что на этом листе действительно
           работает: ключ приёма, пример запроса и правила. В колонке шириной в
           треть экрана пример `curl` не помещается, кнопки «показать / копировать
           / перевыпустить» встают лесенкой, а сама карточка вытягивает свою
           колонку втрое — увидел это глазами на снимке, тесты показывали
           верный текст в верных узлах.

           Владелец ТРИЖДЫ за сутки спрашивал, куда вставлять ключ. Оставить
           его в самой узкой колонке внизу — это спрятать его ещё раз, только
           вёрсткой вместо отсутствия экрана. */
        vendor.issuesKey && "md:col-span-2 xl:col-span-3",
      )}
    >
      {/* Шапка и подпись — РАЗНЫМИ строками, а не тремя колонками одной.
          Пилюля состояния широкая («Connected, not responding» — три слова), и
          в общей строке она отжимала подпись до одного слова в строку: на
          узком экране карточка превращалась в лесенку. */}
      <div className="flex min-w-0 items-start gap-2.5 px-3 pt-3">
        <Mark mark={vendor.mark} />
        <div className="flex min-w-0 flex-1 flex-wrap items-center justify-between gap-x-2 gap-y-1">
          <div className="flex min-w-0 flex-wrap items-baseline gap-x-2">
            <h3 className="font-heading text-sm font-semibold">{vendor.name}</h3>
            {vendor.kindLabel ? (
              <span className="text-2xs text-faint">{vendor.kindLabel}</span>
            ) : null}
          </div>
          {/* Состояние — справа и одинаково у всех карточек: человек находит
              его глазами один раз и дальше читает столбиком, не выискивая.
              Расшифровки состояний на листе больше нет (#157): статус называет
              себя сам, а объяснять «Not connected» абзацем значит объяснять
              очевидное. */}
          <div className={cn("flex flex-none items-center gap-1.5 rounded-full border px-2 py-0.5", t.border, t.bg)}>
            <StateDot tone={tone} />
            <span className={cn("text-2xs font-medium whitespace-nowrap", t.text)}>{connStateLabel(state)}</span>
          </div>
        </div>
      </div>

      <p className="px-3 pt-1.5 text-xs leading-relaxed text-muted-foreground">{vendor.summary}</p>

      {/* «Когда проверяли связь» — ТОЛЬКО когда есть что проверять. Сегодня
          настроек нет ни у кого, и строка «Nothing stored yet.» повторяла
          словами пилюлю рядом (#157). Условие по факту, а не снос: в тот день,
          когда ручка появится, «сохранено, но ни разу не проверено» и «последняя
          проверка провалилась: причина» обязаны быть видны — их без этой строки
          сказать нечем. */}
      {ctx.configured ? (
        <p className="px-3 pt-1 text-2xs text-faint">{connCheckLine(ctx)}</p>
      ) : null}

      {/* Одна строка мелочей вместо трёх блоков: готовность движка, чем
          сшивается, и что из воронки доезжает. Прочерки воронки остались
          зачёркнутыми чипами — молчаливый ноль хуже отсутствия (#24), и это
          свойство данных, а не украшение. */}
      <div className="flex flex-wrap items-center gap-1 px-3 pt-2 text-2xs text-muted-foreground">
        <span className="rounded border border-border bg-elevated px-1.5 py-0.5">
          {ENGINE_SUPPORT_LABEL[vendor.support]}
        </span>
        {vendor.joinBy ? (
          <span className="px-0.5" title={JOIN_HINT[vendor.joinBy]}>
            Joins {JOIN_LABEL[vendor.joinBy]}
          </span>
        ) : null}
        {vendor.gives ? <FunnelChips gives={vendor.gives} /> : null}
      </div>

      {/* Ключ, который выдаём МЫ, живёт внутри карточки своего подключения:
          копировать его человек идёт туда же, где читает, как это подключение
          устроено. Условие по признаку вендора, а не по его имени — имён этот
          файл не знает вовсе. */}
      {vendor.issuesKey ? <FunnelKeyBlock /> : null}

      <ConnectForm vendor={vendor} missing={missing} />
    </article>
  );
}

/** Что из воронки вендор действительно отдаёт, а чего у него нет.
 *
 *  Обе половины рядом нарочно. Список «отдаёт» в одиночку читается как «а
 *  остальное, наверное, тоже где-то есть», и человек ищет пропавший РД в
 *  своих настройках вместо того, чтобы знать, что этого шага у трекера нет
 *  вовсе. Молчаливый ноль хуже отсутствия — правило иссуса #24. */
function FunnelChips({ gives }: { gives: readonly FunnelStep[] }) {
  const missing = funnelMissing(gives);
  return (
    <>
      <span className="text-faint">Funnel:</span>
      {gives.map((s) => (
        <span key={s} className="rounded border border-border bg-elevated px-1.5 py-0.5 text-foreground">
          {FUNNEL_LABEL[s]}
        </span>
      ))}
      {missing.map((s) => (
        <span
          key={s}
          title="This source does not measure this step. It stays empty — never a zero."
          className="rounded border border-dashed border-border px-1.5 py-0.5 text-ghost line-through"
        >
          {FUNNEL_LABEL[s]}
        </span>
      ))}
    </>
  );
}

/**
 * Форма подключения.
 *
 * ПОЛЕЙ ВВОДА ЗДЕСЬ НЕТ, И ЭТО НЕ НЕДОДЕЛКА. Сохранять введённое некуда:
 * ручки подключений в панели не существует, а ключ трекера в браузере не
 * хранят никогда. Поле ввода, которое молча теряет набранное, — это та самая
 * карточка, которая выглядит рабочей и ничего не делает; в панели такое уже
 * было один раз кнопкой без действия (`SocialsView`, до правки), и повторять
 * не будем.
 *
 * Поэтому форма показывает две честные вещи: что вендор спросит, когда
 * подключение появится, и чего для этого не хватает СЕГОДНЯ. Второй список
 * считается из фактов (`missingToConnect`), а не пишется в карточке словами,
 * — иначе один вендор однажды скажет «всё готово», потому что его текст
 * забыли поправить.
 */
function ConnectForm({ vendor, missing }: { vendor: Vendor; missing: string[] }) {
  return (
    <details className="group border-t border-border">
      <summary className="flex cursor-pointer list-none items-center gap-1.5 px-3 py-2 text-xs font-medium text-primary-ink outline-none hover:bg-hover focus-visible:ring-2 focus-visible:ring-ring">
        <ChevronRight
          className="size-3.5 flex-none transition-transform group-open:rotate-90"
          strokeWidth={2}
          aria-hidden
        />
        What connecting it takes
      </summary>

      <div className="flex flex-col gap-3 border-t border-border px-3 py-2.5">
        <section>
          <div className="text-2xs font-medium text-muted-foreground">What it asks for</div>
          {vendor.fields.length > 0 ? (
            <ul className="mt-1.5 flex flex-col gap-1.5">
              {vendor.fields.map((f) => (
                <FieldRow key={f.key} field={f} />
              ))}
            </ul>
          ) : null}
          <p className="mt-1.5 text-2xs leading-relaxed text-faint">{vendor.fieldsNote}</p>
        </section>

        <section>
          <div className="text-2xs font-medium text-muted-foreground">
            Why it can&apos;t be connected yet
          </div>
          <p className="mt-1 text-2xs leading-relaxed text-faint">{vendor.supportNote}</p>
          <ul className="mt-1.5 flex flex-col gap-1">
            {missing.map((m) => (
              <li key={m} className="flex gap-1.5 text-2xs leading-relaxed text-muted-foreground">
                <span aria-hidden className="mt-1.5 size-1 flex-none rounded-full bg-ghost" />
                <span>{m}</span>
              </li>
            ))}
          </ul>
        </section>
      </div>
    </details>
  );
}

function FieldRow({ field }: { field: CredentialField }) {
  const Icon = FIELD_ICON[field.kind];
  return (
    <li className="flex gap-2">
      <Icon className="mt-0.5 size-3.5 flex-none text-faint" strokeWidth={1.8} aria-hidden />
      <div className="min-w-0">
        <div className="flex flex-wrap items-baseline gap-x-1.5">
          <span className="text-xs font-medium">{field.label}</span>
          <code className="font-mono text-2xs text-faint">{field.key}</code>
          <span className="text-2xs text-faint">{field.required ? "required" : "optional"}</span>
        </div>
        <p className="mt-0.5 text-2xs leading-relaxed text-muted-foreground">{field.hint}</p>
      </div>
    </li>
  );
}
