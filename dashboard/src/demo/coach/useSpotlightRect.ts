/** Tracks the viewport rect of the `[data-spotlight="<id>"]` element, recomputing
 *  on resize/scroll so the spotlight cutout + dialog stay glued to their target. */
import { useEffect, useState } from 'react'
import type { SpotlightTarget } from '../stages'

export interface Rect {
  top: number
  left: number
  width: number
  height: number
}

export function useSpotlightRect(target: SpotlightTarget): Rect | null {
  const [rect, setRect] = useState<Rect | null>(null)

  useEffect(() => {
    if (!target) {
      setRect(null)
      return
    }
    const el = document.querySelector<HTMLElement>(`[data-spotlight="${target}"]`)
    if (!el) {
      setRect(null)
      return
    }

    let raf = 0
    const measure = () => {
      const r = el.getBoundingClientRect()
      setRect({ top: r.top, left: r.left, width: r.width, height: r.height })
    }
    const schedule = () => {
      cancelAnimationFrame(raf)
      raf = requestAnimationFrame(measure)
    }

    measure()
    const ro = new ResizeObserver(schedule)
    ro.observe(el)
    ro.observe(document.body)
    window.addEventListener('resize', schedule)
    window.addEventListener('scroll', schedule, true)

    return () => {
      cancelAnimationFrame(raf)
      ro.disconnect()
      window.removeEventListener('resize', schedule)
      window.removeEventListener('scroll', schedule, true)
    }
  }, [target])

  return rect
}
