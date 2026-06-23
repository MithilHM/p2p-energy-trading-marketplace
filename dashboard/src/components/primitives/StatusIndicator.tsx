import type { HealthStatus } from '../../data/types'

const config: Record<
  HealthStatus,
  { label: string; dot: string; text: string; ring: string }
> = {
  operational: { label: 'Operational', dot: 'bg-production', text: 'text-production', ring: 'bg-production/60' },
  degraded: { label: 'Degraded', dot: 'bg-market', text: 'text-market', ring: 'bg-market/60' },
  down: { label: 'Outage', dot: 'bg-alert', text: 'text-alert', ring: 'bg-alert/60' },
}

interface StatusIndicatorProps {
  status: HealthStatus
  label?: string
  showLabel?: boolean
  /** show the animated pulse ring (live signal) */
  pulse?: boolean
  className?: string
}

/** Pulsing status dot + optional label. The pulse ring is the only "live"
 *  animation; kept subtle and operational rather than decorative. */
export function StatusIndicator({
  status,
  label,
  showLabel = true,
  pulse = true,
  className = '',
}: StatusIndicatorProps) {
  const c = config[status]
  return (
    <div className={`inline-flex items-center gap-2 ${className}`}>
      <span className="relative inline-flex h-2 w-2 items-center justify-center">
        {pulse && status !== 'down' && (
          <span className={`absolute inline-flex h-2 w-2 rounded-full ${c.ring} animate-pulse-ring`} />
        )}
        <span className={`relative inline-flex h-2 w-2 rounded-full ${c.dot}`} />
      </span>
      {showLabel && (
        <span className={`text-2xs font-medium ${c.text}`}>{label ?? c.label}</span>
      )}
    </div>
  )
}
