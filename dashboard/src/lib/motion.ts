import type { Variants } from 'framer-motion'

/**
 * Shared motion vocabulary. A small, opinionated set of variants keeps the
 * whole surface feeling like one product rather than per-component improv.
 */

export const ease = [0.22, 1, 0.36, 1] as const // smooth ease-out

/** Container that staggers its children into view. */
export const staggerContainer: Variants = {
  hidden: {},
  show: {
    transition: { staggerChildren: 0.06, delayChildren: 0.04 },
  },
}

/** Standard panel/card entrance — rise + fade. */
export const riseIn: Variants = {
  hidden: { opacity: 0, y: 14 },
  show: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.5, ease },
  },
}

/** Feed row entrance/exit for AnimatePresence lists. */
export const feedRow: Variants = {
  hidden: { opacity: 0, x: -12, height: 0 },
  show: {
    opacity: 1,
    x: 0,
    height: 'auto',
    transition: { duration: 0.34, ease },
  },
  exit: {
    opacity: 0,
    x: 10,
    height: 0,
    transition: { duration: 0.24, ease },
  },
}

/** Section-level reveal, slightly heavier than card rise. */
export const sectionReveal: Variants = {
  hidden: { opacity: 0, y: 20 },
  show: { opacity: 1, y: 0, transition: { duration: 0.6, ease } },
}
