import type { KPIDatum } from '../data/types'

const nf = (decimals: number) =>
  new Intl.NumberFormat('en-US', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  })

export function formatValue(value: number, datum: Pick<KPIDatum, 'format' | 'decimals'>): string {
  const { format, decimals } = datum
  switch (format) {
    case 'currency':
      return `$${nf(decimals).format(value)}`
    case 'percent':
      return `${nf(decimals).format(value)}`
    case 'compact':
      return `$${nf(decimals).format(value)}`
    case 'number':
    default:
      return nf(decimals).format(value)
  }
}

export function formatDelta(pct: number): string {
  const sign = pct > 0 ? '+' : ''
  return `${sign}${pct.toFixed(1)}%`
}

export function formatClock(epoch: number): string {
  return new Date(epoch).toLocaleTimeString('en-US', {
    hour12: false,
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  })
}

export function timeAgo(epoch: number, now: number): string {
  const s = Math.max(0, Math.floor((now - epoch) / 1000))
  if (s < 2) return 'now'
  if (s < 60) return `${s}s`
  const m = Math.floor(s / 60)
  return `${m}m`
}

/** Accent token → tailwind text/border/bg class fragments. */
export const accentClasses: Record<
  KPIDatum['accent'],
  { text: string; bg: string; ring: string; dot: string }
> = {
  production: { text: 'text-production', bg: 'bg-production/10', ring: 'ring-production/30', dot: 'bg-production' },
  consumption: { text: 'text-consumption', bg: 'bg-consumption/10', ring: 'ring-consumption/30', dot: 'bg-consumption' },
  market: { text: 'text-market', bg: 'bg-market/10', ring: 'ring-market/30', dot: 'bg-market' },
  forecast: { text: 'text-forecast', bg: 'bg-forecast/10', ring: 'ring-forecast/30', dot: 'bg-forecast' },
  alert: { text: 'text-alert', bg: 'bg-alert/10', ring: 'ring-alert/30', dot: 'bg-alert' },
  neutral: { text: 'text-slate-300', bg: 'bg-slate-500/10', ring: 'ring-slate-500/30', dot: 'bg-slate-400' },
}
