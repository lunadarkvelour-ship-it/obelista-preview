"use client";

/** Подпись поля — те же классы, что у Label в tailwind-стартере (Field.tsx). */
import * as React from "react";
import { Label as RacLabel } from "react-aria-components";
import { cn } from "@/lib/utils";

export const Label = React.forwardRef<
  HTMLLabelElement,
  React.ComponentPropsWithoutRef<typeof RacLabel>
>(({ className, ...props }, ref) => (
  <RacLabel
    ref={ref}
    className={cn(
      "w-fit cursor-default select-none font-sans text-sm font-medium text-neutral-600 dark:text-neutral-300",
      className
    )}
    {...props}
  />
));
Label.displayName = "Label";
