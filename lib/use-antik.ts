"use client";

/**
 * Живые профили антидетекта и подключения соцев.
 *
 * Раньше список профилей в билдере складывался из зашитого seed.ts плюс того,
 * что нашлось в снапшоте. Отсюда в выпадающем списке годами жили профили,
 * которых в антидетекте давно нет: 06.08 таких оказалось восемь из
 * четырнадцати, и один из них стоял дефолтом в пресетах.
 *
 * Источник один — живой антидетект через демон. Нет антидетекта — нет и
 * списка: показывать профили «по памяти» значит предлагать залить с того,
 * чего не существует.
 *
 * `ready` означает ровно «демон ответил», и ничего больше. Раньше здесь
 * требовалась ещё и подключённость вендора, а она достигалась только когда в
 * конфиг положен ключ. Ключа больше не существует как понятия: адрес и токен
 * лаунчер пишет себе на диск сам. Проверять его наличие значило бы навсегда
 * держать список пустым.
 *
 * Пустой список — сам по себе честный ответ, а не поломка: локальный API
 * антидетекта слушает `127.0.0.1` на машине оператора, и на сервере профилей
 * нет и быть не может.
 */

import * as React from "react";
import { api, type Social } from "@/lib/analytics";
import { профилиДляБилдера, type ПрофильБилдера } from "@/lib/antik-profiles";

export interface Antik {
  /** Демон ответил. */
  reachable: boolean;
  /** Списку можно верить. Сегодня это ровно `reachable`: ответ демона и есть
   *  весь ответ про антидетект — ступеней подключения и ключей больше нет.
   *  Отдельное имя оставлено потому, что потребители спрашивают именно это, а
   *  «пусто» и «не знаю» — разные ответы: пустой список при живом демоне
   *  означает, что профилей действительно нет. */
  ready: boolean;
  profiles: ПрофильБилдера[];
  /** Есть ли источник, способный подтвердить существование профиля. `false` —
   *  список показан по памяти Обелисты, и это надо сказать человеку, а не
   *  выдать за проверенное. */
  подтверждениеЕсть: boolean;
  loading: boolean;
  error: string | null;
  reload: () => void;
}

export function useAntik(): Antik {
  const [rows, setRows] = React.useState<Social[]>([]);
  const [reachable, setReachable] = React.useState(true);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [tick, setTick] = React.useState(0);

  React.useEffect(() => {
    let alive = true;
    setLoading(true);
    api
      .socials()
      .then((got) => {
        if (!alive) return;
        setRows(got.socials);
        setReachable(true);
        setError(null);
      })
      .catch((e) => {
        if (!alive) return;
        setReachable(false);
        setError(e instanceof Error ? e.message : String(e));
      })
      .finally(() => alive && setLoading(false));
    return () => {
      alive = false;
    };
  }, [tick]);

  const ready = reachable;

  /* Кто существует, решает `lib/antik-profiles`: правило одно на продукт и
     проверяемо тестом, а не спрятано в хуке, куда тестовый рендер не доходит. */
  const { профили, подтверждениеЕсть } = React.useMemo(
    () => (ready ? профилиДляБилдера(rows) : { профили: [], подтверждениеЕсть: false }),
    [rows, ready],
  );

  return {
    reachable,
    ready,
    profiles: профили,
    подтверждениеЕсть,
    loading,
    error,
    reload: () => setTick((t) => t + 1),
  };
}
