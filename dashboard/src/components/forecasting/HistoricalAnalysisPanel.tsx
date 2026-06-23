import { useState } from 'react'
import { History } from 'lucide-react'
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
import { historicalSeries } from '../../data/mockData'
import { chartAxis, color, tooltipStyle } from '../../theme/tokens'

const VIEWS = ['Price', 'Demand', 'All'] as const
type View = (typeof VIEWS)[number]

/** Historical analysis — 12-month seasonal view of pricing, demand and
 *  production on a dual axis. Toggle isolates a series or shows the full set. */
export function HistoricalAnalysisPanel() {
  const [view, setView] = useState<View>('All')
  const data = historicalSeries
  const showPrice = view === 'Price' || view === 'All'
  const showVol = view === 'Demand' || view === 'All'

  return (
    <ChartContainer
      title="Historical Analysis"
      icon={History}
      accent="text-slate-300"
      meta={<RangeTabs options={VIEWS} value={view} onChange={setView} />}
      footer={
        <div className="flex items-center gap-4">
          {showVol && (
            <>
              <span className="inline-flex items-center gap-1.5 text-slate-400">
                <span className="inline-block h-2 w-2 rounded-sm bg-consumption" /> Demand
              </span>
              <span className="inline-flex items-center gap-1.5 text-slate-400">
                <span className="inline-block h-2 w-2 rounded-sm bg-production" /> Production
              </span>
            </>
          )}
          {showPrice && (
            <span className="inline-flex items-center gap-1.5 text-slate-400">
              <span className="inline-block h-0.5 w-3.5 rounded bg-market" /> Price (₹/MWh)
            </span>
          )}
          <span className="ml-auto tabular text-slate-500">Trailing 12 months</span>
        </div>
      }
    >
      <ResponsiveContainer width="100%" height={200}>
        <ComposedChart data={data} margin={{ top: 8, right: 8, left: -18, bottom: 0 }}>
          <defs>
            <linearGradient id="hist-demand" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={color.consumption} stopOpacity={0.25} />
              <stop offset="100%" stopColor={color.consumption} stopOpacity={0.02} />
            </linearGradient>
            <linearGradient id="hist-prod" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={color.production} stopOpacity={0.22} />
              <stop offset="100%" stopColor={color.production} stopOpacity={0.02} />
            </linearGradient>
          </defs>
          <XAxis dataKey="label" {...chartAxis} minTickGap={8} />
          <YAxis yAxisId="vol" {...chartAxis} width={48} />
          <YAxis yAxisId="price" orientation="right" {...chartAxis} width={36} />
          <Tooltip {...tooltipStyle} />

          {showVol && (
            <>
              <Area yAxisId="vol" type="monotone" dataKey="demand" stroke={color.consumption} strokeWidth={1.5} fill="url(#hist-demand)" animationDuration={900} name="Demand" unit=" GWh" />
              <Area yAxisId="vol" type="monotone" dataKey="production" stroke={color.production} strokeWidth={1.5} fill="url(#hist-prod)" animationDuration={900} name="Production" unit=" GWh" />
            </>
          )}
          {showPrice && (
            <Line yAxisId="price" type="monotone" dataKey="price" stroke={color.market} strokeWidth={2} dot={{ r: 2, fill: color.market }} animationDuration={1100} name="Price" unit=" ₹/MWh" />
          )}
        </ComposedChart>
      </ResponsiveContainer>
    </ChartContainer>
  )
}
