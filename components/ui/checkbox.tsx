"use client";

/** Чекбокс = CheckboxRoot + CheckboxIndicator из @base-ui/react/checkbox
 *  (фундамент coss Checkbox). Контракт панели прежний:
 *  checked/onCheckedChange, value внутри CheckboxGroup,
 *  slot="selection" внутри GridList/Table/Tree.
 *
 *  Заменено:
 *    - @/components/rac/Checkbox      →  @base-ui/react/checkbox
 *    - @/components/rac/CheckboxGroup →  @base-ui/react/checkbox-group
 *    - onChange (RAC)                 →  onValueChange (base-ui)
 *    - isDisabled (RAC)               →  disabled (base-ui)
 *    - isSelected/onChange (RAC)      →  checked/onCheckedChange (base-ui)
 *
 *  Индикатор (галочка) рендерится coss-стилем — внутри <Checkbox.Indicator>
 *  с svg. Текст children идёт рядом (как в RAC-сборке).
 */
import * as React from "react";
import { Checkbox as CheckboxPrimitive } from "@base-ui/react/checkbox";
import { CheckboxGroup as CheckboxGroupPrimitive } from "@base-ui/react/checkbox-group";
import { cn } from "@/lib/utils";

export interface CheckboxProps {
  checked?: boolean;
  defaultChecked?: boolean;
  onCheckedChange?: (checked: boolean) => void;
  disabled?: boolean;
  className?: string;
  id?: string;
  value?: string;
  slot?: string;
  "aria-label"?: string;
  children?: React.ReactNode;
}

export function Checkbox({
  checked,
  defaultChecked,
  onCheckedChange,
  disabled,
  className,
  id,
  value,
  slot,
  children,
  ...rest
}: CheckboxProps) {
  return (
    <CheckboxPrimitive.Root
      id={id}
      // slot в DOM пробрасывается через ...rest; base-ui его примет как
      // произвольный атрибут и положит на скрытый input + на span.
      value={value}
      checked={checked}
      defaultChecked={defaultChecked}
      disabled={disabled}
      onCheckedChange={onCheckedChange as never}
      className={cn(
        "relative inline-flex items-center gap-2 font-sans text-sm text-neutral-800 dark:text-neutral-200",
        "[-webkit-tap-highlight-color:transparent] disabled:text-neutral-300 dark:disabled:text-neutral-600",
        className
      )}
      data-slot="checkbox-root"
      {...(rest as Record<string, unknown>)}
      {...(slot ? { slot } : {})}
    >
      <CheckboxPrimitive.Indicator
        keepMounted
        className={cn(
          "inline-flex size-4.5 sm:size-4 shrink-0 items-center justify-center rounded-sm border border-neutral-300 dark:border-neutral-600 bg-white dark:bg-neutral-900 transition",
          "data-unchecked:border-neutral-300 data-checked:border-neutral-700 data-checked:bg-neutral-700 dark:data-checked:border-neutral-300 dark:data-checked:bg-neutral-300",
          "group/checkbox"
        )}
        data-slot="checkbox"
      >
        <CheckIcon />
      </CheckboxPrimitive.Indicator>
      {children && <span className="text-sm">{children}</span>}
    </CheckboxPrimitive.Root>
  );
}

export interface CheckboxGroupProps {
  value?: string[];
  defaultValue?: string[];
  onChange?: (v: string[]) => void;
  disabled?: boolean;
  className?: string;
  children: React.ReactNode;
  "aria-label"?: string;
}

export function CheckboxGroup({
  value,
  defaultValue,
  onChange,
  className,
  children,
  "aria-label": ariaLabel,
  ...rest
}: CheckboxGroupProps) {
  return (
    <CheckboxGroupPrimitive
      value={value}
      defaultValue={defaultValue}
      onValueChange={onChange}
      disabled={rest.disabled}
      aria-label={ariaLabel}
      className={cn("!flex-row flex-wrap items-center gap-x-4 gap-y-2", className)}
    >
      {children}
    </CheckboxGroupPrimitive>
  );
}

function CheckIcon() {
  return (
    <svg
      aria-hidden="true"
      className="size-3.5 text-white dark:text-neutral-900"
      fill="none"
      height="24"
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth="3"
      viewBox="0 0 24 24"
      width="24"
      xmlns="http://www.w3.org/2000/svg"
    >
      <path d="M5.252 12.7 10.2 18.63 18.748 5.37" />
    </svg>
  );
}
