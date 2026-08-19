"use client";

/* Состояние данных одним знаком.
 *
 * До этого над таблицей висела строка из одиннадцати пар «подпись — значение»:
 * точно, оценка, не опознан, сбор, воронка, тратит, сходимость, пауза по
 * лимиту, застыло, расходится, список молчащих соцев. Всё это правда и всё
 * нужно — но не одновременно и не первым, что читает глаз. Байер открывает
 * лист ради денег, а первым делом получал отчёт о качестве нашего же сбора.
 *
 * Здесь та же информация сворачивается в один индикатор: точка, одна фраза и
 * сколько кабинетов сейчас льёт. Подробности — по клику. Ничего не выброшено:
 * то, что раньше стояло в строке, теперь стоит в поповере, а наверх поднимается
 * только САМОЕ ПЛОХОЕ из найденного. Тихо стало не потому, что мы стали меньше
 * проверять, а потому что молчание теперь тоже сообщение.
 *
 * Проблема обязана приходить с действием. Красная строка «не отвечают соцы:
 * k1fhk1yb» висела над таблицей неделями и ничего не предлагала — прочитать её
 * можно было только как «ну и что мне с этим делать».
 */

import * as React from "react";
import { Button, Dialog, DialogTrigger, Popover } from "react-aria-components";
import { ChevronDown, ExternalLink } from "lucide-react";
import { cn } from "@/lib/utils";
import { money, staleLevel, whenShort, type CollectorState, type Coverage } from "@/lib/analytics";
import {
  healthLevel,
  healthMeaning,
  healthRestartLine,
  healthTitle,
  healthWriteLine,
  readHealth,
} from "@/lib/collector-health";
import { readSilence, silenceNote } from "@/lib/silence";
import type { Node } from "@/lib/analytics-tree";
import { useAntik } from "@/lib/use-antik";

type Level = "ok" | "warn" | "bad";

/** Возраст словами. Пусто — данных за сегодня нет вовсе, и это надо сказать,
 *  а не показать прочерк. */
export function since_(iso: string): string {
  if (!iso) return "no data for today";
  const t = Date.parse(iso);
  if (!Number.isFinite(t)) return "no data for today";
  const m = Math.max(0, Math.round((Date.now() - t) / 60000));
  if (m < 1) return "just now";
  if (m < 60) return `${m} min ago`;
  const h = Math.floor(m / 60);
  return `${h} h ${m % 60} min ago`;
}

export function ageMin(iso: string): number {
  const t = Date.parse(iso || "");
  return Number.isFinite(t) ? (Date.now() - t) / 60000 : Infinity;
}

/** Доля спенда, доехавшая до разбивки по объявлениям. 100% — сошлось.
 *
 *  Ниже ста означает, что круг ещё не обошёл все тратящие кабы: обзор по
 *  кабинетам приходит одним вызовом на соц и знает итог сразу, а детализация
 *  идёт по кабу за раз. Число честнее галочки: видно, ждать или чинить. */
export function pctOf(st: CollectorState): number {
  if (!st.sweep_total) return 100;
  return Math.min(100, (100 * st.detail_total) / st.sweep_total);
}

interface Проблема {
  level: Level;
  /** Заголовок проблемы — им же становится подпись индикатора, если она
   *  оказалась самой тяжёлой из найденных. */
  title: string;
  detail: string;
  action?: { label: string; href: string };
}

/** Кабинеты, чьи деньги сняты задолго до конца суток, и кабинеты с
 *  расхождением. Считается по веткам, потому что возраст живёт на объявлениях.
 *
 *  Кабинеты считаем по act_id: один каб живёт под несколькими крео, и «9 кабов»
 *  не должно превратиться в «17 строк». Деньги наоборот — складываем по всем
 *  узлам: под каждым крео лежат СВОИ объявления каба, и дедупликация потеряла
 *  бы часть суммы. */
function застой(branches: Record<string, Node[]>) {
  const acts = new Set<string>();
  const bad = new Set<string>();
  let spend = 0;
  let oldest = "";
  for (const tree of Object.values(branches)) {
    for (const a of tree) {
      if (staleLevel(a.stale_gap_s ?? null) !== "ok") {
        if (a.act_id) acts.add(a.act_id);
        spend += a.stale_spend ?? 0;
        if (a.spend_at && (!oldest || a.spend_at < oldest)) oldest = a.spend_at;
      }
      if (a.mismatch && a.act_id) bad.add(a.act_id);
    }
  }
  return { acts: acts.size, bad: bad.size, spend, oldest };
}

function собратьПроблемы(
  st: CollectorState | null,
  branches: Record<string, Node[]>,
  живые: Set<string>,
  тишина?: unknown,
): Проблема[] {
  const out: Проблема[] = [];

  /* ЧЕГО В ЭТОМ ОКНЕ МЫ НЕ СПРАШИВАЛИ (#122). Стоит ВЫШЕ разговора про
     протухший спенд и считается ДАЖЕ БЕЗ ответа `/collector`: «сбор отстал» и
     «сбора не было вовсе» — разные беды, и вторую нельзя ставить в зависимость
     от того, ответил ли нам сборщик про своё самочувствие.
     Отличие от соседней метки про застой (#149) названо словами внутри
     `silenceNote`: там спросили слишком рано и число занижено, здесь не
     спрашивали вовсе и числа просто нет. */
  const молчание = silenceNote(readSilence(тишина));
  if (молчание) {
    out.push({ level: "bad", title: молчание.title, detail: молчание.detail });
  }

  if (!st) return out;

  /* ВЕРДИКТ О СБОРЕ — ПЕРВЫМ И ВЫШЕ ВСЕГО ОСТАЛЬНОГО (#140).
     Он отвечает на вопрос, который делает бессмысленными все следующие: если
     сбор мёртв, разговаривать о том, какая доля спенда разложена по
     объявлениям, не о чем. В ночь на 15.08 всё нужное для этого вывода уже
     лежало в ответе — и никто его не сделал, потому что делать его было
     некому. Теперь его делает демон, а панель показывает.

     ЦВЕТ БЕРЁТСЯ ИЗ «тревога», А НЕ ИЗ ИМЕНИ СОСТОЯНИЯ (`healthLevel`):
     `заперт` — не авария, чинится он не у нас, и красный на нём стоит
     доверия ко всем остальным красным. */
  const в = readHealth(st.здоровье);
  if (в && в.состояние !== "идёт") {
    const цифры = [healthRestartLine(в), healthWriteLine(в)].filter(Boolean).join(" · ");
    out.push({
      level: healthLevel(в),
      title: healthTitle(в),
      /* Своя фраза про цифры на экране, а следом — причина СЛОВАМИ ДЕМОНА.
         Она единственная знает конкретику: сколько было подъёмов, что именно
         ответила Мета. Пересказывать её своими словами значит однажды
         пересказать неверно. */
      detail: [healthMeaning(в), цифры, в.почему && `Collector says: ${в.почему}`]
        .filter(Boolean)
        .join(" "),
    });
  }

  /* Соц с мёртвым токеном выпадает из сбора целиком: его кабы не опрашиваются,
     а таблица при этом выглядит полной. Это худшее, что может случиться с
     листом, поэтому оно и стоит первым.

     Но только про соцев, которые ЕЩЁ СУЩЕСТВУЮТ. Профиль, уехавший из антика,
     в ошибках сбора висит долго — токен-то в базе остался, — и уведомление про
     него не сообщает ничего: чинить нечего, соца нет. Такая плашка живёт
     неделями, приучает не читать красное, и настоящая поломка теряется среди
     привычного шума. */
  const молчат = Object.keys(st.profile_errors || {}).filter((p) => живые.has(p));
  if (молчат.length) {
    out.push({
      level: "bad",
      title:
        молчат.length === 1
          ? "Profile not responding"
          : `Profiles not responding: ${молчат.length}`,
      detail:
        `${молчат.join(", ")} — ad accounts on these profiles are not polled at all, ` +
        "while the table looks complete. Until this is fixed, their spend is missing " +
        "from the numbers below.",
      action: { label: "Open Profiles", href: "/socials" },
    });
  }

  const з = застой(branches);
  if (з.acts) {
    out.push({
      level: "bad",
      title: "Part of the spend is stale",
      detail:
        `Spend for ${з.acts} ad account${з.acts === 1 ? "" : "s"} was collected ` +
        "long before the day ended" +
        (з.oldest ? ` (oldest reading ${whenShort(з.oldest)})` : "") +
        `. The ${money(з.spend)} shown is what had accrued by then, ` +
        "not the day's total: the real figure is higher.",
    });
  }
  if (з.bad) {
    out.push({
      level: "warn",
      title: "Ad account mismatch",
      detail:
        `For ${з.bad} ad account${з.bad === 1 ? "" : "s"} the sum across ads does not ` +
        "match Meta's total for the account.",
    });
  }

  /* Своё правило «сбор отстаёт» живёт ТОЛЬКО пока вердикта нет.
     Двадцать минут здесь — это второй ответ на вопрос «когда молчание сбора
     становится поломкой», а первый теперь даёт демон (`core/collector.
     здоровье`, порог `ОСТЫЛ_С`). Две копии на двух языках разъезжаются молча,
     и по этим же цифрам автоправила тушат кампании — поэтому при живом
     вердикте панель молчит и показывает его.

     Совсем убрать нельзя: демон на маке обновляется рестартом Claude Desktop
     и какое-то время будет отвечать без поля `здоровье`. Тогда лучше старое
     приблизительное предупреждение, чем тишина. */
  if (!в && ageMin(st.spend_data_at) > 20) {
    out.push({
      level: "warn",
      title: "Collection is behind",
      detail: `Last spend reached the database ${since_(st.spend_data_at)}.`,
    });
  }
  if (st.hold_s) {
    out.push({
      level: "warn",
      title: "Meta throttled requests",
      detail: `Collection waits ${Math.ceil(st.hold_s / 60)} min and resumes on its own.`,
    });
  }
  return out;
}

/** Кружок состояния. Не только цвет: у него есть кольцо, и на чёрно-белом
 *  экране или при дальтонизме уровень читается по нему. */
function Точка({ level, className }: { level: Level | "unknown"; className?: string }) {
  const цвет =
    level === "ok" ? "bg-dot-live"
    : level === "warn" ? "bg-dot-warn"
    : level === "bad" ? "bg-dot-dead"
    : "bg-dot-unknown";
  return (
    <span
      aria-hidden
      className={cn("relative flex size-[7px] flex-none rounded-full", цвет, className)}
    />
  );
}

function Строка({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-baseline justify-between gap-4 py-[3px]">
      <span className="text-[12px] text-faint">{label}</span>
      <span className="tnum text-[12px] text-foreground">{children}</span>
    </div>
  );
}

export function DataState({
  st,
  byMoney,
  ads,
  branches,
  тишина,
}: {
  st: CollectorState | null;
  byMoney: Coverage | null;
  ads: Coverage | null;
  branches: Record<string, Node[]>;
  /** Блок «тишина» из ответа лидерборда. Сырым: разбирает его `lib/silence`,
   *  и дверь там одна. */
  тишина?: unknown;
}) {
  /* Кто вообще существует. «Ключ есть в снапшоте» этого не значит: демон
     склеивает `file+oauth`, и профиль, выбывший из антика, живёт в файловой
     половине неделями. Именно так плашка «Profile not responding k1fn8245»
     висела 13.08 — соца не было ни в антике, ни в листе «Соцы», чинить было
     нечего, а красное горело и приучало не читать красное.

     Спрашиваем тот же список антидетекта, что кормит лист «Соцы». Пока он не
     приехал, список пуст — и плашка молчит: соврать «профиль не отвечает»
     из-за закрытого антидетекта хуже, чем промолчать лишнюю секунду. */
  const antik = useAntik();
  const живые = React.useMemo(
    () => (antik.ready ? new Set(antik.profiles.map((p) => p.id)) : new Set<string>()),
    [antik.ready, antik.profiles],
  );
  const проблемы = React.useMemo(
    () => собратьПроблемы(st, branches, живые, тишина),
    [st, branches, живые, тишина],
  );

  if (!st) {
    return (
      <span className="flex items-center gap-1.5 text-[12px] text-faint">
        <Точка level="unknown" />
        collection state unknown
      </span>
    );
  }

  /* Свои ли это цифры сбора. `undefined` — демон старше контракта, и тогда
     ведём себя как раньше: на маке демон один и он же владельца. */
  const свои = st.свои_цифры !== false;

  const худшее: Level = проблемы.some((p) => p.level === "bad")
    ? "bad"
    : проблемы.length
      ? "warn"
      : "ok";
  /* Подпись — заголовок самой тяжёлой проблемы, а не общее «есть замечания».
     Человек должен узнать, ЧТО сломалось, не открывая поповер: открывают ради
     подробностей, а не ради диагноза. */
  const подпись =
    проблемы.find((p) => p.level === худшее)?.title ??
    (ageMin(st.spend_data_at) < 6 ? "Data is current" : `Updated ${since_(st.spend_data_at)}`);

  /* Покрытие считается по деньгам, а пока спенда нет — по объявлениям.
     Показывать «0% точно» на пустом спенде значит врать на себя. */
  const cov = byMoney && byMoney.total > 0 ? byMoney : ads;
  const по = byMoney && byMoney.total > 0 ? "by spend" : "by ads";
  const доля = (v: number) => ((100 * v) / (cov?.total || 1)).toFixed(1) + "%";

  return (
    <DialogTrigger>
      <Button
        className={cn(
          "group flex flex-none items-center gap-2 rounded-lg border border-transparent px-2 py-1",
          "text-left outline-none transition-[background-color,border-color] duration-150 ease-out",
          "hover:border-border hover:bg-hover pressed:bg-elevated",
          "data-[focus-visible]:border-focus",
        )}
      >
        <Точка level={худшее} />
        <span className="flex flex-col leading-tight">
          <span
            className={cn(
              "text-[12.5px]",
              худшее === "bad" ? "text-destructive" : "text-foreground",
            )}
          >
            {подпись}
          </span>
          {/* СКОЛЬКО КАБИНЕТОВ ТРАТИТ — цифра АРЕНДАТОРА, и чужому она не
              приезжает вовсе (#148). Отсутствие поля нельзя печатать нулём:
              «no ad accounts spending today» на чужом парке — не осторожность,
              а враньё, мы про его парк не знаем ничего. Прячем строку целиком:
              ни «0», ни прочерка, потому что и прочерк отвечал бы на вопрос,
              которого нам не задавали. */}
          {свои ? (
            <span className="text-[11.5px] text-faint">
              {st.hot
                ? `${st.hot} ad account${st.hot === 1 ? "" : "s"} spending`
                : "no ad accounts spending today"}
            </span>
          ) : null}
        </span>
        <ChevronDown
          className="size-3.5 flex-none text-ghost transition-transform duration-150 ease-out
                     group-data-[pressed]:translate-y-px"
        />
      </Button>

      <Popover
        placement="bottom end"
        className={cn(
          "w-[320px] rounded-xl border border-border bg-popover p-3 shadow-lg outline-none",
          "entering:animate-in entering:fade-in-0 entering:zoom-in-95 entering:duration-150",
          "exiting:animate-out exiting:fade-out-0 exiting:zoom-out-95 exiting:duration-100",
        )}
      >
        <Dialog className="outline-none">
          {проблемы.length ? (
            <div className="mb-2.5 flex flex-col gap-2">
              {проблемы.map((p) => (
                <div
                  key={p.title}
                  className={cn(
                    "rounded-lg border px-2.5 py-2",
                    p.level === "bad"
                      ? "border-destructive/35 bg-destructive-soft"
                      : "border-warning/30 bg-warning-soft",
                  )}
                >
                  <div className="flex items-center gap-1.5">
                    <Точка level={p.level} />
                    <span className="text-[12.5px] font-medium text-foreground">{p.title}</span>
                  </div>
                  <p className="mt-1 text-[11.5px] leading-relaxed text-muted-foreground">
                    {p.detail}
                  </p>
                  {p.action ? (
                    <a
                      href={p.action.href}
                      className="focus-ring mt-1.5 inline-flex items-center gap-1 rounded-md
                                 text-[11.5px] text-primary-ink transition-colors duration-150
                                 ease-out hover:text-foreground"
                    >
                      {p.action.label}
                      <ExternalLink className="size-3" />
                    </a>
                  ) : null}
                </div>
              ))}
            </div>
          ) : null}

          <Строка label="Spend">{since_(st.spend_data_at)}</Строка>
          <Строка label="Funnel">{since_(st.funnel_data_at)}</Строка>
          {свои && st.sweep_total > 0 ? (
            <Строка label="Reconciled">
              <span className={pctOf(st) >= 99 ? "text-success" : "text-warning"}>
                {pctOf(st).toFixed(0)}%
              </span>
              <span className="ml-1.5 text-faint">
                {money(st.detail_total)} of {money(st.sweep_total)}
              </span>
            </Строка>
          ) : null}

          {cov && cov.total > 0 ? (
            <>
              <div className="my-2 h-px bg-border" />
              <p className="mb-1 text-[11px] text-faint">Creatives identified {по}</p>
              <Строка label="from upload record">
                <span className="text-success">{доля(cov.exact)}</span>
              </Строка>
              <Строка label="from upload order">
                <span className={cov.estimate ? "text-warning" : "text-faint"}>
                  {доля(cov.estimate)}
                </span>
              </Строка>
              <Строка label="not identified">
                <span className={cov.unknown ? "text-destructive" : "text-faint"}>
                  {доля(cov.unknown)}
                </span>
              </Строка>
            </>
          ) : null}
        </Dialog>
      </Popover>
    </DialogTrigger>
  );
}
