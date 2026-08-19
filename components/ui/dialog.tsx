"use client";

/** Модалка и нижняя шторка.
 *
 *  Оба варианта — coss-обёртки вокруг @base-ui/react/dialog, того же
 *  coss-стиля, что и Menu/Tooltip/Popover. Снаружи прежний контракт панели
 *  (open/onOpenChange/title/className для модалки, open/onOpenChange/title для
 *  шторки); внутри — BaseDialog.Root + Portal + Backdrop + Popup. Никакой RAC.
 *
 *  Заголовок и крестик рисует сам потребитель через `<Dialog.Title>` и
 *  `<Dialog.Close render={<button/>}>` — слоты RAC, на которых держался
 *  прежний шим, в coss не работают. */
import * as React from "react";
import { Dialog as BaseDialog } from "@base-ui/react/dialog";
import { cn } from "@/lib/utils";

interface MotionDialogProps {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  children: React.ReactNode;
  className?: string;
  title?: string;
  /** Максимальная ширина контента (у стартера по умолчанию 450px). */
  maxWidth?: number;
}

export function MotionDialog({
  open,
  onOpenChange,
  children,
  className,
  title = "Dialog",
  maxWidth,
}: MotionDialogProps) {
  const maxWidthClass = maxWidth ? `max-w-[min(90vw,${maxWidth}px)]` : "max-w-[min(90vw,450px)]";
  return (
    <BaseDialog.Root open={open} onOpenChange={onOpenChange}>
      <BaseDialog.Portal>
        <BaseDialog.Backdrop className="fixed inset-0 z-50 bg-black/50 backdrop-blur-lg data-[starting-style]:opacity-0 data-[ending-style]:opacity-0 transition-opacity duration-200" />
        <BaseDialog.Popup
          aria-label={title}
          className={cn(
            "fixed top-1/2 left-1/2 z-50 -translate-x-1/2 -translate-y-1/2",
            "w-full rounded-2xl border border-black/10 bg-white font-sans",
            "text-neutral-700 shadow-2xl dark:border-white/10 dark:bg-neutral-800/70",
            "dark:text-neutral-300 dark:backdrop-blur-2xl outline-none p-6",
            "data-[starting-style]:opacity-0 data-[starting-style]:scale-95",
            "data-[ending-style]:opacity-0 data-[ending-style]:scale-95",
            "transition-all duration-200",
            maxWidthClass,
            className,
          )}
        >
          {children}
        </BaseDialog.Popup>
      </BaseDialog.Portal>
    </BaseDialog.Root>
  );
}

/** Нижняя шторка для телефона — та же палитра, вход слайдом снизу. Потребитель
 *  (MobileBar) рисует заголовок через `<BaseDialog.Title>` и крестик через
 *  `<BaseDialog.Close render={<button/>}>`. */
export function Sheet({
  open,
  onOpenChange,
  title,
  children,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <BaseDialog.Root open={open} onOpenChange={onOpenChange}>
      <BaseDialog.Portal>
        <BaseDialog.Backdrop className="fixed inset-0 z-50 bg-black/50 backdrop-blur-lg data-[starting-style]:opacity-0 data-[ending-style]:opacity-0 transition-opacity duration-200" />
        <BaseDialog.Popup
          aria-label={title}
          className={cn(
            "fixed inset-x-0 bottom-0 z-50 flex max-h-[88dvh] flex-col rounded-t-2xl border",
            "border-black/10 bg-white p-4 font-sans text-neutral-700 shadow-2xl",
            "dark:border-white/10 dark:bg-neutral-800/70 dark:text-neutral-300",
            "dark:backdrop-blur-2xl outline-none",
            "data-[starting-style]:translate-y-full data-[ending-style]:translate-y-full",
            "transition-transform duration-300",
          )}
        >
          {children}
        </BaseDialog.Popup>
      </BaseDialog.Portal>
    </BaseDialog.Root>
  );
}
