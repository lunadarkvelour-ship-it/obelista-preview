"use client";

import * as React from "react";
import { Select as RacSelect, SelectItem } from "@/components/rac/Select";
import { cn } from "@/lib/utils";

const NONE = "__none__";

export interface Opt {
  value: string;
  label: React.ReactNode;
  /** Подпись для триггера и typeahead, когда label — узел, а не строка.
   *  Без неё в свёрнутом виде вместо имени профиля показывался бы его id. */
  text?: string;
}

/** Единственная точка входа для всех выпадающих списков панели.
 *
 *  Внутри — Select из tailwind-стартера: триггер-кнопка с шевроном, поповер
 *  шириной триггера, пункты с галкой и синей подсветкой под курсором.
 *
 *  Пустая строка живёт под сентинелом: React Aria различает «ключ не выбран»
 *  и «выбран пустой ключ», а у нас "" — легитимное значение («без тега»). */
export function SelectField({
  value,
  onChange,
  options,
  className,
  placeholder,
  label,
}: {
  value: string;
  onChange: (v: string) => void;
  options: Opt[];
  className?: string;
  placeholder?: string;
  /** Доступное имя поля — то, чем его называет читалка экрана и чем его
   *  находит браузерная приёмка.
   *
   *  ЗАЧЕМ ОТДЕЛЬНО ОТ `placeholder`. Запасной вариант ниже — литерал
   *  «select», и достаётся он КАЖДОМУ полю без плейсхолдера. На листе
   *  кабинетов таких оказалось два рядом (профиль и статус), и приёмка
   *  увидела два контрола с одинаковым именем «select»: с клавиатуры и с
   *  читалкой они неразличимы, а в отчёте QA неотличимы тем более.
   *
   *  Плейсхолдер для этого не годится: он ещё и РИСУЕТСЯ, когда выбора нет.
   *  Подсунуть туда имя ради доступности значит чинить одно, ломая другое. */
  label?: string;
}) {
  return (
    <RacSelect
      aria-label={label || placeholder || "select"}
      placeholder={placeholder}
      selectedKey={value === "" ? NONE : value}
      onSelectionChange={(k) => onChange(String(k) === NONE ? "" : String(k))}
      // Триггер стартера прибит к min-w-[180px]: в строке из двух полей он не
      // сжимался и наезжал на соседнюю подпись («Пол | Устройства»,
      // «Уровень | $/день»). Снимаем минимум — ширину задаёт Grow.
      className={cn("w-full min-w-0 [&>button]:min-w-0", className)}
    >
      {options.map((o) => {
        const id = o.value === "" ? NONE : o.value;
        return (
          <SelectItem
            key={id}
            id={id}
            // textValue нужен для typeahead и подписи в триггере:
            // label бывает узлом, а не строкой.
            textValue={o.text ?? (typeof o.label === "string" ? o.label : o.value || placeholder || id)}
          >
            {o.label}
          </SelectItem>
        );
      })}
    </RacSelect>
  );
}
