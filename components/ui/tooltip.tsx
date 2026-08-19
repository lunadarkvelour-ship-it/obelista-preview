"use client";

/** Тултип = coss Tooltip под тонкой обёрткой-сахаром.
 *
 *  Наружу — единственный экспорт: `<Tip content="..." placement="..." delay={500}>
 *  {trigger}</Tip>`. Потребители — RefreshButton (button), PeriodPicker (span),
 *  Topbar (coss Button), AccountsView (button). Каждый из них — ровно один
 *  триггер с подсказкой, и городить coss-композицию в каждом не имело бы смысла:
 *  четыре обёртки `Tooltip.Root > Tooltip.Trigger render={x} + Portal + Positioner
 *  + Popup` на 4 триггера превратили бы каждый вызов в 12 строк JSX, а сахар
 *  убирает повтор. Если кому-то понадобится больший контроль — он берёт
 *  `@base-ui/react/tooltip` напрямую; здесь мы не подменяем coss, а только
 *  убираем копипасту.
 *
 *  Внутри — coss Tooltip.Root/Trigger/Portal/Positioner/Popup. Триггер
 *  передаётся в Tooltip.Trigger через `render` — это идиома coss, чтобы не
 *  плодить лишний <button> поверх триггера потребителя (тот и сам бывает
 *  кнопкой). Стиль попапа — из RAC-стартера: тёмный фон, белый текст, маленький
 *  кегль, лёгкая анимация появления. */
import * as React from "react";
import { Tooltip as BaseTooltip } from "@base-ui/react/tooltip";
import { cn } from "@/lib/utils";

type Placement = "top" | "bottom" | "left" | "right";

interface TipProps {
  /** Содержимое подсказки. Может быть строкой или JSX. */
  content: React.ReactNode;
  children: React.ReactNode;
  placement?: Placement;
  /** Задержка перед открытием, мс. Дефолт 500 — как в старом RAC-сахаре. */
  delay?: number;
}

/** Сахар: <Tip content="…"><Button/></Tip>. */
export function Tip({ content, children, placement, delay = 500 }: TipProps) {
  // children — единственный триггер. coss Tooltip.Trigger через render=prop
  // делает его и триггером, и кнопкой по умолчанию. Если ребёнок не кнопка
  // (как span у PeriodPicker), он остаётся тем, чем был — для coss это
  // легально, клавиатурный фокус тогда не работает, но hover — да; прежний
  // RAC-Tip вёл себя так же.
  const trigger = React.Children.only(children) as React.ReactElement;
  return (
    <BaseTooltip.Root>
      <BaseTooltip.Trigger render={trigger} delay={delay} closeDelay={80} />
      <BaseTooltip.Portal>
        <BaseTooltip.Positioner side={placement} sideOffset={6}>
          <BaseTooltip.Popup
            className={cn(
              "z-50 max-w-xs rounded-md border border-neutral-800 bg-neutral-700 px-3 py-1.5",
              "font-sans text-xs text-white shadow-lg drop-shadow-lg",
              "outline-none dark:border-white/10 dark:bg-neutral-600",
              "data-[starting-style]:opacity-0 data-[ending-style]:opacity-0",
              "transition-opacity duration-150",
            )}
          >
            {content}
          </BaseTooltip.Popup>
        </BaseTooltip.Positioner>
      </BaseTooltip.Portal>
    </BaseTooltip.Root>
  );
}
