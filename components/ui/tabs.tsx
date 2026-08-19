"use client";

/** Табы на base-ui/react/tabs (слой coss).
 *
 *  Наружный API шима сохранён — потребители (PreviewView, OutputPanel)
 *  импортируют `Tabs`, `TabList`, `TabPanel` и передают `value`/`onChange`
 *  строками. Внутри `id` переименован в `value` (терминология base-ui),
 *  `selectedKey`/`onSelectionChange` — в `value`/`onValueChange`.
 *
 *  Стиль — пилюли с заливкой активной, текст теряет muted-цвет на
 *  выбранной. Без RAC-селекшен-индикатора: base-ui не несёт его из коробки,
 *  а верстать вручную `mix-blend-difference` поверх выбранной кнопки —
 *  визуальный риск без отлаженного макета.
 */
import * as React from "react";
import { Tabs as TabsPrimitive } from "@base-ui/react/tabs";
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
    <TabsPrimitive.Root
      value={value}
      onValueChange={(v: unknown) => onChange(String(v))}
      className={cn("flex flex-col gap-2.5", className)}
    >
      {children}
    </TabsPrimitive.Root>
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
    <TabsPrimitive.List
      aria-label={ariaLabel}
      className="inline-flex max-w-full items-center gap-1 self-start rounded-full border border-border bg-card p-1"
    >
      {items.map((it) => (
        <TabsPrimitive.Tab
          key={it.id}
          value={it.id}
          className={cn(
            "rounded-full px-3 py-1.5 text-xs font-medium text-muted-foreground",
            "transition-colors outline-none",
            "hover:text-foreground",
            "focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1 focus-visible:ring-offset-background",
            "data-[active]:bg-primary data-[active]:text-primary-foreground data-[active]:shadow-xs/5",
          )}
        >
          {it.label}
        </TabsPrimitive.Tab>
      ))}
    </TabsPrimitive.List>
  );
}

export function TabPanel({
  id,
  className,
  children,
}: {
  id: string;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <TabsPrimitive.Panel value={id} className={cn("p-0", className)}>
      {children}
    </TabsPrimitive.Panel>
  );
}
