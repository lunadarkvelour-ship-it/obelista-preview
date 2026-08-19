/** coss ui Label — копия из реестра coss. API: <Label className ...rest render?>.
 *  Заменяет старый шим: тот же голый <label> через useRender, но визуал —
 *  coss-вариант (text-foreground, font-medium), а не старого шима
 *  (text-neutral-600, font-medium).
 */
"use client";
import { mergeProps } from "@base-ui/react/merge-props";
import { useRender } from "@base-ui/react/use-render";
import type * as React from "react";
import { cn } from "@/lib/utils";

export function Label({
  className,
  render,
  ...props
}: useRender.ComponentProps<"label">): React.ReactElement {
  const defaultProps = {
    className: cn(
      "inline-flex items-center gap-2 font-medium text-base/4.5 text-foreground sm:text-sm/4",
      className
    ),
    "data-slot": "label",
  };

  return useRender({
    defaultTagName: "label",
    props: mergeProps<"label">(defaultProps, props),
    render,
  });
}
