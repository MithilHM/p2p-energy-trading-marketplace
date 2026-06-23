import { Layers } from 'lucide-react'
import { Area, AreaChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { ChartContainer } from '../primitives/ChartContainer'
import { generationMixSeries } from '../../data/mockData'
import { chartAxis, sourceColor, tooltipStyle } from '../../theme/tokens'

const SOURCES = ['Solar', 'Wind', 'Hydro', 'Battery', 'Biomass'] as const

/** Stacked-area generation mix — how the supply stack is composed across the
 *  day. Order matters: dispatchable sources sit beneath intermittent ones. */
export function GenerationMixChart() {
  const data = generationMixSeries
  const last = data[data.length - 1]
  const total = SOURCES.reduce((s, k) => s + last[k], 0)
  const renewableShare = Math.round(((total - last.Battery) / total) * 100)

  return (
    <ChartContainer
      title="Generation Mix"
      icon={Layers}
      accent="text-teal-400"
      meta={<span className="tabular text-slate-400">{total} MW dispatched</span>}
      footer={
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5">
          {SOURCES.map((s) => (
            <span key={s} className="inline-flex items-center gap-1.5 text-slate-400">
              <span className="inline-block h-2 w-2 rounded-sm" style={{ background: sourceColor[s] }} />
              {s}
              <span className="tabular text-slate-500">{last[s]}</span>
            </span>
          ))}
          <span className="ml-auto tabular text-production">{renewableShare}% renewable</span>
        </div>
      }
    >
      <ResponsiveContainer width="100%" height={188}>
        <AreaChart data={data} margin={{ top: 8, right: 6, left: -18, bottom: 0 }}>
          <defs>
            {SOURCES.map((s) => (
              <linearGradient key={s} id={`mix-${s}`} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={sourceColor[s]} stopOpacity={0.7} />
                <stop offset="100%" stopColor={sourceColor[s]} stopOpacity={0.25} />
              </linearGradient>
            ))}
          </defs>
          <XAxis dataKey="t" {...chartAxis} interval={5} minTickGap={20} />
          <YAxis {...chartAxis} width={48} />
          <Tooltip {...tooltipStyle} />
          {SOURCES.map((s) => (
            <Area
              key={s}
              type="monotone"
              dataKey={s}
              stackId="mix"
              stroke={sourceColor[s]}
              strokeWidth={1}
              fill={`url(#mix-${s})`}
              animationDuration={900}
              name={s}
              unit=" MW"
            />
          ))}
        </AreaChart>
      </ResponsiveContainer>
    </ChartContainer>
  )
}
