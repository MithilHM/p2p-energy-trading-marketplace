import { useState } from 'react'
import { Activity } from 'lucide-react'
import {
  Area,
  ComposedChart,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { ChartContainer } from '../primitives/ChartContainer'
import { RangeTabs } from '../primitives/RangeTabs'
import { supplyDemandSeries } from '../../data/mockData'
import { chartAxis, color, tooltipStyle } from '../../theme/tokens'

const RANGES = ['6H', '12H', '24H'] as const
type Range = (typeof RANGES)[number]

const rangeRows: Record<Range, number> = { '6H': 6, '12H': 12, '24H': 24 }

export interface SupplyDemandDatum {
  t: string
  supply: number
  demand: number
  cleared?: number
}

/** Supply (emerald) vs demand (blue) area overlay with a cleared-volume line.
 *  The crossover regions read instantly as surplus / deficit. When `data` is
 *  supplied (live simulator feed) it drives the chart; otherwise it falls back
 *  to the seeded 24h series with range tabs. */
export function SupplyDemandChart({ data: liveData }: { data?: SupplyDemandDatum[] } = {}) {
  const [range, setRange] = useState<Range>('24H')
  const isLive = !!liveData && liveData.length > 0
  const data = isLive
    ? liveData!.map((d) => ({ ...d, cleared: d.cleared ?? Math.min(d.supply, d.demand) }))
    : supplyDemandSeries.slice(supplyDemandSeries.length - rangeRows[range])

  const latest = data[data.length - 1]
  const balance = latest ? latest.supply - latest.demand : 0

  return (
    <ChartContainer
      title="Supply vs Demand"
      icon={Activity}
      accent="text-production"
      meta={isLive ? <span className="text-2xs text-slate-500">live · rolling</span> : <RangeTabs options={RANGES} value={range} onChange={setRange} />}
      footer={
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Legend color={color.production} label="Supply" />
            <Legend color={color.consumption} label="Demand" />
            <Legend color={color.market} label="Cleared" dashed />
          </div>
          <span className="tabular">
            Net balance{' '}
            <span className={balance >= 0 ? 'font-semibold text-production' : 'font-semibold text-alert'}>
              {balance >= 0 ? '+' : ''}
              {balance} MW
            </span>
          </span>
        </div>
      }
    >
      <ResponsiveContainer width="100%" height={208}>
        <ComposedChart data={data} margin={{ top: 8, right: 6, left: -18, bottom: 0 }}>
          <defs>
            <linearGradient id="sd-supply" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={color.production} stopOpacity={0.35} />
              <stop offset="100%" stopColor={color.production} stopOpacity={0.02} />
            </linearGradient>
            <linearGradient id="sd-demand" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={color.consumption} stopOpacity={0.28} />
              <stop offset="100%" stopColor={color.consumption} stopOpacity={0.02} />
            </linearGradient>
          </defs>
          <XAxis dataKey="t" {...chartAxis} interval="preserveStartEnd" minTickGap={24} />
          <YAxis {...chartAxis} width={48} />
          <Tooltip {...tooltipStyle} />
          <Area
            type="monotone"
            dataKey="supply"
            stroke={color.production}
            strokeWidth={2}
            fill="url(#sd-supply)"
            animationDuration={900}
            dot={false}
            name="Supply"
            unit=" MW"
          />
          <Area
            type="monotone"
            dataKey="demand"
            stroke={color.consumption}
            strokeWidth={2}
            fill="url(#sd-demand)"
            animationDuration={900}
            dot={false}
            name="Demand"
            unit=" MW"
          />
          <Line
            type="monotone"
            dataKey="cleared"
            stroke={color.market}
            strokeWidth={1.5}
            strokeDasharray="4 3"
            dot={false}
            animationDuration={1100}
            name="Cleared"
            unit=" MW"
          />
        </ComposedChart>
      </ResponsiveContainer>
    </ChartContainer>
  )
}

function Legend({ color: c, label, dashed }: { color: string; label: string; dashed?: boolean }) {
  return (
    <span className="inline-flex items-center gap-1.5 text-slate-400">
      <span
        className="inline-block h-0.5 w-3.5 rounded"
        style={{
          background: dashed
            ? `repeating-linear-gradient(90deg, ${c} 0 4px, transparent 4px 7px)`
            : c,
        }}
      />
      {label}
    </span>
  )
}
