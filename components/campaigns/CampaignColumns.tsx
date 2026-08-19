"use client";

/* Выбор метрик для дерева «Кампании» (#159).
 *
 * Владелец: «аналог настройки колонок Ads Manager, аккуратно и красиво, без
 * перегрузки интерфейса». Отсюда всё устройство:
 *
 *  • ОДНА кнопка в ряду контролов, а не полоса переключателей. Восемь метрик
 *    на виду — это и есть перегрузка, ради борьбы с которой выбор и заводят;
 *  • список сгруппирован так, как о нём думает байер: что крутится, сколько
 *    стоило, сколько увидели, почём вышло. Не «метрики» и «показатели»;
 *  • каталог здесь НЕ ПОВТОРЯЕТСЯ ни строчкой. Компонент перебирает
 *    `CAMP_COLUMNS` и ничего не знает про сами метрики: список, перечисленный
 *    руками, не знает про колонку, которую заведут завтра.
 *
 * Своего состояния у компонента нет намеренно. Набор колонок — это состояние
 * ЛИСТА: его же читают шапка, строка и футер, и второй экземпляр внутри попапа
 * разъехался бы с ними на первом же перерендере.
 */

import * as React from "react";
import { Button, Dialog, DialogTrigger, Popover, Switch } from "react-aria-components";
import { Columns3 } from "lucide-react";
import { cn } from "@/lib/utils";
import { CTRL, CTRL_IDLE } from "@/components/analytics/controls";
import {
  CAMP_COLUMNS, CAMP_DEFAULT_VISIBLE, безПоказа, сПоказом,
  type CampColDef, type CampColKey,
} from "@/lib/campaigns-columns";

/* Порядок групп берётся из каталога, а не вторым списком: он там уже задан
   порядком колонок, и копия рано или поздно разойдётся с оригиналом. */
const GROUPS: CampColDef["group"][] = Array.from(new Set(CAMP_COLUMNS.map((c) => c.group)));

/* Значение группы — ключ каталога, по нему отбираются колонки; на экран идёт
   только подпись. Нет подписи — показываем само значение: пустого заголовка не
   бывает, а русский ключ в английском интерфейсе виден сразу и чинится сразу. */
const GROUP_LABEL: Record<string, string> = {
  доставка: "delivery",
  деньги: "money",
  трафик: "traffic",
  эффективность: "efficiency",
  /* Подписи не было с тех пор, как завелась группа воронки: в английском
     интерфейсе стоял русский ключ. Видно сразу — чинится сразу, ровно как
     обещает комментарий выше. */
  воронка: "funnel",
};

export interface ВыборМетрик {
  visible: CampColKey[];
  onChange: (next: CampColKey[]) => void;
}

/** Кнопка в ряду контролов и попап за ней. */
export function CampaignColumns(props: ВыборМетрик) {
  return (
    <DialogTrigger>
      <Button className={cn(CTRL, CTRL_IDLE)} aria-label="Which metrics to show">
        <Columns3 className="size-3.5 flex-none" aria-hidden />
        columns
        {/* Число рядом, а не только внутри попапа: сколько колонок сейчас
            показано — это то, что человек проверяет, ничего не открывая. */}
        <span className="tnum text-faint">{props.visible.length}</span>
      </Button>

      <Popover placement="bottom end" offset={6}>
        <Dialog className="w-[288px] rounded-xl border border-border bg-popover p-3 shadow-lg outline-none">
          <СписокМетрик {...props} />
        </Dialog>
      </Popover>
    </DialogTrigger>
  );
}

/** Содержимое попапа отдельным компонентом — ради смотрелки.
 *
 *  Попап react-aria в статику не отрисовать: он живёт порталом и появляется
 *  только по нажатию, а `renderToStaticMarkup` нажатий не делает. Единственный
 *  способ увидеть этот список глазами до выката — рисовать его от голых
 *  пропсов (`lib/__tests__/preview-campaign-columns.test.ts`). Тот же приём и по
 *  той же причине, что у `CampRow` на листе кампаний. */
export function СписокМетрик({ visible, onChange }: ВыборМетрик) {
  const включено = React.useMemo(() => new Set(visible), [visible]);

  /* Порядок принадлежит человеку — правило вставки живёт в каталоге
     (`сПоказом`) и покрыто тестами, а не собирается здесь заново. */
  const переключить = (key: CampColKey, дальше: boolean) =>
    onChange(дальше ? сПоказом(visible, key) : безПоказа(visible, key));

  return (
    <>
      <div className="mb-2.5 flex items-center justify-between gap-3">
        <span className="microlabel">which metrics to show</span>
        <Button
          onPress={() => onChange(CAMP_DEFAULT_VISIBLE)}
          className="focus-ring label rounded px-1 text-muted-foreground outline-none hover:text-foreground"
        >
          reset
        </Button>
      </div>

      <div className="max-h-[58vh] space-y-3 overflow-y-auto pr-0.5">
        {GROUPS.map((g) => (
          <div key={g}>
            <div className="microlabel mb-1 pl-1.5">{GROUP_LABEL[g] ?? g}</div>
            <div className="space-y-0.5">
              {CAMP_COLUMNS.filter((c) => c.group === g).map((c) => (
                  /* Подсказка на ОБЁРТКЕ, а не на переключателе: у контрола
                     react-aria `title` вообще не проп — та же по сути грабля,
                     что на кнопке действия в дереве. */
                  <div key={c.key} title={c.hint}>
                    <Switch
                      isSelected={включено.has(c.key)}
                      onChange={(дальше) => переключить(c.key, дальше)}
                      className={cn(
                        "focus-ring group flex w-full cursor-pointer items-center justify-between",
                        "gap-3 rounded-md px-1.5 py-1 text-[13px] outline-none hover:bg-hover",
                      )}
                    >
                      <span className="flex min-w-0 flex-col">
                        <span className="truncate leading-tight text-foreground">{c.title}</span>
                        <span className="mt-0.5 truncate text-[11px] leading-tight text-muted-foreground">
                          {c.hint}
                        </span>
                      </span>
                      <span
                        className={cn(
                          "relative h-[18px] w-8 flex-none rounded-full bg-border-strong",
                          "transition-colors group-selected:bg-primary",
                        )}
                      >
                        <span
                          className="absolute left-[2px] top-[2px] size-[14px] rounded-full bg-background
                                     transition-transform group-selected:translate-x-[14px]"
                        />
                      </span>
                    </Switch>
                  </div>
              ))}
            </div>
          </div>
        ))}
      </div>

      {/* Всё выключено — это разрешённый выбор, а не поломка, и он переживёт
          перезаход. Сказать об этом надо здесь: таблица без единой цифры иначе
          читается как «данные не приехали». */}
      {visible.length === 0 ? (
        <p className="mt-2.5 border-t border-border pt-2 text-[11px] leading-relaxed text-muted-foreground">
          No metrics shown — the tree will list names and states only. This is kept
          between visits, like any other choice here.
        </p>
      ) : null}
    </>
  );
}
