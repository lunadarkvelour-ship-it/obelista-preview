"use client";

/* Тяга ширины колонки для обычной <table>.
 *
 * Лист «Аналитика» ресайзит колонки компонентом react-aria
 * (`ResizableTableContainer`), и правильным было бы взять его же. Но там вся
 * таблица собрана на RAC — Table, Row, Cell, коллекции, — а «Кабинеты» это
 * простой `<table>` с чекбоксами и кликом по строке. Перевод листа на RAC ради
 * ползунка означал бы переписать 500 строк рабочего кода и заново проверить
 * выделение, фильтры и группы: работа отдельного захода, а не побочный эффект.
 *
 * Поэтому здесь ровно тот же КОНТРАКТ, а не тот же компонент: ширины хранятся
 * по id колонки в persist-сторе (`accountCols`) и переживают перезагрузку;
 * тянется правый край заголовка; ниже минимума колонка не схлопывается.
 *
 * Указатель захватывается через `setPointerCapture`: без него курсор, уехавший
 * за пределы тонкой полоски (а он уезжает всегда — тянут быстро), теряет
 * события, и колонка застревает на середине движения.
 */

import * as React from "react";
import { cn } from "@/lib/utils";

/** Уже колонки ничего не читается: имя кабинета превращается в «Hiu…», а
 *  число — в обрезанный столбик пикселей. */
const MIN = 64;

export function ColResizer({
  id,
  width,
  onResize,
  label,
}: {
  id: string;
  width: number;
  onResize: (id: string, w: number) => void;
  label: string;
}) {
  const from = React.useRef({ x: 0, w: 0 });
  const [dragging, setDragging] = React.useState(false);

  return (
    <span
      role="separator"
      aria-label={`Column width: ${label}`}
      aria-orientation="vertical"
      tabIndex={0}
      onPointerDown={(e) => {
        e.preventDefault();
        e.stopPropagation();
        from.current = { x: e.clientX, w: width };
        (e.target as HTMLElement).setPointerCapture(e.pointerId);
        setDragging(true);
      }}
      onPointerMove={(e) => {
        if (!dragging) return;
        onResize(id, Math.max(MIN, from.current.w + (e.clientX - from.current.x)));
      }}
      onPointerUp={(e) => {
        (e.target as HTMLElement).releasePointerCapture(e.pointerId);
        setDragging(false);
      }}
      /* Клавиатурой тоже: колонку тянут не только мышью, а таблица без
         клавиатурного доступа к настройке — это таблица, которую нельзя
         настроить без мыши вовсе. */
      onKeyDown={(e) => {
        const шаг = e.shiftKey ? 24 : 8;
        if (e.key === "ArrowLeft") {
          e.preventDefault();
          onResize(id, Math.max(MIN, width - шаг));
        }
        if (e.key === "ArrowRight") {
          e.preventDefault();
          onResize(id, width + шаг);
        }
      }}
      className={cn(
        "absolute inset-y-1 right-0 z-10 flex w-3 translate-x-1/2 cursor-col-resize",
        "items-center justify-center outline-none",
        // Видимая полоска тонкая, зона попадания — 12px: целиться в один
        // пиксель на плотной шапке невозможно.
        "before:h-4 before:w-px before:rounded-full before:bg-border-strong/70 before:content-['']",
        "before:transition-[background-color,width] before:duration-150 before:ease-out",
        "hover:before:w-[2px] hover:before:bg-primary-ink",
        "focus-visible:before:w-[2px] focus-visible:before:bg-focus",
        dragging && "before:w-[2px] before:bg-primary-ink",
      )}
    />
  );
}
