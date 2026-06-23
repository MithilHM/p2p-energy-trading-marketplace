import { useState } from 'react'
import { CalendarClock } from 'lucide-react'
import {
  Area,
  ComposedChart,
  Line,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { ChartContainer } from '../primitives/ChartContainer'
import { RangeTabs } from '../primitives/RangeTabs'
import { demandForecastSeries } from '../../data/mockData'
import { chartAxis, color, tooltipStyle } from '../../theme/tokens'

const RANGES = ['24H', '7D'] as const
type Range = (typeof RANGES)[number]

/** Demand forecast — actual (solid) transitions to model forecast (dashed)
 *  wrapped in a violet confidence band. The "now" marker pins the boundary. */
export function DemandForecastWidget() {
  const [range, setRange] = useState<Range>('24H')

  // 7D view stretches the horizon label only (same shape, coarser scale).
  const data = demandForecastSeries.map((d) => ({
    ...d,
    // band rendered as [lower, upper-lower] stack for the shaded ribbon
    bandBase: d.lower,
    bandSpan: d.upper - d.lower,
  }))

  return (
    <ChartContainer
      title="Demand Forecast"
      icon={CalendarClock}
      accent="text-forecast"
      meta={<RangeTabs options={RANGES} value={range} onChange={setRange} />}
      footer={
        <div className="flex items-center gap-4">
          <span className="inline-flex items-center gap-1.5 text-slate-400">
            <span className="inline-block h-0.5 w-3.5 rounded bg-slate-300" /> Actual
          </span>
          <span className="inline-flex items-center gap-1.5 text-slate-400">
            <span
              className="inline-block h-0.5 w-3.5 rounded"
              style={{ background: `repeating-linear-gradient(90deg, ${color.forecast} 0 4px, transparent 4px 7px)` }}
            />
            Forecast
          </span>
          <span className="inline-flex items-center gap-1.5 text-slate-400">
            <span className="inline-block h-2 w-3.5 rounded-sm" style={{ background: `${color.forecast}40` }} />
            95% CI
          </span>
          <span className="ml-auto tabular text-forecast">{range === '24H' ? 'next 12h' : 'next 7d'}</span>
        </div>
      }
    >
      <ResponsiveContainer width="100%" height={208}>
        <ComposedChart data={data} margin={{ top: 8, right: 8, left: -18, bottom: 0 }}>
          <defs>
            <linearGradient id="fc-band" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={color.forecast} stopOpacity={0.28} />
              <stop offset="100%" stopColor={color.forecast} stopOpacity={0.08} />
            </linearGradient>
          </defs>
          <XAxis dataKey="t" {...chartAxis} interval={2} minTickGap={16} />
          <YAxis {...chartAxis} width={48} domain={['dataMin - 60', 'dataMax + 60']} />
          <Tooltip {...tooltipStyle} />

          {/* confidence ribbon: invisible base + visible span stacked */}
          <Area dataKey="bandBase" stackId="band" stroke="none" fill="transparent" isAnimationActive={false} />
          <Area
            dataKey="bandSpan"
            stackId="band"
            stroke="none"
            fill="url(#fc-band)"
            animationDuration={900}
            name="CI span"
            unit=" MW"
          />

          <ReferenceLine x="now" stroke={color.border600} strokeDasharray="3 3" />

          <Line
            type="monotone"
            dataKey="actual"
            stroke={color.text300}
            strokeWidth={2}
            dot={false}
            connectNulls={false}
            animationDuration={1000}
            name="Actual"
            unit=" MW"
          />
          <Line
            type="monotone"
            dataKey="forecast"
            stroke={color.forecast}
            strokeWidth={2}
            strokeDasharray="5 4"
            dot={false}
            animationDuration={1100}
            name="Forecast"
            unit=" MW"
          />
        </ComposedChart>
      </ResponsiveContainer>
    </ChartContainer>
  )
}
