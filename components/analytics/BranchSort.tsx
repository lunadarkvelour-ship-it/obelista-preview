"use client";

/* Сортировка ВНУТРИ развёрнутого крео — по кабинетам.
 *
 * Зачем отдельно от общей. Наверху и внутри задают разные вопросы. Наверху —
 * «какой крео лучше», и отвечают на него депы. Внутри — «на каком кабе он
 * идёт», и отвечает расход: ищут каб, который жрёт и не отдаёт. Пока
 * сортировка была одна, приходилось выбирать между этими двумя вопросами, а
 * развёрнутую ветку читать глазами сверху вниз.
 *
 * Почему отдельным контролом, а не Alt-кликом по заголовку. Скрытый жест на
 * этом листе уже пробовали: про Alt по шеврону никто бы не догадался, и его
 * пришлось выносить в подсказку. Настройка, которая переживает перезагрузку и
 * меняет порядок сотни строк, обязана быть видимой — вместе со своим текущим
 * значением, иначе «почему кабы стоят в таком порядке» превращается в загадку.
 */

import * as React from "react";
import { Button, Dialog, DialogTrigger, Popover } from "react-aria-components";
import { ArrowDown, ArrowUp, ListOrdered } from "lucide-react";
import { cn } from "@/lib/utils";
import { BY_KEY, type ColKey } from "@/lib/analytics-columns";
import { CTRL, CTRL_MUTED } from "./controls";

/** Метрики, по которым сортировать ветку осмысленно.
 *
 *  Список короткий намеренно. Внутри крео сравнивают кабинеты между собой, и
 *  производные вроде «подписка → контакт» на одном кабе за день считаются по
 *  двум событиям — сортировать по ним значит ставить наверх шум. Полный набор
 *  колонок остаётся у верхней сортировки, где чисел на порядок больше. */
const KEYS: ColKey[] = ["spend", "ftd", "sub", "cpftd", "cpsub", "clicks"];

/** Псевдоключ: сортировка по СОСТОЯНИЮ кабинета, а не по числу.
 *
 *  Колонки под него нет и быть не должно — состояние рисуется кружком, — но
 *  вопрос «покажи сначала живые» задают чаще, чем любой из числовых. Жёлтые
 *  (биллинг, ревью) всегда в середине: это не «между хорошим и плохим» по
 *  случайности, а по смыслу — такой кабинет чинится, а не хоронится. */
export const STATUS_KEY = "__status" as ColKey;

export function BranchSort({
  value,
  desc,
  onChange,
  visible,
}: {
  value: ColKey;
  desc: boolean;
  onChange: (key: ColKey, desc: boolean) => void;
  /** Показанные колонки: сортировать по спрятанной странно — не видно, по
   *  чему выстроено. Список пересекаем с ними, но текущую оставляем всегда. */
  visible: ColKey[];
}) {
  const shown = React.useMemo(
    () => [STATUS_KEY, ...KEYS.filter((k) => visible.includes(k) || k === value)],
    [visible, value],
  );
  const title = value === STATUS_KEY ? "State" : BY_KEY[value]?.title ?? value;

  return (
    <div className="flex flex-none items-center gap-1">
      <DialogTrigger>
        <Button
          className={cn(CTRL, CTRL_MUTED)}
          aria-label={`Sort inside creative: ${title}`}
        >
          <ListOrdered className="size-3.5 flex-none" />
          <span className="text-muted-foreground">inside creative</span>
          <span className="text-foreground">{title}</span>
        </Button>
        <Popover
          placement="bottom end"
          className="rounded-xl border border-border bg-popover p-1.5 shadow-lg"
        >
          <Dialog className="outline-none">
            <div className="flex min-w-[180px] flex-col gap-0.5">
              {shown.map((k) => (
                <button
                  key={k}
                  type="button"
                  onClick={() => onChange(k, desc)}
                  className={cn(
                    "focus-ring flex items-center justify-between gap-3 rounded-md px-2 py-1.5",
                    "text-left text-[12.5px] transition-colors duration-150 ease-out hover:bg-hover",
                    k === value ? "text-foreground" : "text-muted-foreground",
                  )}
                >
                  {k === STATUS_KEY ? "Ad account state" : BY_KEY[k]?.title ?? k}
                  {k === value ? (
                    <span className="size-1.5 rounded-full bg-primary-ink" aria-hidden />
                  ) : null}
                </button>
              ))}
            </div>
          </Dialog>
        </Popover>
      </DialogTrigger>

      {/* Направление — отдельной кнопкой, а не пунктом списка: его щёлкают
          чаще, чем меняют метрику, и прятать это в поповер значит два клика
          вместо одного. */}
      <Button
        onPress={() => onChange(value, !desc)}
        className={cn(CTRL, CTRL_MUTED, "w-[30px] justify-center px-0")}
        aria-label={desc ? "Highest values first" : "Lowest values first"}
      >
        {desc ? <ArrowDown className="size-3.5" /> : <ArrowUp className="size-3.5" />}
      </Button>
    </div>
  );
}
