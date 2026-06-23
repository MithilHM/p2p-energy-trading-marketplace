import { motion } from 'framer-motion'
import { Users } from 'lucide-react'
import type { Consumer } from '../../data/types'
import { consumers } from '../../data/mockData'
import { DeltaBadge } from '../primitives/DeltaBadge'
import { staggerContainer, riseIn } from '../../lib/motion'

const segmentColor: Record<Consumer['segment'], string> = {
  'Data Center': 'text-forecast',
  Industrial: 'text-consumption',
  Commercial: 'text-indigo-400',
  Municipal: 'text-teal-400',
}

/** Consumer rankings — usage, demand trend, and an efficiency score rendered
 *  as a compact segmented meter. */
export function ConsumerLeaderboard() {
  const ranked = [...consumers].sort((a, b) => b.usageMwh - a.usageMwh)

  return (
    <section className="panel flex flex-col overflow-hidden">
      <header className="flex items-center justify-between border-b border-slate-700/50 px-4 py-3">
        <div className="flex items-center gap-2">
          <Users className="h-3.5 w-3.5 text-consumption" strokeWidth={2} />
          <h3 className="eyebrow text-slate-300">Consumer Rankings</h3>
        </div>
        <span className="text-2xs text-slate-500">Usage · Efficiency</span>
      </header>

      <div className="grid grid-cols-[1fr_64px_72px] gap-x-2 px-4 py-2 text-[10px] font-semibold uppercase tracking-wide text-slate-500">
        <span>Consumer</span>
        <span className="text-right">Usage</span>
        <span className="text-right">Efficiency</span>
      </div>

      <motion.div
        variants={staggerContainer}
        initial="hidden"
        animate="show"
        className="flex flex-col px-2 pb-2"
      >
        {ranked.map((c) => (
          <ConsumerRow key={c.id} c={c} />
        ))}
      </motion.div>
    </section>
  )
}

function ConsumerRow({ c }: { c: Consumer }) {
  const filled = Math.round(c.efficiency / 10)

  return (
    <motion.div
      variants={riseIn}
      className="group grid grid-cols-[1fr_64px_72px] items-center gap-x-2 rounded px-2 py-2 transition-colors hover:bg-slate-800/50"
    >
      <div className="min-w-0">
        <div className="truncate text-2xs font-medium text-slate-200">{c.name}</div>
        <div className={`text-[10px] font-medium ${segmentColor[c.segment]}`}>{c.segment}</div>
      </div>

      <div className="text-right">
        <div className="tabular text-2xs font-semibold text-slate-100">{c.usageMwh}</div>
        <DeltaBadge pct={c.demandTrend} className="ml-auto mt-0.5" />
      </div>

      <div className="flex flex-col items-end gap-1">
        <span className="tabular text-2xs font-semibold text-slate-200">{c.efficiency}</span>
        <div className="flex gap-0.5">
          {Array.from({ length: 10 }).map((_, i) => (
            <span
              key={i}
              className={`h-2.5 w-0.5 rounded-full ${
                i < filled
                  ? c.efficiency >= 85
                    ? 'bg-production'
                    : c.efficiency >= 75
                    ? 'bg-market'
                    : 'bg-alert'
                  : 'bg-slate-700'
              }`}
            />
          ))}
        </div>
      </div>
    </motion.div>
  )
}
