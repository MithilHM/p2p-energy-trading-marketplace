import { motion } from 'framer-motion'
import type { KPIDatum } from '../../data/types'
import { AnimatedMetric } from '../primitives/AnimatedMetric'
import { DeltaBadge } from '../primitives/DeltaBadge'
import { Sparkline } from '../primitives/Sparkline'
import { riseIn } from '../../lib/motion'
import { accentClasses } from '../../lib/format'
import { color } from '../../theme/tokens'

const sparkColor: Record<KPIDatum['accent'], string> = {
  production: color.production,
  consumption: color.consumption,
  market: color.market,
  forecast: color.forecast,
  alert: color.alert,
  neutral: color.text400,
}

interface KPICardProps {
  datum: KPIDatum
  /** grid utilization is a metric where "up" is stress, not good */
  invertDelta?: boolean
}

export function KPICard({ datum, invertDelta }: KPICardProps) {
  const a = accentClasses[datum.accent]

  return (
    <motion.article
      variants={riseIn}
      whileHover={{ y: -3 }}
      transition={{ type: 'spring', stiffness: 320, damping: 26 }}
      className="panel group relative flex flex-col overflow-hidden p-3.5 transition-colors hover:border-slate-600/70"
    >
      {/* accent edge */}
      <span className={`absolute inset-x-0 top-0 h-px ${a.dot} opacity-50`} />

      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-1.5">
          <span className={`h-1.5 w-1.5 rounded-full ${a.dot}`} />
          <h3 className="eyebrow">{datum.label}</h3>
        </div>
        <DeltaBadge pct={datum.deltaPct} trend={datum.trend} invert={invertDelta} />
      </div>

      <div className="mt-2.5 flex items-end justify-between gap-2">
        <div className="min-w-0">
          <AnimatedMetric
            value={datum.value}
            format={datum.format}
            decimals={datum.decimals}
            unit={datum.unit}
            className="text-[1.75rem] font-semibold leading-none text-slate-50"
          />
        </div>
      </div>

      <div className="mt-3 flex items-end justify-between gap-3">
        <p className="text-2xs text-slate-500">{datum.caption}</p>
        <div className="shrink-0 opacity-80 transition-opacity group-hover:opacity-100">
          <Sparkline data={datum.sparkline} color={sparkColor[datum.accent]} width={88} height={26} />
        </div>
      </div>
    </motion.article>
  )
}
