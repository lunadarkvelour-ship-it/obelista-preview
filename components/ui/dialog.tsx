"use client";

/** Модалка и нижняя шторка.
 *
 *  MotionDialog — переписан на coss (@base-ui/react) — это контролируемая
 *  модалка с теми же пропсами наружу (open/onOpenChange/title/className/maxWidth).
 *  Внутри — coss Dialog.Root + DialogPortal + DialogBackdrop + DialogPopup +
 *  DialogTitle, визуально повторяющий старый RAC-стартер: центрирование,
 *  зум-анимация, тёмный полупрозрачный фон, белый оверлей в тёмной теме.
 *
 *  Sheet оставлен на RAC. Причина — MobileBar (`components/studio/MobileBar.tsx`)
 *  использует внутри `<Heading slot="title">` и `<Button slot="close">` для
 *  RAC-слотовой модели, и переписать потребителя задача не позволяла. В coss
 *  слоты не работают: вместо них явные `<DialogTitle>` и `<DialogClose>`, и
 *  без правки MobileBar миграция сломала бы доступ с экрана и закрытие по
 *  крестику. Возвращаемся к этому, когда MobileBar поедет в coss. */
import * as React from "react";
import { Dialog as BaseDialog } from "@base-ui/react/dialog";
import {
  ModalOverlay as RacModalOverlay,
  Modal as RacModal,
  Dialog as RacDialog,
} from "react-aria-components";
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

/** Нижняя шторка для телефона — та же палитра, вход слайдом снизу.
 *  Осталась на RAC: см. JSDoc в шапке файла. */
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
    <RacModalOverlay
      isOpen={open}
      onOpenChange={onOpenChange}
      isDismissable
      className="fixed inset-0 z-50 bg-black/50 backdrop-blur-lg entering:animate-in entering:fade-in exiting:animate-out exiting:fade-out entering:duration-200 exiting:duration-200"
    >
      <RacModal className="fixed inset-x-0 bottom-0 z-50 max-h-[88dvh] rounded-t-2xl border border-black/10 bg-white font-sans text-neutral-700 shadow-2xl dark:border-white/10 dark:bg-neutral-800/70 dark:text-neutral-300 dark:backdrop-blur-2xl entering:animate-in entering:slide-in-from-bottom entering:duration-300 exiting:animate-out exiting:slide-out-to-bottom exiting:duration-200">
        <RacDialog aria-label={title} className="flex max-h-[88dvh] flex-col p-4">
          {children}
        </RacDialog>
      </RacModal>
    </RacModalOverlay>
  );
}
