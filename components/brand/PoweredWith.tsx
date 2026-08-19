"use client";

/* «powered with» — брендовый ротатор моделей.
 *
 * Зачем он существует. Промпт, собранный панелью, исполняет НЕ панель, а
 * модель байера: Claude, Claude Code, Cursor, Codex, Kimi. Экран превью —
 * место, где работа уходит из инструмента в чат, и до сих пор это было
 * сказано только словом «скопировать». Ряд знакомых знаков объясняет, куда
 * именно вставлять, быстрее любой подписи, и заодно честно называет
 * устройство продукта: среда готовит, модель исполняет.
 *
 * Почему смена на ОДНОМ месте, а не ряд из пяти. Ряд читается как «мы со
 * всеми интегрированы» и требует места, которого на экране решения нет.
 * Одно окно с плавной сменой говорит другое и более верное: подойдёт любая
 * из них, выбираешь ты. Плюс движение в статичном углу притягивает взгляд
 * ровно туда, где стоит главная кнопка.
 *
 * Цикл 2.6 с: короче — мельтешит на периферии зрения и мешает читать промпт,
 * длиннее — воспринимается как зависшая картинка, а не как перебор.
 */

import * as React from "react";
import { cn } from "@/lib/utils";

export interface Brand {
  id: string;
  label: string;
  src: string;
}

/* Порядок не алфавитный и не случайный: сначала то, чем владелец работает
   сегодня, дальше остальные. Первый кадр — тот, который узнают без подписи. */
export const BRANDS: Brand[] = [
  { id: "claude", label: "Claude", src: "/brands/claude-color.svg" },
  { id: "claudecode", label: "Claude Code", src: "/brands/claudecode-color.svg" },
  { id: "cursor", label: "Cursor", src: "/brands/cursor.svg" },
  { id: "codex", label: "Codex", src: "/brands/codex-color.svg" },
  { id: "kimi", label: "Kimi", src: "/brands/kimi-color.svg" },
];

const ЦИКЛ = 2600;

export function PoweredWith({
  className,
  size = 22,
}: {
  className?: string;
  size?: number;
}) {
  const [i, setI] = React.useState(0);
  /* Уважение к prefers-reduced-motion делаем ЗДЕСЬ, а не только в CSS:
     подмена картинки — это не анимация, её `transition: none` не остановит.
     Человеку, попросившему покой, ротатор просто показывает первый знак. */
  const [покой, setПокой] = React.useState(false);

  React.useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    const set = () => setПокой(mq.matches);
    set();
    mq.addEventListener("change", set);
    return () => mq.removeEventListener("change", set);
  }, []);

  React.useEffect(() => {
    if (покой) return;
    const id = window.setInterval(() => setI((n) => (n + 1) % BRANDS.length), ЦИКЛ);
    return () => window.clearInterval(id);
  }, [покой]);

  const b = BRANDS[покой ? 0 : i];

  return (
    <span className={cn("flex items-center gap-2.5", className)}>
      <span className="microlabel whitespace-nowrap text-ghost">powered with</span>

      {/* Окно фиксированного размера: знаки разной ширины, и без него соседний
          текст дёргался бы на каждой смене. */}
      <span
        className="relative flex flex-none items-center justify-center"
        style={{ width: size, height: size }}
        aria-hidden
      >
        {BRANDS.map((x, n) => (
          <img
            key={x.id}
            src={x.src}
            alt=""
            width={size}
            height={size}
            className={cn(
              "absolute inset-0 h-full w-full object-contain",
              "transition-[opacity,transform] duration-500 ease-out",
              n === (покой ? 0 : i)
                ? "opacity-100 blur-0"
                : "opacity-0 blur-[1px]",
            )}
            style={{
              // Уход вверх, приход снизу — знаки сменяют друг друга, а не
              // мигают на месте: направление читается как перебор списка.
              transform: n === (покой ? 0 : i) ? "translateY(0)" : "translateY(4px)",
            }}
          />
        ))}
      </span>

      <span className="relative w-[86px] flex-none overflow-hidden">
        {BRANDS.map((x, n) => (
          <span
            key={x.id}
            className={cn(
              "absolute inset-0 whitespace-nowrap text-[12px] text-muted-foreground",
              "transition-opacity duration-500 ease-out",
              n === (покой ? 0 : i) ? "opacity-100" : "opacity-0",
            )}
          >
            {x.label}
          </span>
        ))}
        {/* Ширина держится невидимым самым длинным именем: иначе блок дышит. */}
        <span className="invisible whitespace-nowrap text-[12px]">Claude Code</span>
      </span>

      {/* Живой текст для тех, кто читает экран голосом: там перебор картинок
          бесполезен, нужно одно понятное предложение. */}
      <span className="sr-only">
        The prompt runs in your model: {BRANDS.map((x) => x.label).join(", ")}. Currently
        showing {b.label}.
      </span>
    </span>
  );
}
