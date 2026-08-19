"use client";

/** Подпись поля. Внутренность — голый <label> в coss-стиле через
 *  useRender. Старый RAC Label заменён на нативный <label>: coss-Label
 *  даёт ту же логику (useRender), но не тащит react-aria в зависимости.
 */
import * as React from "react";
import { useRender } from "@base-ui/react/use-render";
import { cn } from "@/lib/utils";

export const Label = React.forwardRef<
  HTMLLabelElement,
  useRender.ComponentProps<"label">
>(({ className, render, ...props }, ref) => {
  const defaultProps = {
    className: cn(
      "w-fit cursor-default select-none font-sans text-sm font-medium text-neutral-600 dark:text-neutral-300",
      className
    ),
  };
  return useRender({
    defaultTagName: "label",
    ref,
    render,
    props: { ...defaultProps, ...props } as Record<string, unknown>,
  });
});
Label.displayName = "Label";
