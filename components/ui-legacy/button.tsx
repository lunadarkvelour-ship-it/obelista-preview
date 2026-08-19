"use client";

/** Кнопка = Button из tailwind-стартера react-aria (components/rac/Button).
 *  Наружу — прежний контракт панели (variant/size/onClick), внутрь — их
 *  варианты primary/secondary/destructive/quiet и их же стили нажатия. */
import * as React from "react";
import { Button as RacButton } from "@/components/rac/Button";
import { cn } from "@/lib/utils";

type OurVariant = "default" | "success" | "ghost" | "subtle" | "outline" | "destructive" | "link";
type OurSize = "default" | "sm" | "xs" | "lg" | "icon" | "icon-sm";

const VARIANT: Record<OurVariant, "primary" | "secondary" | "destructive" | "quiet"> = {
  default: "primary",
  success: "primary",
  ghost: "secondary",
  subtle: "secondary",
  outline: "secondary",
  destructive: "destructive",
  link: "quiet",
};

// Стартер даёт одну высоту (h-9); плотные места панели ужимаем классами.
const SIZE: Record<OurSize, string> = {
  default: "",
  sm: "h-8 px-3 text-xs [&:has(>svg:only-child)]:h-8 [&:has(>svg:only-child)]:w-8",
  xs: "h-7 px-2.5 text-xs [&:has(>svg:only-child)]:h-7 [&:has(>svg:only-child)]:w-7",
  lg: "h-10 px-5",
  icon: "",
  "icon-sm": "h-8 w-8 [&:has(>svg:only-child)]:h-8 [&:has(>svg:only-child)]:w-8",
};

const EXTRA: Partial<Record<OurVariant, string>> = {
  success: "bg-green-600 hover:bg-green-700 pressed:bg-green-800",
};

export interface ButtonProps
  extends Omit<React.ButtonHTMLAttributes<HTMLButtonElement>, "onClick" | "color"> {
  variant?: OurVariant;
  size?: OurSize;
  onClick?: React.MouseEventHandler<HTMLButtonElement>;
  asChild?: boolean;
  /** RAC-слот: "close" внутри Dialog, "remove" внутри Tag и т.п. */
  slot?: string;
}

/** Голый текст рядом с иконкой заворачиваем в span.
 *
 *  Стартер делает кнопку круглой иконкой по `:has(> svg:only-child)`, а
 *  текстовый УЗЕЛ элементом не считается — поэтому «<Icon/> подпись» тоже
 *  попадала под это правило: кнопка схлопывалась в 32×32, подпись вылезала
 *  наружу (было видно в хвост-группах). Обёртка снимает only-child, чисто
 *  иконочные кнопки остаются круглыми. */
function wrapText(children: React.ReactNode): React.ReactNode {
  return React.Children.map(children, (c) =>
    typeof c === "string" || typeof c === "number" ? <span>{c}</span> : c
  );
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = "default", size = "default", onClick, disabled, asChild, type, children, ...props }, _ref) => (
    <RacButton
      // RAC работает на onPress (тач/перо/клавиатура единообразно).
      onPress={onClick as never}
      isDisabled={disabled}
      type={type ?? "button"}
      variant={VARIANT[variant] ?? "primary"}
      className={cn(
        // Стартер не запрещает перенос: длинная подпись схлопывала кнопку
        // в узкий столбик, и текст вылезал за её границы (см. хвост-группы).
        "shrink-0 whitespace-nowrap",
        SIZE[size],
        EXTRA[variant],
        className
      )}
      {...(props as Record<string, unknown>)}
    >
      {wrapText(children)}
    </RacButton>
  )
);
Button.displayName = "Button";
