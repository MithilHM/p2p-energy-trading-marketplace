import { useEffect } from 'react'
import { animate, motion, useMotionValue, useTransform } from 'framer-motion'
import { bezier, type ResolvedLink } from './flowMath'

interface FlowParticleProps {
  link: ResolvedLink
  delay: number
  duration: number
  color: string
  radius: number
  reduced: boolean
}

/**
 * A single luminous packet riding a bezier link. Owns its own motion value so
 * many particles animate independently and cheaply on the compositor. Position
 * is sampled from the pre-computed control points each frame via useTransform.
 */
export function FlowParticle({ link, delay, duration, color, radius, reduced }: FlowParticleProps) {
  const t = useMotionValue(0)

  useEffect(() => {
    if (reduced) {
      t.set(0.5)
      return
    }
    const controls = animate(t, 1, {
      duration,
      delay,
      ease: 'linear',
      repeat: Infinity,
      repeatType: 'loop',
    })
    return () => controls.stop()
  }, [t, duration, delay, reduced])

  const cx = useTransform(t, (v) => bezier(link.c0, link.c1, link.c2, link.c3, v).x)
  const cy = useTransform(t, (v) => bezier(link.c0, link.c1, link.c2, link.c3, v).y)
  // fade in at the source, out at the destination
  const opacity = useTransform(t, [0, 0.12, 0.85, 1], [0, 1, 1, 0])

  return (
    <motion.circle
      cx={cx}
      cy={cy}
      r={radius}
      fill={color}
      style={{ opacity }}
      filter="url(#flow-glow)"
    />
  )
}
