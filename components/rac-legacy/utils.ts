import {composeRenderProps} from 'react-aria-components/composeRenderProps';
import {twMerge} from 'tailwind-merge';
import {tv} from 'tailwind-variants';

export const focusRing = tv({
  // outline-focus, а не outline-blue-600: у лайма 600 на белом фоне не видно,
  // поэтому --focus сам подставляет светлой теме тёмную ступень (globals.css).
  base: 'outline outline-focus forced-colors:outline-[Highlight] outline-offset-2',
  variants: {
    isFocusVisible: {
      false: 'outline-0',
      true: 'outline-2'
    }
  }
});

export function composeTailwindRenderProps<T>(
  className: string | ((v: T) => string) | undefined,
  tw: string
): string | ((v: T) => string) {
  return composeRenderProps(className, className => twMerge(tw, className));
}
