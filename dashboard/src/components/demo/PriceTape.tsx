/** Compact clearing-price ticker fed by `price` events: large current value,
 *  delta, trend and a hairline sparkline. Spotlighted in the pricing stage. */
import { ArrowDown, ArrowRight, ArrowUp, Gauge } from 'lucide-react'
import { AnimatedMetric } from '../primitives/AnimatedMetric'
import { color } from '../../theme/tokens'
import type { Trend } from '../../data/types'

interface PriceTapeProps {
  price: number
  deltaPct: number
  trend: Trend
  series: number[]
  source: string | null
}

function Spark({ data }: { data: number[] }) {
  if (data.length < 2) return null
  const w = 120
  const h = 30
  const min = Math.min(...data)
  const max = Math.max(...data)
  const span = max - min || 1
  const pts = data
    .map((v, i) => `${(i / (data.length - 1)) * w},${h - ((v - min) / span) * h}`)
    .join(' ')
  return (
    <svg width={w} height={h} className="overflow-visible">
      <polyline points={pts} fill="none" stroke={color.market} strokeWidth={1.5} strokeLinejoin="round" />
    </svg>
  )
}

export function PriceTape({ price, deltaPct, trend, series, source }: PriceTapeProps) {
  const TrendIcon = trend === 'up' ? ArrowUp : trend === 'down' ? ArrowDown : ArrowRight
  const trendColor = trend === 'up' ? 'text-production' : trend === 'down' ? 'text-alert' : 'text-slate-400'

  return (
    <section className="panel flex flex-col overflow-hidden" data-spotlight="pricing-tape">
      <header className="flex items-center justify-between border-b border-slate-700/50 px-4 py-3">
        <div className="flex items-center gap-2">
          <Gauge className="h-3.5 w-3.5 text-market" strokeWidth={2} />
          <h3 className="eyebrow text-slate-300">Clearing Price</h3>
        </div>
        <span className="text-2xs text-slate-500">{source === 'spark' ? 'spark stream' : 'live'}</span>
      </header>
      <div className="flex items-end justify-between px-4 py-3">
        <div>
          <span className="text-2xl font-semibold text-slate-50">
            ₹
            <AnimatedMetric value={price} format="number" decimals={2} unit="/kWh" className="text-2xl" />
          </span>
          <div className={`mt-1 flex items-center gap-1 text-2xs ${trendColor}`}>
            <TrendIcon className="h-3 w-3" strokeWidth={2.5} />
            <span className="tabular">
              {deltaPct > 0 ? '+' : ''}
              {deltaPct.toFixed(1)}%
            </span>
          </div>
        </div>
        <Spark data={series} />
      </div>
    </section>
  )
}
