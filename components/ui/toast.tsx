"use client";

/** Тосты = Toast из tailwind-стартера (синяя плашка, view-transition стопки).
 *  Наружу — прежний контракт: toast.success / toast.error.
 *
 *  ОСТАВЛЕН НА RAC (UNSTABLE_Toast*). Причина: coss-овая модель тостов
 *  устроена принципиально иначе — это anchored/managed через `toastManager` /
 *  `anchoredToastManager` с провайдерами в layout, без Sonner-style
 *  `toast(...)` API. У нас 8 потребителей (`toast.success`/`toast.error` в
 *  ProfileAccounts, PresetCommand, PresetManager, PreviewView, SummaryBar,
 *  ImportTools, OutputPanel + AppToastRegion в app/layout.tsx), и перевод
 *  на coss означал бы: (а) завернуть дерево в ToastProvider + AnchoredToastProvider
 *  в layout, (б) переписать все 7 вызовов `toast.success("x")` на
 *  `toastManager.add({ title: "x", type: "success" })`, (в) переписать разметку
 *  AppToastRegion под coss `<Toast.*>`, включая anchored-логику, которой у нас
 *  сегодня нет. Это отдельная миграция со своей схемой, не точечная замена шима.
 *  Возвращаемся сюда, когда в coss-Toast переедет весь фидбек-стек. */
import * as React from "react";
import { flushSync } from "react-dom";
import {
  UNSTABLE_Toast as Toast,
  UNSTABLE_ToastContent as ToastContent,
  UNSTABLE_ToastQueue as ToastQueue,
  UNSTABLE_ToastRegion as ToastRegion,
  Button as RacButton,
  Text,
} from "react-aria-components";
import { XIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import "@/components/rac/Toast.css";

interface AppToast {
  title: string;
  tone: "success" | "error";
}

const queue = new ToastQueue<AppToast>({
  // Пере-раскладка стопки заворачивается в view transition — как в стартере.
  wrapUpdate(fn) {
    if (typeof document !== "undefined" && "startViewTransition" in document) {
      (document as Document & { startViewTransition: (cb: () => void) => void }).startViewTransition(() =>
        flushSync(fn)
      );
    } else {
      fn();
    }
  },
});

export const toast = {
  success: (title: string) => queue.add({ title, tone: "success" }, { timeout: 3500 }),
  error: (title: string) => queue.add({ title, tone: "error" }, { timeout: 5000 }),
};

export function AppToastRegion() {
  return (
    <ToastRegion
      queue={queue}
      className="fixed bottom-4 right-4 z-[60] flex flex-col-reverse gap-2 rounded-lg outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus"
    >
      {({ toast: t }) => (
        <Toast
          toast={t}
          style={{ viewTransitionName: t.key } as React.CSSProperties}
          className={cn(
            "flex w-[260px] items-center gap-4 rounded-lg px-4 py-3 font-sans outline-none [view-transition-class:toast]",
            "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus",
            // Цвет текста задаём на корне, потомки наследуют: на светлом
            // акценте (лайм) белая подпись нечитаема, нужны тёмные чернила.
            t.content.tone === "error"
              ? "bg-red-600 text-white"
              : "bg-primary text-primary-foreground"
          )}
        >
          <ToastContent className="flex min-w-0 flex-1 flex-col">
            <Text slot="title" className="text-sm font-semibold">
              {t.content.title}
            </Text>
          </ToastContent>
          <RacButton
            slot="close"
            aria-label="Close"
            className="flex h-8 w-8 flex-none items-center justify-center rounded-sm border-none bg-transparent p-0 text-current outline-none hover:bg-current/10 pressed:bg-current/15 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-current"
          >
            <XIcon className="h-4 w-4" />
          </RacButton>
        </Toast>
      )}
    </ToastRegion>
  );
}
