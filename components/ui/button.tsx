"use client";

/** Кнопка на coss Button с одним обратно-совместимым вариантом.
 *
 *  Внутренность — coss Button из @/components/coss. Снаружи — старый контракт
 *  панели: variant: "default"|"success"|"ghost"|"outline"|"destructive"|
 *  "link"|"secondary" и size: "default"|"sm"|"xs"|"lg"|"icon"|"icon-sm".
 *
 *  Большинство вариантов мапятся 1:1 в coss-варианты (default/ghost/outline/
 *  destructive/link/secondary). Один НЕ маппится 1:1:
 *
 *    success   → default + bg-emerald-*  (coss-вариантов без зелёного нет)
 *
 *  Исторические варианты quiet/subtle и asChild-обёртка удалены:
 *    - quiet использовали rac/Disclosure.tsx и rac/Calendar.tsx, но эти
 *      файлы импортируют СВОЮ Button из @/components/rac/Button (allowlist),
 *      а не эту. Маппинг был мёртвым.
 *    - subtle не использовался никем.
 *    - asChild был ровно в одном потребителе; его переписали на coss `render`.
 *
 *  Заменено:
 *    - @/components/rac/Button  →  @/components/coss (Button)
 *    - ручной forwardRef        →  useRender из @base-ui/react
 */
import * as React from "react";
import { Button as CossButton } from "@/components/coss";
import { cn } from "@/lib/utils";

type OurVariant =
  | "default"
  | "success"
  | "ghost"
  | "outline"
  | "destructive"
  | "link"
  | "secondary";
type CossVariant =
  | "default"
  | "destructive"
  | "destructive-outline"
  | "ghost"
  | "link"
  | "outline"
  | "secondary";

const VARIANT: Record<OurVariant, CossVariant> = {
  default: "default",
  success: "default",
  ghost: "ghost",
  outline: "outline",
  destructive: "destructive",
  link: "link",
  secondary: "secondary",
};

// Зелёный фон для "success". coss-варианты не дают зелёной палитры из коробки,
// поэтому подмешиваем emerald-классы поверх default-варианта.
const SUCCESS_CLASSES =
  "bg-emerald-600 text-white hover:bg-emerald-700 data-pressed:bg-emerald-800 dark:bg-emerald-500 dark:hover:bg-emerald-600 dark:data-pressed:bg-emerald-700";

export interface ButtonProps
  extends Omit<React.ButtonHTMLAttributes<HTMLButtonElement>, "onClick" | "color"> {
  variant?: OurVariant;
  size?: React.ComponentProps<typeof CossButton>["size"];
  onClick?: React.MouseEventHandler<HTMLButtonElement>;
  /** RAC-слот: "close" внутри Dialog, "remove" внутри Tag и т.п. */
  slot?: string;
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      className,
      variant = "default",
      size = "default",
      onClick,
      disabled,
      type: _type,
      children,
      ...props
    },
    _ref
  ) => {
    void _ref;
    void _type;
    return (
      <CossButton
        onClick={onClick}
        disabled={disabled}
        variant={VARIANT[variant]}
        size={size}
        className={cn(variant === "success" ? SUCCESS_CLASSES : null, className)}
        {...(props as Record<string, unknown>)}
      >
        {children}
      </CossButton>
    );
  }
);
Button.displayName = "Button";
