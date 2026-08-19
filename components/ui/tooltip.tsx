"use client";

/** Тултип = Tooltip из tailwind-стартера. */
import * as React from "react";
import { TooltipTrigger } from "react-aria-components";
import { Tooltip as RacTooltip } from "@/components/rac/Tooltip";

export { TooltipTrigger };
export const Tooltip = RacTooltip;

/** Сахар: <Tip content="…"><Button/></Tip> */
export function Tip({
  content,
  children,
  placement,
  delay = 500,
}: {
  content: React.ReactNode;
  children: React.ReactNode;
  placement?: "top" | "bottom" | "left" | "right";
  delay?: number;
}) {
  return (
    <TooltipTrigger delay={delay} closeDelay={80}>
      {children}
      <RacTooltip placement={placement}>{content}</RacTooltip>
    </TooltipTrigger>
  );
}
