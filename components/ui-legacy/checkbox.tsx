"use client";

/** Чекбокс = Checkbox из tailwind-стартера. Контракт панели прежний:
 *  checked/onCheckedChange, либо value внутри CheckboxGroup, либо
 *  slot="selection" внутри GridList/Table/Tree. */
import * as React from "react";
import { Checkbox as RacCheckbox } from "@/components/rac/Checkbox";
import { CheckboxGroup as RacCheckboxGroup } from "@/components/rac/CheckboxGroup";
import { cn } from "@/lib/utils";

export interface CheckboxProps {
  checked?: boolean;
  onCheckedChange?: (checked: boolean) => void;
  disabled?: boolean;
  className?: string;
  id?: string;
  value?: string;
  slot?: string;
  "aria-label"?: string;
  children?: React.ReactNode;
}

export function Checkbox({ checked, onCheckedChange, disabled, className, id, value, slot, children, ...rest }: CheckboxProps) {
  const controlled =
    checked !== undefined || onCheckedChange !== undefined
      ? { isSelected: !!checked, onChange: (v: boolean) => onCheckedChange?.(v) }
      : {};
  return (
    <RacCheckbox
      id={id}
      slot={slot as never}
      value={value as never}
      isDisabled={disabled}
      {...controlled}
      className={className}
      {...rest}
    >
      {children}
    </RacCheckbox>
  );
}

export function CheckboxGroup({
  value,
  onChange,
  className,
  children,
  "aria-label": ariaLabel,
}: {
  value: string[];
  onChange: (v: string[]) => void;
  className?: string;
  children: React.ReactNode;
  "aria-label"?: string;
}) {
  return (
    <RacCheckboxGroup
      value={value}
      onChange={onChange}
      aria-label={ariaLabel}
      className={cn("!flex-row flex-wrap items-center gap-x-4 gap-y-2", className)}
    >
      {children}
    </RacCheckboxGroup>
  );
}
