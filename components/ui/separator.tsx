"use client";

/** Разделитель = Separator из @base-ui/react/separator (фундамент coss).
 *  Заменено: @/components/rac/Separator → @base-ui/react/separator.
 *  API прежний: <Separator orientation? className ...rest>.
 */
import * as React from "react";
import { Separator as SeparatorPrimitive } from "@base-ui/react/separator";
import { cn } from "@/lib/utils";

export function Separator({
  className,
  orientation = "horizontal",
  ...props
}: React.ComponentProps<typeof SeparatorPrimitive>): React.ReactElement {
  return (
    <SeparatorPrimitive
      orientation={orientation}
      className={cn(
        "shrink-0 bg-border",
        "data-[orientation=horizontal]:h-px data-[orientation=horizontal]:w-full",
        "data-[orientation=vertical]:w-px data-[orientation=vertical]:self-stretch",
        className
      )}
      data-slot="separator"
      {...props}
    />
  );
}
