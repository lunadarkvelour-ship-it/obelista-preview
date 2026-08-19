"use client";

/* Два действия «просканировать парк» — по одному на вендора антидетекта.
 *
 * ЧТО БЫЛО. Один большой блок «Import profiles from Shard» на пол-экрана: два
 * абзаца про то, как устроен перенос, кнопка выдачи кода и сам код рядом.
 * AdsPower при этом был запрещён сторожем как мёртвый вендор.
 *
 * ЧТО СТАЛО. Вендора теперь два и они РАВНОПРАВНЫ (XR-44/XR-45): парк байера
 * может жить в любом, и пометка «скоро будет» у второго была бы неправдой.
 * (Английскую формулировку этой пометки здесь не пишем: сторож рядом ищет её
 * по тексту файла и справедливо ловит даже упоминание.) Значит и
 * действий два, одинакового веса, без выбора вендора отдельным контролом:
 * выбор — это и есть нажатие кнопки.
 *
 * ПОЧЕМУ МОДАЛКА, А НЕ БЛОК НА СТРАНИЦЕ. Выдача ключа — это момент, а не
 * состояние листа: ключ живёт пять минут, он одноразовый, и пока он на экране,
 * рядом обязано стоять предупреждение о том, что он даёт запись в это рабочее
 * пространство. Блок на странице такое предупреждение обесценивает — он висит
 * всегда, и его перестают читать. Модалка держит внимание ровно на то время,
 * пока ключ жив.
 *
 * ГЛАВНОЕ ПРАВИЛО ЭТОГО ФАЙЛА: ВЕНДОР ЕДЕТ РЯДОМ С КЛЮЧОМ ВЕЗДЕ.
 *
 * Символы ключа вендора НЕ КОДИРУЮТ — у обоих он выглядит одинаково. Поэтому
 * инструкция, которую человек копирует в скилл, несёт `provider=` явно, а не
 * надеется, что по ключу догадаются. Сервер тоже не догадывается: `/link_code`
 * требует `?provider=`, умолчания у него нет, и ключ кнопки ShardX не примет
 * тело AdsPower. Потерять здесь вендора значит собрать парк не из того
 * приложения и узнать об этом по чужим профилям в списке.
 *
 * И ПОСЛЕ ВЫДАЧИ ВЕНДОР НЕ МЕНЯЕТСЯ. Внутри модалки второго выбора нет вовсе:
 * ключ уже выписан под одного, и переключатель рядом с ним означал бы, что
 * человек может рассинхронизировать надпись и ключ одним нажатием.
 */

import * as React from "react";
import { Button as RacButton, Dialog, Modal, ModalOverlay } from "react-aria-components";
import { Check, Copy, KeyRound, ShieldAlert } from "lucide-react";
import { api, isProviderConflict, type LinkCodeResult, type ScanProvider } from "@/lib/analytics";
import { cn } from "@/lib/utils";

/** Подписи вендоров. Ровно те, что записаны в XR-45; интерфейс продукта
 *  английский, и своих переводов панель не заводит. */
const ВЕНДОР: Record<ScanProvider, string> = {
  adspower: "AdsPower",
};

/** Порядок кнопок фиксирован, а не выведен из объекта: порядок на экране —
 *  это решение, и меняться от перестановки ключей в литерале он не должен. */
const ПОРЯДОК: ScanProvider[] = ["adspower"];

type Состояние =
  | { вид: "выдаём" }
  | { вид: "готов"; код: string; вендор: ScanProvider; всего: number }
  | { вид: "занято"; занял: ScanProvider; просили: ScanProvider; через: number }
  | { вид: "отказ"; текст: string };

export function ScanProfiles() {
  /* Какой вендор открыт. `null` — модалки нет. Держим ВЕНДОР, а не булев
     флаг: заголовок, запрос и инструкция обязаны говорить об одном и том же,
     и единственный способ это гарантировать — один источник. */
  const [открыт, setОткрыт] = React.useState<ScanProvider | null>(null);

  return (
    <>
      {/* Два действия в ряд, одинаковой ширины на узком экране. Ни рамки, ни
          заголовка секции: это кнопки в рабочей области листа, а не карточка
          про перенос данных. */}
      <div className="flex flex-none flex-col gap-2 sm:flex-row">
        {ПОРЯДОК.map((p) => (
          <RacButton
            key={p}
            onPress={() => setОткрыт(p)}
            className={cn(
              "focus-ring flex min-h-9 flex-1 items-center justify-center gap-1.5 rounded-lg",
              "border border-border bg-card px-3 text-xs font-medium text-foreground outline-none",
              "transition-colors duration-150 hover:border-border-strong hover:bg-hover",
              "pressed:scale-[0.99] sm:flex-none",
            )}
          >
            <KeyRound className="size-3.5" strokeWidth={1.75} aria-hidden />
            Scan {ВЕНДОР[p]} Profiles
          </RacButton>
        ))}
      </div>

      {/* Модалка живёт ключом: закрыли — состояние ушло вместе с ней, и
          показать уже потраченный ключ второй раз физически нечем.
          `key` по вендору пересоздаёт её при смене — иначе выдача одного
          вендора могла бы пережить открытие другого. */}
      {открыт && (
        <КлючВендора
          key={открыт}
          вендор={открыт}
          onЗакрыть={() => setОткрыт(null)}
        />
      )}
    </>
  );
}

function КлючВендора({ вендор, onЗакрыть }: {
  вендор: ScanProvider;
  onЗакрыть: () => void;
}) {
  const [сост, setСост] = React.useState<Состояние>({ вид: "выдаём" });
  const [осталось, setОсталось] = React.useState(0);
  const [скопирован, setСкопирован] = React.useState(false);

  /* Запрос уходит ОДИН раз на открытие. Каждый вызов минтит новый код и гасит
     смысл предыдущего, поэтому опрашивать эту ручку нельзя ничем. */
  React.useEffect(() => {
    let жив = true;
    void api.linkCode(вендор).then((r: LinkCodeResult) => {
      if (!жив) return;
      if (r.ok) {
        setСост({ вид: "готов", код: r.code, вендор: r.provider, всего: r.expires_in });
        setОсталось(r.expires_in);
        return;
      }
      if (isProviderConflict(r)) {
        setСост({ вид: "занято", занял: r.active_provider,
                  просили: r.requested_provider, через: r.expires_in });
        return;
      }
      setСост({ вид: "отказ", текст: r.message || r.error });
    });
    return () => { жив = false; };
  }, [вендор]);

  React.useEffect(() => {
    if (сост.вид !== "готов" || осталось <= 0) return;
    const t = setTimeout(() => setОсталось((s) => s - 1), 1000);
    return () => clearTimeout(t);
  }, [сост.вид, осталось]);

  const истёк = сост.вид === "готов" && осталось <= 0;

  /* ИНСТРУКЦИЯ НЕСЁТ ВЕНДОРА ЯВНО. Ключ его не кодирует, и без этой строки
     скилл получил бы непрозрачный набор символов без указания, к какому
     приложению идти. */
  const инструкция = сост.вид === "готов"
    ? `provider=${сост.вендор} key=${сост.код} scan profiles`
    : "";

  const копировать = async () => {
    if (!инструкция) return;
    try {
      await navigator.clipboard.writeText(инструкция);
      setСкопирован(true);
      setTimeout(() => setСкопирован(false), 2000);
    } catch {
      /* Буфер недоступен (нет разрешения, не тот контекст) — молчим и
         оставляем текст выделяемым: он и так на экране, и скопировать его
         руками можно всегда. Ложное «Copied» здесь хуже отсутствия кнопки. */
    }
  };

  return (
    /* `isDismissable` + `ModalOverlay` дают ловушку фокуса, Escape и возврат
       фокуса на кнопку — всё из react-aria, а не своей реализацией. */
    <ModalOverlay
      isOpen
      isDismissable
      onOpenChange={(o) => { if (!o) onЗакрыть(); }}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 backdrop-blur-[2px]"
    >
      <Modal className="w-full max-w-[26rem] outline-none">
        <Dialog
          aria-label={`Scan ${ВЕНДОР[вендор]} profiles`}
          className="flex flex-col gap-3 rounded-xl border border-border bg-card p-4 outline-none"
        >
          <div>
            {/* Вендор назван в заголовке — второго выбора внутри нет и быть не
                должно: ключ уже выписан под этого. */}
            <h2 className="text-sm font-semibold text-foreground">
              Scan {ВЕНДОР[вендор]} profiles
            </h2>
            <p className="mt-0.5 text-2xs text-muted-foreground">
              Paste this into the Obelista skill on the machine where {ВЕНДОР[вендор]} runs.
            </p>
          </div>

          {сост.вид === "выдаём" && (
            <p className="py-4 text-center text-xs text-muted-foreground">Getting a key…</p>
          )}

          {сост.вид === "готов" && !истёк && (
            <>
              <div className="flex items-center gap-3 rounded-lg border border-border bg-elevated px-3 py-2.5">
                <span className="select-all font-mono text-lg tracking-[0.2em] text-foreground">
                  {сост.код}
                </span>
                <span className="tnum ml-auto font-mono text-2xs text-muted-foreground">
                  {Math.floor(осталось / 60)}:{String(осталось % 60).padStart(2, "0")}
                </span>
              </div>

              <RacButton
                onPress={() => void копировать()}
                className="focus-ring flex min-h-9 items-center justify-center gap-1.5 rounded-lg bg-primary px-3 text-xs font-medium text-primary-foreground! outline-none transition-colors duration-150 hover:bg-primary-hover pressed:scale-[0.98]"
              >
                {скопирован
                  ? <><Check className="size-3.5" strokeWidth={2} aria-hidden /> Copied</>
                  : <><Copy className="size-3.5" strokeWidth={1.75} aria-hidden /> Copy instruction</>}
              </RacButton>

              {/* Ровно то, что уедет в скилл — видно до нажатия. Человек
                  вставляет это чужому агенту и вправе прочесть заранее. */}
              <code className="select-all break-all rounded-md bg-elevated px-2 py-1.5 text-2xs text-muted-foreground">
                {инструкция}
              </code>

              {/* ПРЕДУПРЕЖДЕНИЕ ЖИВЁТ И УМИРАЕТ ВМЕСТЕ С КЛЮЧОМ, и закрыть его
                  отдельно нельзя. Пока ключ на экране, он даёт запись профилей
                  в это рабочее пространство кому угодно. */}
              <div className="flex items-start gap-2 rounded-lg border border-warning/40 bg-warning-soft px-3 py-2">
                <ShieldAlert className="mt-px size-3.5 flex-none text-warning" strokeWidth={2} aria-hidden />
                <p className="text-2xs leading-relaxed text-warning">
                  <span className="font-semibold">Do not share this key.</span> For the next few
                  minutes it lets whoever holds it write profiles into this workspace.
                </p>
              </div>
            </>
          )}

          {истёк && (
            <p className="rounded-lg border border-border bg-elevated px-3 py-2.5 text-xs text-muted-foreground">
              This key expired. Close and press{" "}
              <span className="text-foreground">Scan {ВЕНДОР[вендор]} Profiles</span> again —
              nothing is broken.
            </p>
          )}

          {/* КОНФЛИКТ ПОКАЗЫВАЕТСЯ, А НЕ ПЕРЕПИСЫВАЕТСЯ. Кто занял и через
              сколько отпустит — факты сервера; панель их не толкует и не
              предлагает отнять обход у соседа сама. */}
          {сост.вид === "занято" && (
            <div role="alert" className="rounded-lg border border-warning/40 bg-warning-soft px-3 py-2.5">
              <p className="text-xs font-medium text-warning">
                {ВЕНДОР[сост.занял]} is holding the live scan right now
              </p>
              <p className="mt-1 text-2xs leading-relaxed text-warning/90">
                One anti-detect at a time. It releases on its own in about{" "}
                {Math.max(1, Math.round(сост.через / 60))} min, or from the machine running{" "}
                {ВЕНДОР[сост.занял]}. Then {ВЕНДОР[сост.просили]} can take it.
              </p>
            </div>
          )}

          {сост.вид === "отказ" && (
            <div role="alert" className="rounded-lg border border-destructive/30 bg-destructive-soft px-3 py-2.5">
              <p className="text-xs font-medium">No key was issued</p>
              {/* Слова сервера как есть: он единственный знает причину. */}
              <p className="mt-0.5 break-words font-mono text-2xs text-muted-foreground">
                {сост.текст}
              </p>
            </div>
          )}

          <RacButton
            onPress={onЗакрыть}
            className="focus-ring min-h-8 self-end rounded-lg px-3 text-xs text-muted-foreground outline-none transition-colors duration-150 hover:bg-hover hover:text-foreground"
          >
            Close
          </RacButton>
        </Dialog>
      </Modal>
    </ModalOverlay>
  );
}
