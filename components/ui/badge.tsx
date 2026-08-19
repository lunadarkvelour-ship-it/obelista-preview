/** Бейдж в палитре tailwind-стартера: пилюля с рамкой, как их Tag.
 *  Имя и варианты прежние — их зовут ContextChips и PreviewSummary.
 *
 *  Миграция на coss-внутренность: используется cva-стиль (как в
 *  coss Badge) + useRender из @base-ui/react, но визуал сохранён
 *  прежний (нейтральный + цветные primary/success/warning/danger/
 *  outline), а не coss-варианты (default/destructive/error/info/
 *  outline/secondary/success/warning), потому что у нас уже есть
 *  привычные имена и они прокинуты в PreviewSummary/ContextChips.
 *
 *  Заменено:
 *    - голый <span> + константный MAP   →  useRender + cva (coss-фундамент)
 */
import * as React from "react";
import { useRender } from "@base-ui/react/use-render";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const badgeVariants = cva(
  "inline-flex max-w-fit items-center gap-1 truncate rounded-full border px-3 py-0.5 font-sans text-xs",
  {
    defaultVariants: { variant: "default" },
    variants: {
      variant: {
        default:
          "bg-white text-neutral-600 border-neutral-200 dark:bg-neutral-900 dark:text-neutral-300 dark:border-neutral-600",
        primary:
          "bg-blue-100 text-blue-700 border-blue-200 dark:bg-blue-400/20 dark:text-blue-300 dark:border-blue-400/10",
        success:
          "bg-green-100 text-green-700 border-green-200 dark:bg-green-300/20 dark:text-green-400 dark:border-green-300/10",
        warning:
          "bg-yellow-100 text-yellow-700 border-yellow-200 dark:bg-yellow-300/20 dark:text-yellow-400 dark:border-yellow-300/10",
        danger:
          "bg-red-100 text-red-700 border-red-200 dark:bg-red-400/20 dark:text-red-300 dark:border-red-400/10",
        outline:
          "bg-transparent text-neutral-600 border-neutral-300 dark:text-neutral-300 dark:border-neutral-600",
      },
    },
  }
);

export type BadgeVariant = NonNullable<VariantProps<typeof badgeVariants>["variant"]>;

export interface BadgeProps extends useRender.ComponentProps<"span"> {
  variant?: BadgeVariant;
}

export function Badge({
  className,
  variant,
  render,
  children,
  ...props
}: BadgeProps): React.ReactElement {
  const defaultProps = {
    className: cn(badgeVariants({ variant }), className),
  };
  return useRender({
    defaultTagName: "span",
    render,
    props: { ...defaultProps, children, ...props } as Record<string, unknown>,
  });
}
