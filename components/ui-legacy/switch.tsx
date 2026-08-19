"use client";

/** Свитч = Switch из tailwind-стартера; контракт панели прежний. */
import * as React from "react";
import { Switch as RacSwitch } from "@/components/rac/Switch";

export interface SwitchProps {
  checked?: boolean;
  onCheckedChange?: (checked: boolean) => void;
  disabled?: boolean;
  className?: string;
  id?: string;
  "aria-label"?: string;
  children?: React.ReactNode;
}

export function Switch({ checked, onCheckedChange, disabled, className, id, children, ...rest }: SwitchProps) {
  return (
    <RacSwitch
      id={id}
      isSelected={!!checked}
      isDisabled={disabled}
      onChange={(v: boolean) => onCheckedChange?.(v)}
      className={className}
      {...rest}
    >
      {children}
    </RacSwitch>
  );
}
