"use client";

/* Блок ключа приёма воронки — ВНУТРИ карточки того подключения, которое этим
 * ключом и работает (#120).
 *
 * ПОЧЕМУ НЕ ОТДЕЛЬНАЯ КАРТОЧКА. Она уже есть — «Browser extension», её завёл
 * соседний воркер, и второе место про одно подключение это ровно тот разъезд,
 * который мы лечим вторые сутки: человек видит две карточки об одном и не
 * понимает, какая настоящая. Ключ — часть этого подключения, а не сосед.
 *
 * ДВА РАЗНЫХ КЛЮЧА, И ПУТАТЬ ИХ НЕЛЬЗЯ. У CRM ключа НЕТ вообще: проверено
 * живьём сегодня — `Bearer`, `X-Api-Key` и `Api-Key` отвергнуты все три, а
 * `/api/v1/auth/login` отвечает 404. Работает только HttpOnly-кука в браузере
 * человека. Ключ, который показан здесь, — НАШ, и он нужен, чтобы расширение
 * могло прислать день НАМ. Текст ниже написан так, чтобы человек не пошёл
 * искать несуществующий ключ своей CRM.
 *
 * КЛЮЧ — ЭТО ДОСТУП НА ЗАПИСЬ В ЕГО АНАЛИТИКУ. Отсюда правила, которые видно
 * в коде: целого ключа в разметке нет, пока не нажали «показать»; в адресах и
 * в логах его нет никогда; копирование — кнопкой, а не выделением мышью (при
 * выделении половина ключа уезжает в буфер молча). Перевыпуск спрашивает
 * подтверждение и говорит, что старый умрёт, ДО нажатия, а не после.
 */

import * as React from "react";
import { Check, Copy, Eye, EyeOff, KeyRound, RefreshCw } from "lucide-react";
import { API_BASE } from "@/lib/analytics";
import { guardSession } from "@/lib/session";
import {
  ПРАВИЛА_ПРИЁМА, маска, примерЗапроса, состояниеПриёма,
  type FunnelKeyResponse,
} from "@/lib/integrations-funnel";
import { cn } from "@/lib/utils";

/** Ручки ключа. Контракт согласован со сборщиком (#147); ручки может не быть на
 *  этом деплое, и тогда блок честно говорит «ещё не выкачено», а не рисует
 *  пустое поле, которое читается как «ключа нет». */
const ПУТЬ = "/funnel_key";

class РучкиНет extends Error {}

async function запрос<T>(path: string, init?: RequestInit): Promise<T> {
  const r = await fetch(API_BASE + path, { cache: "no-store", ...init });
  guardSession(r);
  const data = await r.json().catch(() => ({}));
  const текст = String((data as { error?: unknown })?.error ?? "");
  /* Та же пара признаков, что на листе кампаний: демон отвечает на незнакомый
     путь не 404, а `400 {"error": "нет такого пути: …"}`. Ловить только код
     значило бы показать человеку нашу внутреннюю русскую фразу в английском
     интерфейсе вместо честного «эта ручка ещё не выкачена». */
  if (r.status === 404 || текст.includes("нет такого пути")) throw new РучкиНет(path);
  if (!r.ok || (data as { ok?: boolean })?.ok === false) {
    throw new Error(текст || `API ${r.status}`);
  }
  return data as T;
}

export function FunnelKeyBlock() {
  const [st, setSt] = React.useState<FunnelKeyResponse | null>(null);
  const [ручкиНет, setРучкиНет] = React.useState(false);
  const [ошибка, setОшибка] = React.useState<string | null>(null);
  /* Показанный ключ живёт ТОЛЬКО в состоянии этого блока и только пока на него
     смотрят: ни в сторе, ни в localStorage, ни в адресе. Уход со страницы
     обязан его забыть. */
  const [показан, setПоказан] = React.useState(false);
  const [скопировано, setСкопировано] = React.useState(false);
  const [подтвердить, setПодтвердить] = React.useState(false);
  const [занят, setЗанят] = React.useState(false);
  const [now, setNow] = React.useState(() => Date.now());

  React.useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 60_000);
    return () => clearInterval(id);
  }, []);

  const тянуть = React.useCallback(async () => {
    try {
      setSt(await запрос<FunnelKeyResponse>(ПУТЬ));
      setРучкиНет(false);
      setОшибка(null);
    } catch (e) {
      if (e instanceof РучкиНет) setРучкиНет(true);
      else setОшибка(e instanceof Error ? e.message : String(e));
    }
  }, []);

  React.useEffect(() => {
    void тянуть();
  }, [тянуть]);

  /* «Показать» и «скрыть» — это про РАЗМЕТКУ, а не про запрос: ручка отдаёт
     ключ целиком и всегда, и прятать его до нажатия обязана панель. То, что
     лежит в HTML, видит любое расширение браузера, поэтому по умолчанию там
     маска, а сам ключ живёт в состоянии блока. */
  const показать = React.useCallback(() => {
    setПоказан((v) => !v);
  }, []);

  const копировать = React.useCallback(async () => {
    setЗанят(true);
    try {
      /* Спрашиваем сервер ЗАНОВО, а не берём из памяти: в соседней вкладке
         ключ могли перевыпустить минуту назад, и тогда кнопка молча положила
         бы в буфер мёртвый ключ. Человек вставил бы его и получил отказ
         приёма, не понимая, почему. */
      const r = await запрос<FunnelKeyResponse>(ПУТЬ);
      setSt(r);
      if (!r.key) throw new Error("The server has no key to copy yet.");
      await navigator.clipboard.writeText(r.key);
      setСкопировано(true);
      setTimeout(() => setСкопировано(false), 2000);
      setОшибка(null);
    } catch (e) {
      /* Буфер может быть запрещён политикой страницы — тогда говорим словами и
         показываем ключ, чтобы человек скопировал его руками. */
      setОшибка(e instanceof Error ? e.message : String(e));
      setПоказан(true);
    } finally {
      setЗанят(false);
    }
  }, []);

  const перевыпустить = React.useCallback(async () => {
    setЗанят(true);
    try {
      const r = await запрос<FunnelKeyResponse>(`${ПУТЬ}/rotate`, { method: "POST" });
      setSt(r);
      /* Новый ключ показываем сразу: человек перевыпустил его затем, чтобы
         немедленно вставить в расширение, и заставлять его нажимать «показать»
         после этого — лишний шаг ровно в тот момент, когда приём уже сломан. */
      setПоказан(true);
      setПодтвердить(false);
      setОшибка(null);
    } catch (e) {
      setОшибка(e instanceof Error ? e.message : String(e));
    } finally {
      setЗанят(false);
    }
  }, [тянуть]);

  const приём = состояниеПриёма(st, now);
  const видно = st?.key || "";
  const тон =
    приём.тон === "alarm"
      ? "border-destructive/40 bg-destructive-soft text-destructive"
      : приём.тон === "notice"
        ? "border-warning/40 bg-warning-soft text-warning"
        : "border-success/40 bg-success-soft text-success";

  return (
    <div className="mt-3 border-t border-border px-4 py-3">
      <div className="flex items-center gap-1.5 text-2xs font-medium text-muted-foreground">
        <KeyRound className="size-3.5" strokeWidth={1.8} aria-hidden />
        Intake key
      </div>

      {/* Чей это ключ — первой строкой. Человек ищет «ключ CRM», которого не
          существует, и без этой фразы он будет искать его до вечера. */}
      <p className="mt-1 text-2xs leading-relaxed text-muted-foreground">
        This is <strong>our</strong> key: it lets your machine post the day up here. Your CRM
        does not have a key at all — it is opened with your own browser session, and that is
        exactly why the funnel is pushed from your side instead of pulled from ours.{" "}
        {/* Ключ на КОМАНДУ, и сказать это надо здесь: иначе второй человек в
            команде будет искать свой и не найдёт. */}
        The key belongs to your workspace, so everyone on the team sends with this same one.
      </p>

      {ручкиНет ? (
        <p className="mt-2 rounded-lg border border-warning/40 bg-warning-soft px-2.5 py-2 text-2xs leading-relaxed text-warning">
          The collector on this deploy cannot issue a key yet, so there is nothing to copy
          here. Until it can, the intake uses one key for the whole installation and refuses
          the push as soon as a second workspace exists — it will not write someone else’s
          funnel into yours.
        </p>
      ) : (
        <>
          {/* Состояние приёма — ТРИ разных, а не «подключено/нет». «Подключено»
              без единого события это враньё того же сорта, что мы вычищаем
              вторые сутки. */}
          <div className={cn("mt-2 rounded-lg border px-2.5 py-2", тон)}>
            <p className="text-2xs font-medium">{приём.заголовок}</p>
            <p className="mt-0.5 text-2xs leading-relaxed opacity-90">{приём.пояснение}</p>
            {typeof st?.rows_today === "number" ? (
              /* День берём У СЕРВЕРА: «сегодня» у браузера и у сервера разное,
                 и посчитанное здесь молча разошлось бы с тем, что он считал. */
              <p className="mt-0.5 text-2xs opacity-90">
                {st.rows_today} row{st.rows_today === 1 ? "" : "s"} stored
                {st.today ? ` for ${st.today}` : " today"}.
              </p>
            ) : null}
          </div>

          <div className="mt-2 flex flex-wrap items-center gap-1.5">
            <code
              className="min-w-0 flex-1 truncate rounded border border-border bg-elevated px-2 py-1 font-mono text-2xs text-foreground"
              /* Целого ключа в разметке нет, пока не нажали «показать»: то, что
                 лежит в HTML, видит любое расширение браузера. */
            >
              {видно ? (показан ? видно : маска(видно)) : "—"}
            </code>
            <button
              type="button"
              onClick={() => void показать()}
              disabled={занят}
              className="focus-ring inline-flex items-center gap-1 rounded-md border border-border px-2 py-1 text-2xs text-muted-foreground hover:text-foreground disabled:opacity-50"
            >
              {показан ? <EyeOff className="size-3" /> : <Eye className="size-3" />}
              {показан ? "hide" : "show"}
            </button>
            <button
              type="button"
              onClick={() => void копировать()}
              disabled={занят}
              className="focus-ring inline-flex items-center gap-1 rounded-md border border-border px-2 py-1 text-2xs text-muted-foreground hover:text-foreground disabled:opacity-50"
            >
              {скопировано ? <Check className="size-3" /> : <Copy className="size-3" />}
              {скопировано ? "copied" : "copy"}
            </button>
            {/* Перевыпуск — в два нажатия, и предупреждение стоит ДО второго, а
                не после. Ключ, который перестал работать неожиданно, значит
                остановленную воронку и потерянный день цифр. */}
            {подтвердить ? (
              <>
                <button
                  type="button"
                  onClick={() => void перевыпустить()}
                  disabled={занят}
                  className="focus-ring inline-flex items-center gap-1 rounded-md border border-destructive/50 bg-destructive-soft px-2 py-1 text-2xs font-medium text-destructive disabled:opacity-50"
                >
                  <RefreshCw className={cn("size-3", занят && "animate-spin")} />
                  Yes, rotate — the old key stops working
                </button>
                <button
                  type="button"
                  onClick={() => setПодтвердить(false)}
                  className="focus-ring rounded-md px-2 py-1 text-2xs text-muted-foreground underline underline-offset-2"
                >
                  cancel
                </button>
              </>
            ) : (
              <button
                type="button"
                onClick={() => setПодтвердить(true)}
                className="focus-ring inline-flex items-center gap-1 rounded-md border border-border px-2 py-1 text-2xs text-muted-foreground hover:text-foreground"
              >
                <RefreshCw className="size-3" />
                rotate
              </button>
            )}
          </div>

          {подтвердить ? (
            <p className="mt-1.5 text-2xs leading-relaxed text-destructive">
              Rotating issues a new key immediately. Anything still sending with the old one —
              the extension on your machine, a scheduled export, a colleague’s laptop — stops
              being accepted, and those days simply will not arrive until you paste the new key
              there.
            </p>
          ) : null}

          {ошибка ? (
            <p className="mt-1.5 text-2xs text-destructive">{ошибка}</p>
          ) : null}
        </>
      )}

      {/* Куда вставить. Короткая инструкция рядом с ключом, а не в доке: тот,
          кто копирует ключ, настраивает отправку в эту же минуту. */}
      <div className="mt-3">
        <div className="text-2xs font-medium text-muted-foreground">Where it goes</div>
        <pre className="mt-1 overflow-x-auto rounded-lg border border-border bg-elevated px-2.5 py-2 font-mono text-[10.5px] leading-relaxed text-muted-foreground">
{примерЗапроса(API_BASE)}
        </pre>
        <ul className="mt-1.5 space-y-1">
          {ПРАВИЛА_ПРИЁМА.map((п) => (
            <li key={п} className="flex gap-1.5 text-2xs leading-relaxed text-muted-foreground">
              <span aria-hidden className="text-faint">·</span>
              <span>{п}</span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
