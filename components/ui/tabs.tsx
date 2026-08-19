"use client";

/** Табы = Tabs из tailwind-стартера: пилюли, активная помечена
 *  SelectionIndicator'ом (mix-blend-difference), который едет между вкладками. */
import * as React from "react";
import { Tabs as RacTabs, TabList as RacTabList, Tab as RacTab, TabPanel as RacTabPanel } from "@/components/rac/Tabs";
import { cn } from "@/lib/utils";

export function Tabs({
  value,
  onChange,
  className,
  children,
}: {
  value: string;
  onChange: (v: string) => void;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <RacTabs selectedKey={value} onSelectionChange={(k) => onChange(String(k))} className={className}>
      {children}
    </RacTabs>
  );
}

export function TabList({
  items,
  ariaLabel,
}: {
  items: { id: string; label: React.ReactNode }[];
  idBase?: string;
  ariaLabel?: string;
  current?: string;
}) {
  return (
    <RacTabList aria-label={ariaLabel}>
      {items.map((it) => (
        <RacTab key={it.id} id={it.id}>
          {it.label}
        </RacTab>
      ))}
    </RacTabList>
  );
}

export function TabPanel({ id, className, children }: { id: string; className?: string; children: React.ReactNode }) {
  return (
    <RacTabPanel id={id} className={cn("p-0", className)}>
      {children}
    </RacTabPanel>
  );
}
