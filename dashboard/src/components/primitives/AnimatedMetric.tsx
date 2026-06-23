import { useCountUp } from '../../hooks/useCountUp'
import { formatValue } from '../../lib/format'
import type { KPIDatum } from '../../data/types'

interface AnimatedMetricProps {
  value: number
  format: KPIDatum['format']
  decimals: number
  className?: string
  /** suffix unit rendered smaller/dimmer */
  unit?: string
  durationMs?: number
  enabled?: boolean
}

/**
 * A count-up numeric display with tabular figures. Animates on mount and on
 * every value change, so it serves both initial reveal and live ticks.
 */
export function AnimatedMetric({
  value,
  format,
  decimals,
  className = '',
  unit,
  durationMs = 1000,
  enabled = true,
}: AnimatedMetricProps) {
  const display = useCountUp(value, durationMs, enabled)
  return (
    <span className={`tabular tracking-tight ${className}`}>
      {formatValue(display, { format, decimals })}
      {unit && <span className="ml-1 align-baseline text-[0.45em] font-medium uppercase tracking-wide text-slate-400">{unit}</span>}
    </span>
  )
}
