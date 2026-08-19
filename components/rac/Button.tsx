'use client';
import React from 'react';
import {composeRenderProps} from 'react-aria-components/composeRenderProps';
import {
  Button as RACButton,
  type ButtonProps as RACButtonProps
} from 'react-aria-components/Button';
import {tv} from 'tailwind-variants';
import {focusRing} from './utils';

export interface ButtonProps extends RACButtonProps {
  /** @default 'primary' */
  variant?: 'primary' | 'secondary' | 'destructive' | 'quiet';
}

let button = tv({
  extend: focusRing,
  /* Перечисляем свойства перехода вместо голого `transition`: браузеру незачем
     анимировать заодно геометрию и тени. Нажатие получает тактильную отдачу
     масштабом — 0.96 читается пальцем как «нажалось» и не выглядит прыжком;
     ниже 0.95 кнопка проваливается. Курсор — pointer: стартер ставил default,
     и кнопка не отличалась на ощупь от текста. */
  base: 'relative inline-flex items-center justify-center gap-2 border border-transparent dark:border-white/10 h-9 box-border px-3.5 py-0 [&:has(>svg:only-child)]:px-0 [&:has(>svg:only-child)]:h-8 [&:has(>svg:only-child)]:w-8 font-sans text-sm text-center rounded-lg cursor-pointer [-webkit-tap-highlight-color:transparent] transition-[background-color,border-color,color,scale] duration-150 ease-out pressed:scale-[0.96] disabled:cursor-default',
  variants: {
    variant: {
      // Не bg-blue-600/700/800: у светлого акцента (лайм) ступени 700/800 —
      // тёмный конец шкалы, кнопка на hover почернела бы. Роли живут в
      // globals.css и меняются вместе с акцентом.
      // accent-fill: заливка градиентом лайм → мята (globals.css). Плоский
      // лайм на кнопке читался как маркерная подсветка — один цвет без
      // глубины, из-за которого главное действие экрана выглядело наклейкой.
      // Плоские классы остаются подложкой: у blue и violet градиента нет.
      primary:
        'accent-fill bg-primary hover:bg-primary-hover pressed:bg-primary-pressed text-primary-foreground',
      secondary:
        'border-black/10 bg-neutral-50 hover:bg-neutral-100 pressed:bg-neutral-200 text-neutral-800 dark:bg-neutral-700 dark:hover:bg-neutral-600 dark:pressed:bg-neutral-500 dark:text-neutral-100',
      destructive: 'bg-red-700 hover:bg-red-800 pressed:bg-red-900 text-white',
      quiet:
        'border-0 bg-transparent hover:bg-neutral-200 pressed:bg-neutral-300 text-neutral-800 dark:hover:bg-neutral-700 dark:pressed:bg-neutral-600 dark:text-neutral-100'
    },
    isDisabled: {
      true: 'border-transparent dark:border-transparent bg-neutral-100 dark:bg-neutral-800 text-neutral-300 dark:text-neutral-600 forced-colors:text-[GrayText]'
    },
    isPending: {
      true: 'text-transparent'
    }
  },
  defaultVariants: {
    variant: 'primary'
  },
  compoundVariants: [
    {
      variant: 'quiet',
      isDisabled: true,
      class: 'bg-transparent dark:bg-transparent'
    }
  ]
});

export function Button(props: ButtonProps) {
  return (
    <RACButton
      {...props}
      className={composeRenderProps(props.className, (className, renderProps) =>
        button({...renderProps, variant: props.variant, className})
      )}>
      {composeRenderProps(props.children, (children, {isPending}) => (
        <>
          {children}
          {isPending && (
            <span aria-hidden className="flex absolute inset-0 justify-center items-center">
              <svg
                className="w-4 h-4 animate-spin"
                viewBox="0 0 24 24"
                stroke={
                  props.variant === 'secondary' || props.variant === 'quiet'
                    ? 'light-dark(black, white)'
                    : props.variant === 'destructive'
                      ? 'white'
                      : 'var(--primary-foreground)'
                }>
                <circle cx="12" cy="12" r="10" strokeWidth="4" fill="none" className="opacity-25" />
                <circle
                  cx="12"
                  cy="12"
                  r="10"
                  strokeWidth="4"
                  strokeLinecap="round"
                  fill="none"
                  pathLength="100"
                  strokeDasharray="60 140"
                  strokeDashoffset="0"
                />
              </svg>
            </span>
          )}
        </>
      ))}
    </RACButton>
  );
}
