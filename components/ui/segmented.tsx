"use client";

/** Сегментед-контрол = ToggleButtonGroup + ToggleButton из tailwind-стартера:
 *  выбранный сегмент — тёмная заливка, нажатие приглушает фон. */
import * as React from "react";
import { ToggleButton } from "@/components/rac/ToggleButton";
import { ToggleButtonGroup } from "@/components/rac/ToggleButtonGroup";
import { cn } from "@/lib/utils";

export interface SegmentedOption {
  value: string;
  label: React.ReactNode;
}

interface SegmentedProps {
  options: SegmentedOption[];
  value: string;
  onChange: (v: string) => void;
  idBase?: string;
  size?: "sm" | "md";
  className?: string;
}

export function Segmented({ options, value, onChange, size = "md", className }: SegmentedProps) {
  return (
    <ToggleButtonGroup
      selectionMode="single"
      disallowEmptySelection
      selectedKeys={[value]}
      onSelectionChange={(keys) => {
        const k = [...keys][0];
        if (k != null) onChange(String(k));
      }}
      className={className}
    >
      {options.map((o) => (
        <ToggleButton
          key={o.value}
          id={o.value}
          className={cn(size === "sm" && "h-8 px-3 text-xs")}
        >
          {o.label}
        </ToggleButton>
      ))}
    </ToggleButtonGroup>
  );
}
