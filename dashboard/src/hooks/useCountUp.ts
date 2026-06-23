import { useEffect, useRef, useState } from 'react'

/**
 * Animates a numeric value from its previous value to the target using an
 * ease-out cubic curve. Re-runs whenever `value` changes, so it doubles as a
 * smooth value-transition for live KPI updates (not just an initial count-up).
 */
export function useCountUp(value: number, durationMs = 900, enabled = true) {
  const [display, setDisplay] = useState(enabled ? 0 : value)
  const fromRef = useRef(0)
  const rafRef = useRef<number>()
  const startRef = useRef<number>()

  useEffect(() => {
    if (!enabled) {
      setDisplay(value)
      return
    }
    const from = fromRef.current
    const delta = value - from
    startRef.current = undefined

    const tick = (now: number) => {
      if (startRef.current === undefined) startRef.current = now
      const elapsed = now - startRef.current
      const p = Math.min(1, elapsed / durationMs)
      const eased = 1 - Math.pow(1 - p, 3)
      const current = from + delta * eased
      setDisplay(current)
      if (p < 1) {
        rafRef.current = requestAnimationFrame(tick)
      } else {
        fromRef.current = value
      }
    }
    rafRef.current = requestAnimationFrame(tick)
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current)
      fromRef.current = value
    }
  }, [value, durationMs, enabled])

  return display
}
