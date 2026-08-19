"use client";

/** Многострочное поле. Внутренность — голый <textarea> с coss-стилем
 *  вёрстки (font-mono? нет, те же классы, что в input/textarea старого
 *  шима). Берём ref прямо на <textarea>, а не на coss-обёртку <span>,
 *  чтобы Naming вставлял макросы туда же, куда и раньше.
 */
import * as React from "react";
import { cn } from "@/lib/utils";

export const Textarea = React.forwardRef<HTMLTextAreaElement, React.ComponentProps<"textarea">>(
  ({ className, ...props }, ref) => (
    <textarea
      ref={ref}
      className={cn(
        "min-h-16 w-full rounded-lg border border-neutral-300 px-3 py-2 font-sans text-sm dark:border-neutral-600",
        "bg-white text-neutral-800 placeholder:text-neutral-600 dark:bg-neutral-900 dark:text-neutral-200 dark:placeholder:text-neutral-400",
        "hover:border-neutral-400 focus:border-neutral-600 dark:hover:border-neutral-500 dark:focus:border-neutral-300",
        "outline-2 -outline-offset-2 outline-transparent transition focus-visible:outline-focus",
        className
      )}
      {...props}
    />
  )
);
Textarea.displayName = "Textarea";
