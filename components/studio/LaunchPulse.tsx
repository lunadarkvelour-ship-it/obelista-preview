"use client";

/* Блок на месте схемы структуры: сколько объектов уедет на кабинет и куда
 * именно эту спеку можно отдать.
 *
 * Смысл не в украшении. Панель ничего не льёт сама — она собирает спеку и
 * отдаёт её агенту, и это единственное, чего не видно из формы. Строка
 * «Launch with …», перебирающая инструменты, говорит ровно это: связку понимает
 * любой из них, привязки к одному нет.
 *
 * Значки — нейтральные, не логотипы: чужие товарные знаки в интерфейс не
 * тащим, а различить пять пунктов они помогают не хуже.
 */

import * as React from "react";
import { Bot, Code2, MousePointer2, Sparkles, TerminalSquare } from "lucide-react";
import { useBuilder } from "./useBuilder";
import { cn } from "@/lib/utils";

const TOOLS = [
  { name: "Claude", Icon: Sparkles },
  { name: "Codex", Icon: TerminalSquare },
  { name: "Cursor", Icon: MousePointer2 },
  { name: "VS Code", Icon: Code2 },
  { name: "Kimi", Icon: Bot },
];

const EVERY_MS = 2600;

/* Вращение живёт в СВОЁМ компоненте, а не в родителе.
 *
 * NumberTicker пишет цифру в DOM императивно, мимо React. Пока тик смены
 * инструмента жил в родителе, каждая перерисовка затирала посчитанное, и
 * счётчик застревал на случайном числе с полпути анимации — «1» вместо «11».
 * Перерисовываться должна только та часть, которая меняется. */
function ToolRotator() {
  const [i, setI] = React.useState(0);

  React.useEffect(() => {
    // Уважаем системную настройку: анимация тут декоративная, и крутить её
    // тому, кто просил её не крутить, незачем.
    const calm = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    if (calm) return;
    const t = window.setInterval(() => setI((n) => (n + 1) % TOOLS.length), EVERY_MS);
    return () => window.clearInterval(t);
  }, []);

  return (
    <div className="relative mt-1.5 flex h-8 items-center">
      {TOOLS.map((t, n) => (
        <span
          key={t.name}
          className={cn(
            "absolute inset-y-0 left-0 flex items-center gap-2 transition-[opacity,translate] duration-500",
            n === i ? "translate-y-0 opacity-100" : "pointer-events-none translate-y-1 opacity-0",
          )}
          aria-hidden={n !== i}
        >
          <t.Icon className="size-4 flex-none text-primary-ink" />
          <span className="font-heading whitespace-nowrap text-[17px] font-semibold text-foreground">
            Launch with {t.name}
          </span>
        </span>
      ))}
    </div>
  );
}

export function LaunchPulse() {
  const { meta } = useBuilder();

  return (
    <div className="relative overflow-hidden rounded-xl border border-border bg-card p-4">
      {/* Дыхание: мягкое пятно акцента под содержимым. Оно ничего не
          загораживает и не мигает — только медленно набирает и отпускает. */}
      <div aria-hidden className="pulse-glow pointer-events-none absolute -left-16 -top-16 size-56 rounded-full" />

      <div className="relative flex items-center gap-5">
        <div className="flex-none">
          {/* Число без анимации намеренно. NumberTicker пишет текст в DOM
              императивно, мимо React, и любая перерисовка родителя затирает
              посчитанное: на живой странице счётчик застревал на «1» вместо
              «11». Врать про количество объектов ради красивого разгона нельзя,
              а движение здесь и так есть — ротатор и подсветка. */}
          <div className="tnum text-[42px] font-semibold leading-none tracking-tight text-foreground">
            {meta.perCab}
          </div>
          <div className="microlabel mt-1.5 leading-tight">
            objects
            <br />/ ad account
          </div>
        </div>

        {/* Шапка «спека уедет в …» с ротатором инструментов и подписью про
            «привязки к одному инструменту нет» убрана: она рекламировала
            свойство продукта тому, кто уже внутри продукта, и занимала место,
            где нужен разбор связки. */}
      </div>
    </div>
  );
}
