import { ArrowDownRight, ArrowUpRight, Minus } from 'lucide-react'
import type { Trend } from '../../data/types'
import { formatDelta } from '../../lib/format'

interface DeltaBadgeProps {
  pct: number
  trend?: Trend
  /** when true, "up" is bad (e.g. latency, utilization stress) */
  invert?: boolean
  size?: 'sm' | 'md'
  className?: string
}

/**
 * Directional change pill. Color encodes good/bad: green up by default,
 * inverted for metrics where rising is undesirable.
 */
export function DeltaBadge({ pct, trend, invert = false, size = 'sm', className = '' }: DeltaBadgeProps) {
  const dir: Trend = trend ?? (pct > 0.05 ? 'up' : pct < -0.05 ? 'down' : 'flat')
  const good = dir === 'flat' ? null : invert ? dir === 'down' : dir === 'up'

  const tone =
    good === null
      ? 'text-slate-400 bg-slate-500/10'
      : good
      ? 'text-production bg-production/10'
      : 'text-alert bg-alert/10'

  const Icon = dir === 'up' ? ArrowUpRight : dir === 'down' ? ArrowDownRight : Minus
  const pad = size === 'md' ? 'px-1.5 py-0.5 text-xs' : 'px-1 py-0.5 text-2xs'

  return (
    <span className={`tabular inline-flex items-center gap-0.5 rounded font-medium ${pad} ${tone} ${className}`}>
      <Icon className="h-3 w-3" strokeWidth={2.25} />
      {formatDelta(pct)}
    </span>
  )
}
