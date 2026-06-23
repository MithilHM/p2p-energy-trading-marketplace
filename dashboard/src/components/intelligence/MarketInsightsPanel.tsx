import { motion } from 'framer-motion'
import {
  AlertTriangle,
  Gauge,
  Leaf,
  Lightbulb,
  Scale,
  TrendingUp,
  type LucideIcon,
} from 'lucide-react'
import type { MarketInsight } from '../../data/types'
import { marketInsights } from '../../data/mockData'
import { staggerContainer, riseIn } from '../../lib/motion'

const kindIcon: Record<MarketInsight['kind'], LucideIcon> = {
  peak: Gauge,
  volatility: TrendingUp,
  renewable: Leaf,
  imbalance: Scale,
}

const severityStyle: Record<
  MarketInsight['severity'],
  { bar: string; chip: string; icon: string; iconBg: string }
> = {
  info: { bar: 'bg-production', chip: 'text-production', icon: 'text-production', iconBg: 'bg-production/10' },
  warn: { bar: 'bg-market', chip: 'text-market', icon: 'text-market', iconBg: 'bg-market/10' },
  critical: { bar: 'bg-alert', chip: 'text-alert', icon: 'text-alert', iconBg: 'bg-alert/10' },
}

/** Market insight cards — peak alerts, volatility, renewable share, and
 *  imbalance detection. A severity rail anchors each card's urgency. */
export function MarketInsightsPanel() {
  return (
    <section className="panel flex flex-col overflow-hidden">
      <header className="flex items-center justify-between border-b border-slate-700/50 px-4 py-3">
        <div className="flex items-center gap-2">
          <Lightbulb className="h-3.5 w-3.5 text-market" strokeWidth={2} />
          <h3 className="eyebrow text-slate-300">Market Insights</h3>
        </div>
        <span className="inline-flex items-center gap-1 text-2xs text-alert">
          <AlertTriangle className="h-3 w-3" /> 1 critical
        </span>
      </header>

      <motion.div
        variants={staggerContainer}
        initial="hidden"
        animate="show"
        className="flex flex-col gap-2 p-3"
      >
        {marketInsights.map((ins) => {
          const Icon = kindIcon[ins.kind]
          const s = severityStyle[ins.severity]
          return (
            <motion.article
              key={ins.id}
              variants={riseIn}
              whileHover={{ x: 2 }}
              className="panel-inset relative flex gap-3 overflow-hidden p-3"
            >
              <span className={`absolute inset-y-0 left-0 w-0.5 ${s.bar}`} />
              <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded ${s.iconBg}`}>
                <Icon className={`h-4 w-4 ${s.icon}`} strokeWidth={2} />
              </span>
              <div className="min-w-0 flex-1">
                <div className="flex items-center justify-between gap-2">
                  <h4 className="truncate text-2xs font-semibold text-slate-100">{ins.title}</h4>
                  <span className={`tabular shrink-0 text-xs font-bold ${s.chip}`}>{ins.value}</span>
                </div>
                <p className="mt-0.5 text-2xs leading-relaxed text-slate-400">{ins.detail}</p>
              </div>
            </motion.article>
          )
        })}
      </motion.div>
    </section>
  )
}
