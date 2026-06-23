/**
 * Dims the whole viewport except the spotlighted panel, using the classic
 * giant-box-shadow "hole" technique — no blur (glass-free, on-aesthetic). The
 * spotlit panel stays fully interactive (`pointer-events-none` on the dim).
 */
import { motion, useReducedMotion } from 'framer-motion'
import { color } from '../../theme/tokens'
import type { Rect } from './useSpotlightRect'

const PAD = 8

export function SpotlightOverlay({ rect }: { rect: Rect | null }) {
  const reduced = useReducedMotion() ?? false
  if (!rect) return null

  const top = rect.top - PAD
  const left = rect.left - PAD
  const width = rect.width + PAD * 2
  const height = rect.height + PAD * 2

  return (
    <motion.div
      className="pointer-events-none fixed left-0 top-0 z-40 rounded-md"
      initial={false}
      animate={{ top, left, width, height }}
      transition={reduced ? { duration: 0 } : { type: 'spring', stiffness: 240, damping: 30 }}
      style={{
        boxShadow: `0 0 0 9999px rgba(7, 10, 15, 0.74)`,
        outline: `1px solid ${color.production}`,
        outlineOffset: '-1px',
      }}
    />
  )
}
