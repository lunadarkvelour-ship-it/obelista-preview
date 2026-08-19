"use client";

/** Раскрывашка = Disclosure из tailwind-стартера: высота панели анимируется
 *  через --disclosure-panel-height, шеврон крутится на 90°. */
import * as React from "react";
import {
  Disclosure as RacDisclosure,
  DisclosureHeader,
  DisclosurePanel as RacDisclosurePanel,
} from "@/components/rac/Disclosure";
import { DisclosureGroup } from "@/components/rac/DisclosureGroup";
import { cn } from "@/lib/utils";

export { RacDisclosure as Disclosure, RacDisclosurePanel as DisclosurePanel, DisclosureGroup, DisclosureHeader };

export function Expandable({
  summary,
  children,
  defaultOpen,
  className,
}: {
  summary: React.ReactNode;
  children: React.ReactNode;
  defaultOpen?: boolean;
  className?: string;
  triggerClassName?: string;
  panelClassName?: string;
}) {
  return (
    <RacDisclosure
      defaultExpanded={!!defaultOpen}
      className={cn("min-w-0 rounded-lg border border-neutral-200 dark:border-neutral-700", className)}
    >
      <DisclosureHeader>{summary}</DisclosureHeader>
      <RacDisclosurePanel>{children}</RacDisclosurePanel>
    </RacDisclosure>
  );
}
