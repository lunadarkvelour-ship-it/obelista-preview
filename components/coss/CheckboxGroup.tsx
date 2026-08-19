/** coss ui CheckboxGroup — копия из реестра coss, с маппингом старого API.
 *
 *  Старый шим называл onValueChange (base-ui) -> onChange (панельный контракт),
 *  потому что RAC так же делал. coss-реестр пробрасывает ...props как есть, и
 *  панельный onChange не подходит к типу base-ui. Маппим вручную.
 */
"use client";
import { CheckboxGroup as CheckboxGroupPrimitive } from "@base-ui/react/checkbox-group";
import type * as React from "react";
import { cn } from "@/lib/utils";

export interface CheckboxGroupProps
  extends Omit<CheckboxGroupPrimitive.Props, "onChange" | "onValueChange"> {
  /** Панельный контракт: (values) => void. Прокинется в onValueChange base-ui. */
  onChange?: (value: string[]) => void;
}

export function CheckboxGroup({
  className,
  onChange,
  ...props
}: CheckboxGroupProps): React.ReactElement {
  return (
    <CheckboxGroupPrimitive
      className={cn("flex flex-col items-start gap-3", className)}
      onValueChange={onChange}
      {...props}
    />
  );
}

export { CheckboxGroupPrimitive };
