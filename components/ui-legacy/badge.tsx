/** Бейдж в палитре tailwind-стартера: пилюля с рамкой, как их Tag.
 *  Имя и варианты прежние — их зовут ContextChips и PreviewSummary. */
import * as React from "react";
import { cn } from "@/lib/utils";

type BadgeVariant = "default" | "primary" | "success" | "warning" | "danger" | "outline";

const MAP: Record<BadgeVariant, string> = {
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
};

export function Badge({
  className,
  variant = "default",
  children,
  ...props
}: React.HTMLAttributes<HTMLSpanElement> & { variant?: BadgeVariant }) {
  return (
    <span
      className={cn(
        "inline-flex max-w-fit items-center gap-1 truncate rounded-full border px-3 py-0.5 font-sans text-xs",
        MAP[variant] ?? MAP.default,
        className
      )}
      {...props}
    >
      {children}
    </span>
  );
}
