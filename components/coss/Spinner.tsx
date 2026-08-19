"use client";

/** coss Spinner — обёртка Loader2Icon с animate-spin. Тривиально, но в
 *  `components/ui/spinner.tsx` живёт его копия из реестра; выносим в
 *  `coss/`, чтобы новый код импортировал из coss-слоя, а старый шим
 *  мог остаться на месте.
 */
import { Loader2Icon } from "lucide-react";
import type * as React from "react";
import { cn } from "@/lib/utils";

export function Spinner({
  className,
  ...props
}: React.ComponentProps<typeof Loader2Icon>): React.ReactElement {
  return (
    <Loader2Icon
      aria-label="Loading"
      className={cn("animate-spin", className)}
      role="status"
      {...props}
    />
  );
}
