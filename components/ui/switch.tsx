"use client";

/** Свитч = Switch.Root + Switch.Thumb из @base-ui/react/switch
 *  (фундамент coss Switch). Контракт панели прежний.
 *
 *  Заменено:
 *    - @/components/rac/Switch  →  @base-ui/react/switch
 *    - isSelected/onChange (RAC) → checked/onCheckedChange (base-ui)
 *    - isDisabled (RAC)         → disabled (base-ui)
 */
import * as React from "react";
import { Switch as SwitchPrimitive } from "@base-ui/react/switch";
import { cn } from "@/lib/utils";

export interface SwitchProps {
  checked?: boolean;
  defaultChecked?: boolean;
  onCheckedChange?: (checked: boolean) => void;
  disabled?: boolean;
  className?: string;
  id?: string;
  "aria-label"?: string;
  children?: React.ReactNode;
}

export function Switch({
  checked,
  defaultChecked,
  onCheckedChange,
  disabled,
  className,
  id,
  children: _children,
  ...rest
}: SwitchProps) {
  void _children;
  return (
    <SwitchPrimitive.Root
      id={id}
      checked={checked}
      defaultChecked={defaultChecked}
      disabled={disabled}
      onCheckedChange={onCheckedChange as never}
      className={cn(
        "group/switch inline-flex h-5 w-9 shrink-0 items-center rounded-full border border-neutral-300 dark:border-neutral-600 p-px outline-none transition",
        "data-unchecked:bg-neutral-200 dark:data-unchecked:bg-neutral-700",
        "data-checked:bg-neutral-700 dark:data-checked:bg-neutral-300",
        "disabled:opacity-50 disabled:cursor-not-allowed",
        "focus-visible:ring-2 focus-visible:ring-focus",
        className
      )}
      data-slot="switch"
      {...(rest as Record<string, unknown>)}
    >
      <SwitchPrimitive.Thumb
        className={cn(
          "pointer-events-none block size-4 rounded-full bg-white dark:bg-neutral-900 shadow-sm transition-transform",
          "translate-x-0 data-checked:translate-x-4"
        )}
        data-slot="switch-thumb"
      />
    </SwitchPrimitive.Root>
  );
}
