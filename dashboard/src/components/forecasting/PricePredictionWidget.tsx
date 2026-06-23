import { motion } from 'framer-motion'
import { TrendingUp, TrendingDown, Minus, Sparkles } from 'lucide-react'
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
import { priceForecastSeries } from '../../data/mockData'
import { chartAxis, color, tooltipStyle } from '../../theme/tokens'

type Sentiment = 'Bullish' | 'Neutral' | 'Bearish'

const sentimentMeta: Record<
  Sentiment,
  { icon: typeof TrendingUp; text: string; bg: string; ring: string }
> = {
  Bullish: { icon: TrendingUp, text: 'text-production', bg: 'bg-production/10', ring: 'ring-production/40' },
  Neutral: { icon: Minus, text: 'text-slate-300', bg: 'bg-slate-500/10', ring: 'ring-slate-500/40' },
  Bearish: { icon: TrendingDown, text: 'text-alert', bg: 'bg-alert/10', ring: 'ring-alert/40' },
}

/** Price prediction — forecast price with a volatility band, plus a directional
 *  sentiment header (Bullish / Neutral / Bearish). */
export function PricePredictionWidget() {
  const data = priceForecastSeries.map((d) => ({
    ...d,
    bandBase: d.predicted - d.band,
    bandSpan: d.band * 2,
  }))

  const lastActual = [...priceForecastSeries].reverse().find((d) => d.price != null)?.price ?? 72
  const horizon = priceForecastSeries[priceForecastSeries.length - 1].predicted
  const expectedMove = ((horizon - lastActual) / lastActual) * 100

  const sentiment: Sentiment =
    expectedMove > 1.5 ? 'Bullish' : expectedMove < -1.5 ? 'Bearish' : 'Neutral'
  const s = sentimentMeta[sentiment]
  const SIcon = s.icon

  return (
    <ChartContainer
      title="Price Prediction"
      icon={Sparkles}
      accent="text-forecast"
      meta={<span className="tabular text-slate-400">XGBoost · 10h</span>}
      footer={
        <div className="flex items-center justify-between">
          <span className="text-slate-400">Model confidence 86%</span>
          <span className="tabular text-slate-400">
            volatility <span className="text-forecast">14.2%</span>
          </span>
        </div>
      }
    >
      {/* sentiment + expected move header */}
      <div className="mb-2 flex items-center justify-between gap-3 px-1">
        <motion.div
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className={`inline-flex items-center gap-1.5 rounded-md px-2.5 py-1 ring-1 ${s.bg} ${s.ring}`}
        >
          <SIcon className={`h-4 w-4 ${s.text}`} strokeWidth={2.25} />
          <span className={`text-xs font-semibold ${s.text}`}>{sentiment}</span>
        </motion.div>
        <div className="text-right">
          <div className="eyebrow text-slate-500">Expected Move</div>
          <div className={`tabular text-base font-semibold ${expectedMove >= 0 ? 'text-production' : 'text-alert'}`}>
            {expectedMove >= 0 ? '+' : ''}
            {expectedMove.toFixed(1)}%
          </div>
        </div>
      </div>

      <ResponsiveContainer width="100%" height={150}>
        <ComposedChart data={data} margin={{ top: 4, right: 8, left: -20, bottom: 0 }}>
          <defs>
            <linearGradient id="pp-band" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={color.purple} stopOpacity={0.26} />
              <stop offset="100%" stopColor={color.purple} stopOpacity={0.06} />
            </linearGradient>
          </defs>
          <XAxis dataKey="t" {...chartAxis} interval={3} minTickGap={14} />
          <YAxis {...chartAxis} width={44} domain={['dataMin - 4', 'dataMax + 4']} unit="" />
          <Tooltip {...tooltipStyle} />
          <Area dataKey="bandBase" stackId="b" stroke="none" fill="transparent" isAnimationActive={false} />
          <Area dataKey="bandSpan" stackId="b" stroke="none" fill="url(#pp-band)" animationDuration={900} name="Vol band" unit=" $" />
          <ReferenceLine x="now" stroke={color.border600} strokeDasharray="3 3" />
          <Line type="monotone" dataKey="price" stroke={color.text300} strokeWidth={2} dot={false} connectNulls={false} animationDuration={1000} name="Spot" unit=" $/MWh" />
          <Line type="monotone" dataKey="predicted" stroke={color.forecast} strokeWidth={2} strokeDasharray="5 4" dot={false} animationDuration={1100} name="Predicted" unit=" $/MWh" />
        </ComposedChart>
      </ResponsiveContainer>
    </ChartContainer>
  )
}
