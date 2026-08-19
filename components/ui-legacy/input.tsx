"use client";

/** Поле ввода в стиле tailwind-стартера (Field.tsx: те же классы Input +
 *  рамка/фокус из его TextField). Взят голый RAC Input, потому что Naming
 *  вставляет макросы по ref, а обёртка стартера ref не пробрасывает. */
import * as React from "react";
import { Input as RacInput } from "react-aria-components";
import { cn } from "@/lib/utils";

export const inputClasses = cn(
  "min-h-9 w-full min-w-0 flex-1 rounded-lg border px-3 py-0 font-sans text-sm",
  "border-neutral-300 bg-white text-neutral-800 placeholder:text-neutral-600",
  "dark:border-neutral-600 dark:bg-neutral-900 dark:text-neutral-200 dark:placeholder:text-neutral-400",
  "hover:border-neutral-400 focus:border-neutral-600 dark:hover:border-neutral-500 dark:focus:border-neutral-300",
  "outline-2 -outline-offset-2 outline-transparent transition focus-visible:outline-focus",
  "disabled:text-neutral-300 dark:disabled:text-neutral-600",
  "[-webkit-tap-highlight-color:transparent]"
);

export const Input = React.forwardRef<HTMLInputElement, React.ComponentProps<"input">>(
  ({ className, type, ...props }, ref) => (
    <RacInput
      ref={ref}
      type={type}
      className={cn(
        inputClasses,
        // Спиннеры у number-полей только мешают попадать.
        "[appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none",
        className
      )}
      {...props}
    />
  )
);
Input.displayName = "Input";
