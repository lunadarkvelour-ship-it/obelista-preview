"use client";

/** Кнопка на coss Button.
 *
 *  Внутренность — coss (useRender из @base-ui/react + cva с их вариантами
 *  default/destructive/ghost/link/outline/secondary). Снаружи — старый
 *  контракт панели: variant: "default"|"success"|"ghost"|"subtle"|
 *  "outline"|"destructive"|"link" и size: "default"|"sm"|"xs"|"lg"|
 *  "icon"|"icon-sm". Старые имена маппятся в coss-варианты:
 *
 *    success   → default + bg-emerald-*
 *    subtle    → secondary (мягкий фон, без рамки)
 *    остальные совпадают 1:1
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
  | "subtle"
  | "outline"
  | "destructive"
  | "link";
type CossVariant =
  | "default"
  | "destructive"
  | "destructive-outline"
  | "ghost"
  | "link"
  | "outline"
  | "secondary";
type OurSize = "default" | "sm" | "xs" | "lg" | "icon" | "icon-sm";
type CossSize =
  | "default"
  | "icon"
  | "icon-lg"
  | "icon-sm"
  | "icon-xl"
  | "icon-xs"
  | "lg"
  | "sm"
  | "xl"
  | "xs";

const VARIANT: Record<OurVariant, CossVariant> = {
  default: "default",
  success: "default",
  ghost: "ghost",
  subtle: "secondary",
  outline: "outline",
  destructive: "destructive",
  link: "link",
};

// Старый EXTRA — зелёный фон для "success". coss-варианты не дают
// green-палитры из коробки, поэтому подмешиваем класс.
const EXTRA: Partial<Record<OurVariant, string>> = {
  success:
    "bg-emerald-600 text-white hover:bg-emerald-700 data-pressed:bg-emerald-800 dark:bg-emerald-500 dark:hover:bg-emerald-600 dark:data-pressed:bg-emerald-700",
};

export interface ButtonProps
  extends Omit<React.ButtonHTMLAttributes<HTMLButtonElement>, "onClick" | "color"> {
  variant?: OurVariant;
  size?: OurSize;
  onClick?: React.MouseEventHandler<HTMLButtonElement>;
  /** coss умеет render: asChild, но старые потребители иногда ждут boolean. */
  asChild?: boolean;
  /** RAC-слот: "close" внутри Dialog, "remove" внутри Tag и т.п. */
  slot?: string;
}

/** Голый текст рядом с иконкой заворачиваем в span.
 *
 *  coss-кнопка давит «:has(>svg:only-child)» в круглую, но голый текстовый
 *  узел элементом не считается — поэтому «<Icon/> подпись» тоже попадала
 *  под это правило и схлопывалась. Обёртка снимает only-child, чисто
 *  иконочные кнопки остаются круглыми.
 *
 *  (coss-варианты не дают этой CSS-логики в явном виде, но те же классы
 *  на :has остаются от их базовой раскладки; обёртка — обратно-совместимая
 *  страховка.) */
function wrapText(children: React.ReactNode): React.ReactNode {
  return React.Children.map(children, (c) =>
    typeof c === "string" || typeof c === "number" ? <span>{c}</span> : c
  );
}

/** Если asChild=true — клонируем первого ребёнка и накатываем на него
 *  наши cva-классы + onClick. coss Button тут не поможет (он ждёт
 *  `render={<Link/>}`, а не asChild), поэтому делаем merge руками. */
function renderAsChild(
  child: React.ReactElement,
  variant: OurVariant,
  size: OurSize,
  className: string | undefined,
  onClick: React.MouseEventHandler<HTMLButtonElement> | undefined,
  props: Record<string, unknown>,
  disabled: boolean | undefined
) {
  // coss-variants задают фон/границу; для asChild-потомка нам нужны
  // те же классы, чтобы визуально это была кнопка.
  const cosClasses =
    "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-lg border font-medium text-sm outline-none transition-shadow focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1 focus-visible:ring-offset-background disabled:pointer-events-none disabled:opacity-64";
  const sizeClass: Record<OurSize, string> = {
    default: "h-9 px-3 sm:h-8",
    sm: "h-8 px-2.5 sm:h-7",
    xs: "h-7 px-2 sm:h-6",
    lg: "h-10 px-5 sm:h-9",
    icon: "size-9 sm:size-8",
    "icon-sm": "size-8 sm:size-7",
  };
  const variantClass: Record<OurVariant, string> = {
    default: "border-primary bg-primary text-primary-foreground hover:bg-primary/90",
    success:
      "border-emerald-600 bg-emerald-600 text-white hover:bg-emerald-700 dark:bg-emerald-500 dark:hover:bg-emerald-600",
    ghost: "border-transparent text-foreground hover:bg-accent",
    subtle:
      "border-transparent bg-secondary text-secondary-foreground hover:bg-secondary/90",
    outline:
      "border-input bg-popover text-foreground hover:bg-accent/50 dark:bg-input/32",
    destructive:
      "border-destructive bg-destructive text-white hover:bg-destructive/90",
    link: "border-transparent text-foreground underline-offset-4 hover:underline",
  };
  return React.cloneElement(
    child as React.ReactElement<{ className?: string }>,
    {
      ...props,
      onClick,
      disabled,
      className: cn(
        "shrink-0 whitespace-nowrap",
        cosClasses,
        sizeClass[size],
        variantClass[variant],
        EXTRA[variant],
        (child as React.ReactElement<{ className?: string }>).props.className,
        className
      ),
    } as Record<string, unknown>
  );
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      className,
      variant = "default",
      size = "default",
      onClick,
      disabled,
      asChild,
      type: _type,
      children,
      ...props
    },
    _ref
  ) => {
    void _ref;
    void _type;
    if (asChild && React.isValidElement(children)) {
      return renderAsChild(
        children,
        variant,
        size,
        className,
        onClick,
        props as Record<string, unknown>,
        disabled
      );
    }
    return (
      <CossButton
        onClick={onClick}
        disabled={disabled}
        variant={VARIANT[variant]}
        size={size as CossSize}
        // Стартер не запрещает перенос: длинная подпись схлопывала кнопку
        // в узкий столбик, и текст вылезал за её границы (см. хвост-группы).
        className={cn(EXTRA[variant], className)}
        {...(props as Record<string, unknown>)}
      >
        {wrapText(children)}
      </CossButton>
    );
  }
);
Button.displayName = "Button";
