"use client";

/* Откуда панель берёт профили и кабинеты: сервер с OAuth или загруженный
 * снапшот.
 *
 * ПОЧЕМУ ЭТОТ ВЫБОР ЖИВЁТ ЗДЕСЬ, А НЕ В ШАПКЕ ПРОДУКТА.
 *
 * Он приехал 17.08 полосой под шапкой — во всю ширину, на КАЖДОЙ странице, с
 * подписью «profile data» слева. Это было верно как срочная мера (OAuth
 * подводил, нужен был обходной путь под рукой) и неверно как устройство:
 * переключатель, видимый всегда, читается как вид листа, который щёлкают по
 * ходу дела. А он меняет ИСТОЧНИК ДАННЫХ сразу для «Кабинетов», «Профилей» и
 * «Кампаний» — то есть это настройка установки, и место ей там, где стоят
 * остальные настройки источников.
 *
 * Слова владельца 17.08: «выбор режима сделать oAuth / Snapshot и перенести в
 * лист integrations».
 *
 * ЧТО ЭТОТ ПЕРЕЕЗД ОБЯЗАН БЫЛ УНЕСТИ С СОБОЙ. Полоса занимала 2.75rem, и на
 * них была завязана высота обеих колонок оболочки (`100dvh - 6.25rem`). Убрать
 * полосу и забыть про вычитание значит получить на каждом листе второй скролл,
 * уехавший за нижний край. Возврат к `3.5rem` сделан тем же коммитом.
 *
 * И ЧТО ОСТАЛОСЬ НА МЕСТЕ. Лист кабинетов по-прежнему НАЗЫВАЕТ режим — меткой,
 * не переключателем (`sections/DataHealth`). Спрятать выбор и не сказать, что
 * он сделан, значит оставить укоротившийся список без объяснения: человек
 * увидит вместо 278 строк 109 и пойдёт искать поломку.
 */

import * as React from "react";
import { useStore } from "@/lib/store";
import { Segmented } from "@/components/ui/segmented";
import { DATA_SOURCE_OPTIONS, type DataSource } from "@/lib/types";

export function DataSourceCard() {
  const dataSource = useStore((s) => s.dataSource);
  const setDataSource = useStore((s) => s.setDataSource);
  /* До гидрации стор отдаёт значение из памяти, а не из локального хранилища, и
     сегмент успевает моргнуть на «Server/OAuth». Показываем контрол только
     смонтированным — иначе переключатель на глазах перескакивает сам, и это
     читается как «панель сбросила мою настройку». */
  const [mounted, setMounted] = React.useState(false);
  React.useEffect(() => setMounted(true), []);

  const снимок = dataSource === "snapshot";

  return (
    <section className="flex flex-col gap-2.5">
      <div>
        <h2 className="font-heading text-base font-semibold">Profile data source</h2>
        <p className="text-xs text-muted-foreground">
          Where profiles and ad accounts come from across the product.
        </p>
      </div>

      <div className="flex flex-wrap items-center gap-x-4 gap-y-2 rounded-xl border border-border
                      bg-card px-4 py-3">
        {mounted ? (
          <Segmented
            idBase="data-source"
            size="sm"
            value={dataSource}
            onChange={(v) => setDataSource(v as DataSource)}
            options={DATA_SOURCE_OPTIONS}
          />
        ) : (
          /* Заглушка ровно той же высоты: без неё карточка подпрыгивает на
             гидрации, и это видно на каждом заходе. */
          <div className="h-8 w-[184px] rounded-md border border-border" aria-hidden />
        )}

        {/* СКАЗАНО ПРО СОСТАВ И ПРО ОБОГАЩЕНИЕ ОТДЕЛЬНО — это два разных вопроса,
            и слить их в одну фразу значит соврать про один из них.

            ЗДЕСЬ СТОЯЛА ФРАЗА, УТВЕРЖДАВШАЯ, ЧТО В РЕЖИМЕ СНАПШОТА OAuth НЕ
            ОПРАШИВАЕТСЯ ВОВСЕ, и приёмка отклонила её справедливо. (Дословно
            она тут не приводится: такие фразы ищут по тексту, и цитата в
            объяснении ловится наравне с настоящей.) Контракт XR-39: снапшот владеет СОСТАВОМ (какие профили
            и кабинеты вообще есть), а OAuth того же провайдера ДОБАВЛЯЕТ к уже
            входящим в состав строкам то, что собирается непрерывно или чего
            локальный скан снять не мог — статус Меты, спенд, биллинг,
            подключённость. Он не может ни привести кабинет со стороны, ни
            стереть пиксели и Страницы, которые принёс снапшот.

            Разница не косметическая: «OAuth не спрашивается» обещает, что цифры
            в таблице снятые локально, — а они живые. Человек, читающий такую
            подпись, датирует спенд моментом скана и ошибается на сутки. */}
        <p className="min-w-[18rem] flex-1 text-2xs leading-relaxed text-muted-foreground">
          {снимок
            ? "Which profiles and ad accounts exist comes from the selected provider\u2019s "
              + "snapshot. OAuth from that same provider adds live facts to rows already in "
              + "it \u2014 status, spend, billing. It never adds a row and never removes "
              + "snapshot Pages or pixels."
            : "Which profiles and ad accounts exist comes from the server. Only accounts "
              + "reachable through a connected profile are listed."}
        </p>
      </div>
    </section>
  );
}
