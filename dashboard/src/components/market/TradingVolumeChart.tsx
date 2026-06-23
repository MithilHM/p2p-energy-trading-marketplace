import { useState } from 'react'
import { BarChart3 } from 'lucide-react'
import {
  Bar,
  ComposedChart,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { ChartContainer } from '../primitives/ChartContainer'
import { RangeTabs } from '../primitives/RangeTabs'
import { volumeSeries } from '../../data/mockData'
import { chartAxis, color, tooltipStyle } from '../../theme/tokens'

const RANGES = ['Hourly', 'Daily'] as const
type Range = (typeof RANGES)[number]

/** Traded volume bars (amber) with a liquidity-depth line overlay. The two
 *  encodings together communicate both flow and market quality. */
export function TradingVolumeChart() {
  const [range, setRange] = useState<Range>('Hourly')

  // "Daily" view aggregates pairs of hours into a coarser bar set.
  const data =
    range === 'Hourly'
      ? volumeSeries
      : volumeSeries
          .filter((_, i) => i % 2 === 0)
          .map((d, i) => ({
            ...d,
            t: `D${i + 1}`,
            volume: d.volume + (volumeSeries[i * 2 + 1]?.volume ?? 0),
          }))

  const totalVol = data.reduce((s, d) => s + d.volume, 0)
  const avgLiquidity = Math.round(data.reduce((s, d) => s + d.liquidity, 0) / data.length)

  return (
    <ChartContainer
      title="Trading Volume"
      icon={BarChart3}
      accent="text-market"
      meta={<RangeTabs options={RANGES} value={range} onChange={setRange} />}
      footer={
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <span className="inline-flex items-center gap-1.5 text-slate-400">
              <span className="inline-block h-2 w-2 rounded-sm bg-market" /> Volume
            </span>
            <span className="inline-flex items-center gap-1.5 text-slate-400">
              <span className="inline-block h-0.5 w-3.5 rounded" style={{ background: color.purple }} /> Liquidity
            </span>
          </div>
          <span className="tabular text-slate-400">
            {totalVol.toLocaleString()} MWh · liq {avgLiquidity}
          </span>
        </div>
      }
    >
      <ResponsiveContainer width="100%" height={188}>
        <ComposedChart data={data} margin={{ top: 8, right: 6, left: -18, bottom: 0 }}>
          <defs>
            <linearGradient id="vol-bar" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={color.market} stopOpacity={0.95} />
              <stop offset="100%" stopColor={color.gold} stopOpacity={0.45} />
            </linearGradient>
          </defs>
          <XAxis dataKey="t" {...chartAxis} interval="preserveStartEnd" minTickGap={18} />
          <YAxis yAxisId="vol" {...chartAxis} width={48} />
          <YAxis yAxisId="liq" orientation="right" {...chartAxis} width={28} domain={[0, 100]} hide />
          <Tooltip {...tooltipStyle} />
          <Bar
            yAxisId="vol"
            dataKey="volume"
            fill="url(#vol-bar)"
            radius={[2, 2, 0, 0]}
            animationDuration={800}
            name="Volume"
            unit=" MWh"
            maxBarSize={22}
          />
          <Line
            yAxisId="liq"
            type="monotone"
            dataKey="liquidity"
            stroke={color.purple}
            strokeWidth={2}
            dot={false}
            animationDuration={1000}
            name="Liquidity"
          />
        </ComposedChart>
      </ResponsiveContainer>
    </ChartContainer>
  )
}
