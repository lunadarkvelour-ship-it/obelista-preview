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
 *  прежний шим, в coss не работают.
 *
 *  АНИМАЦИЯ. Вход/выход через motion (`render={<motion.div/>}`) под
 *  AnimatePresence. Стандартный data-attribute CSS-transition у base-ui
 *  отключён — иначе две системы гоняют opacity параллельно и рвут тайминги.
 *  На закрытии `open` снимается сразу, а локальный `shown` держится ещё 220 мс
 *  (длительность exit), чтобы AnimatePresence довёл анимацию до конца. На эти
 *  220 мс base-ui считает диалог закрытым (aria-hidden, возврат фокуса), а
 *  DOM ещё держит Backdrop/Popup — это и есть окно, когда exit играет. */
import * as React from "react";
import { AnimatePresence, motion } from "motion/react";
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

/** Длительность exit-анимации в мс. Совпадает с `transition.duration` ниже. */
const EXIT_MS = 220;

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
      <AnimatedDialogContent
        open={open}
        popupClassName={cn(
          "fixed top-1/2 left-1/2 z-50 -translate-x-1/2 -translate-y-1/2",
          "w-full rounded-2xl border border-black/10 bg-white font-sans",
          "text-neutral-700 shadow-2xl dark:border-white/10 dark:bg-neutral-800/70",
          "dark:text-neutral-300 dark:backdrop-blur-2xl outline-none p-6",
          maxWidthClass,
          className,
        )}
        backdropClassName="fixed inset-0 z-50 bg-black/50 backdrop-blur-lg"
        ariaLabel={title}
      >
        {children}
      </AnimatedDialogContent>
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
      <AnimatedDialogContent
        open={open}
        popupClassName={cn(
          "fixed inset-x-0 bottom-0 z-50 flex max-h-[88dvh] flex-col rounded-t-2xl border",
          "border-black/10 bg-white p-4 font-sans text-neutral-700 shadow-2xl",
          "dark:border-white/10 dark:bg-neutral-800/70 dark:text-neutral-300",
          "dark:backdrop-blur-2xl outline-none",
        )}
        backdropClassName="fixed inset-0 z-50 bg-black/50 backdrop-blur-lg"
        ariaLabel={title}
        enter={{ y: "100%" }}
        exit={{ y: "100%" }}
      >
        {children}
      </AnimatedDialogContent>
    </BaseDialog.Root>
  );
}

interface AnimatedDialogContentProps {
  open: boolean;
  popupClassName: string;
  backdropClassName: string;
  ariaLabel: string;
  enter?: { x?: string | number; y?: string | number; scale?: number; opacity?: number };
  exit?: { x?: string | number; y?: string | number; scale?: number; opacity?: number };
  children: React.ReactNode;
}

/** Шим вокруг AnimatePresence + BaseDialog.Portal. Делит motion-логику между
 *  модалкой и шторкой — разные только классы и transform-точки входа/выхода. */
function AnimatedDialogContent({
  open,
  popupClassName,
  backdropClassName,
  ariaLabel,
  enter,
  exit,
  children,
}: AnimatedDialogContentProps) {
  /* `shown` держим чуть дольше `open`, чтобы exit довёл анимацию до конца.
   * На каждый flip «open -> false» ставим таймер на EXIT_MS; если за это время
   * `open` успел вернуться (например, Esc по инерции), таймер отменяется. */
  const [shown, setShown] = React.useState(open);
  React.useEffect(() => {
    if (open) {
      setShown(true);
      return;
    }
    const t = window.setTimeout(() => setShown(false), EXIT_MS);
    return () => window.clearTimeout(t);
  }, [open]);

  const enterPop = { opacity: 0, scale: 0.96, ...enter };
  const exitPop = { opacity: 0, scale: 0.96, ...exit };

  return (
    <AnimatePresence>
      {shown && (
        <BaseDialog.Portal key="portal">
          <BaseDialog.Backdrop
            render={
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.18, ease: [0.16, 1, 0.3, 1] }}
              />
            }
            className={backdropClassName}
          />
          <BaseDialog.Popup
            render={
              <motion.div
                initial={enterPop}
                animate={{ opacity: 1, scale: 1, x: 0, y: 0 }}
                exit={exitPop}
                transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
              />
            }
            aria-label={ariaLabel}
            className={popupClassName}
          >
            {children}
          </BaseDialog.Popup>
        </BaseDialog.Portal>
      )}
    </AnimatePresence>
  );
}
