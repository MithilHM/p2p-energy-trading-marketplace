import { Gauge } from 'lucide-react'
import {
  Area,
  Bar,
  ComposedChart,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { ChartContainer } from '../primitives/ChartContainer'
import { gridLoadSeries } from '../../data/mockData'
import { chartAxis, color, tooltipStyle } from '../../theme/tokens'

/** Grid load analysis: stacked baseload + peaking bars against a firm capacity
 *  ceiling. The gap to the capacity line is the operating reserve margin. */
export function GridLoadChart() {
  const data = gridLoadSeries
  const last = data[data.length - 1]
  const load = last.baseload + last.peaking
  const margin = Math.round(((last.capacity - load) / last.capacity) * 100)

  return (
    <ChartContainer
      title="Grid Load Analysis"
      icon={Gauge}
      accent="text-consumption"
      meta={
        <span className="tabular text-slate-400">
          reserve <span className={margin < 10 ? 'text-alert' : 'text-production'}>{margin}%</span>
        </span>
      }
      footer={
        <div className="flex items-center gap-4">
          <span className="inline-flex items-center gap-1.5 text-slate-400">
            <span className="inline-block h-2 w-2 rounded-sm bg-consumption" /> Baseload
          </span>
          <span className="inline-flex items-center gap-1.5 text-slate-400">
            <span className="inline-block h-2 w-2 rounded-sm" style={{ background: color.indigo }} /> Peaking
          </span>
          <span className="inline-flex items-center gap-1.5 text-slate-400">
            <span className="inline-block h-0.5 w-3.5 rounded bg-alert" /> Firm capacity
          </span>
        </div>
      }
    >
      <ResponsiveContainer width="100%" height={188}>
        <ComposedChart data={data} margin={{ top: 8, right: 6, left: -18, bottom: 0 }}>
          <defs>
            <linearGradient id="grid-cap" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={color.alert} stopOpacity={0.12} />
              <stop offset="100%" stopColor={color.alert} stopOpacity={0} />
            </linearGradient>
          </defs>
          <XAxis dataKey="t" {...chartAxis} interval={5} minTickGap={20} />
          <YAxis {...chartAxis} width={48} domain={[0, 1800]} />
          <Tooltip {...tooltipStyle} />
          <Area
            type="step"
            dataKey="capacity"
            stroke="transparent"
            fill="url(#grid-cap)"
            animationDuration={700}
            name="Headroom"
            unit=" MW"
          />
          <Bar dataKey="baseload" stackId="load" fill={color.consumption} radius={[0, 0, 0, 0]} animationDuration={800} name="Baseload" unit=" MW" maxBarSize={18} />
          <Bar dataKey="peaking" stackId="load" fill={color.indigo} radius={[2, 2, 0, 0]} animationDuration={800} name="Peaking" unit=" MW" maxBarSize={18} />
          <Line
            type="monotone"
            dataKey="capacity"
            stroke={color.alert}
            strokeWidth={1.5}
            strokeDasharray="5 3"
            dot={false}
            animationDuration={1000}
            name="Capacity"
            unit=" MW"
          />
        </ComposedChart>
      </ResponsiveContainer>
    </ChartContainer>
  )
}
