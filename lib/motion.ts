// Shared motion presets — implements the user's motion spec timings/easing.
// Default easing cubic-bezier(0.16, 1, 0.3, 1); transform/opacity only (GPU friendly).

import type { Transition, Variants } from "motion/react";

export const EASE = [0.16, 1, 0.3, 1] as const;

export const T = {
  hover: { duration: 0.11, ease: EASE },
  press: { duration: 0.09, ease: EASE },
  dropdown: { duration: 0.14, ease: EASE },
  popover: { duration: 0.16, ease: EASE },
  tab: { duration: 0.2, ease: EASE },
  accordion: { duration: 0.2, ease: EASE },
  dialog: { duration: 0.22, ease: EASE },
  layout: { duration: 0.28, ease: EASE },
} satisfies Record<string, Transition>;

export const spring: Transition = { type: "spring", stiffness: 520, damping: 34, mass: 0.7 };
export const springSoft: Transition = { type: "spring", stiffness: 300, damping: 30 };

export const indicatorSpring: Transition = { type: "spring", stiffness: 420, damping: 38, mass: 0.8 };

/** Card / section enter — fade + slight rise, GPU transform only. */
export const cardIn: Variants = {
  hidden: { opacity: 0, y: 8 },
  show: (i = 0) => ({ opacity: 1, y: 0, transition: { duration: 0.32, ease: EASE, delay: Math.min(i, 8) * 0.035 } }),
};

/** List item add/remove — fade + rise + height collapse. */
export const listItem: Variants = {
  hidden: { opacity: 0, y: -6, height: 0 },
  show: { opacity: 1, y: 0, height: "auto", transition: { duration: 0.2, ease: EASE } },
  exit: { opacity: 0, y: -6, height: 0, transition: { duration: 0.16, ease: EASE } },
};

/** Dialog content — scale from 0.98 + slight rise (close slightly faster). */
export const dialogContent: Variants = {
  hidden: { opacity: 0, scale: 0.98, y: 6 },
  show: { opacity: 1, scale: 1, y: 0, transition: { duration: 0.22, ease: EASE } },
  exit: { opacity: 0, scale: 0.98, y: 4, transition: { duration: 0.16, ease: EASE } },
};

export const fade: Variants = {
  hidden: { opacity: 0 },
  show: { opacity: 1, transition: { duration: 0.18, ease: EASE } },
  exit: { opacity: 0, transition: { duration: 0.14, ease: EASE } },
};
