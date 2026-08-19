"use client";

/** Модалка и нижняя шторка на Modal/Dialog из tailwind-стартера.
 *  MotionDialog — прежний контракт панели (open/onOpenChange/title);
 *  анимации входа/выхода (zoom-in, fade) — из стартера. */
import * as React from "react";
import { Modal as ModalOverlayed } from "@/components/rac/Modal";
import { Dialog } from "@/components/rac/Dialog";
import { Modal as RacModal, ModalOverlay } from "react-aria-components";
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

export function MotionDialog({ open, onOpenChange, children, className, title = "Dialog", maxWidth }: MotionDialogProps) {
  return (
    <ModalOverlayed
      isOpen={open}
      onOpenChange={onOpenChange}
      isDismissable
      className={cn(maxWidth && `max-w-[min(90vw,${maxWidth}px)]`, className)}
    >
      <Dialog aria-label={title} className="p-0">
        {children}
      </Dialog>
    </ModalOverlayed>
  );
}

/** Нижняя шторка для телефона — та же палитра, вход слайдом снизу. */
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
    <ModalOverlay
      isOpen={open}
      onOpenChange={onOpenChange}
      isDismissable
      className="fixed inset-0 z-50 bg-black/50 backdrop-blur-lg entering:animate-in entering:fade-in exiting:animate-out exiting:fade-out entering:duration-200 exiting:duration-200"
    >
      <RacModal className="fixed inset-x-0 bottom-0 z-50 max-h-[88dvh] rounded-t-2xl border border-black/10 bg-white font-sans text-neutral-700 shadow-2xl dark:border-white/10 dark:bg-neutral-800/70 dark:text-neutral-300 dark:backdrop-blur-2xl entering:animate-in entering:slide-in-from-bottom entering:duration-300 exiting:animate-out exiting:slide-out-to-bottom exiting:duration-200">
        <Dialog aria-label={title} className="flex max-h-[88dvh] flex-col p-4">
          {children}
        </Dialog>
      </RacModal>
    </ModalOverlay>
  );
}
