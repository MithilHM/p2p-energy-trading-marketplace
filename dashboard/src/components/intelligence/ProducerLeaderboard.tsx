import { motion } from 'framer-motion'
import { Trophy } from 'lucide-react'
import type { Producer } from '../../data/types'
import { producers } from '../../data/mockData'
import { sourceColor } from '../../theme/tokens'
import { DeltaBadge } from '../primitives/DeltaBadge'
import { staggerContainer, riseIn } from '../../lib/motion'

/** Producer leaderboard — ranked by output, with a utilization bar
 *  (output / capacity) and reliability. Sorted descending on output. */
export function ProducerLeaderboard() {
  const ranked = [...producers].sort((a, b) => b.outputMw - a.outputMw)

  return (
    <section className="panel flex flex-col overflow-hidden">
      <header className="flex items-center justify-between border-b border-slate-700/50 px-4 py-3">
        <div className="flex items-center gap-2">
          <Trophy className="h-3.5 w-3.5 text-production" strokeWidth={2} />
          <h3 className="eyebrow text-slate-300">Producer Leaderboard</h3>
        </div>
        <span className="text-2xs text-slate-500">Output · Reliability</span>
      </header>

      <div className="grid grid-cols-[20px_1fr_64px_56px] gap-x-2 px-4 py-2 text-[10px] font-semibold uppercase tracking-wide text-slate-500">
        <span>#</span>
        <span>Producer</span>
        <span className="text-right">Output</span>
        <span className="text-right">Rel.</span>
      </div>

      <motion.div
        variants={staggerContainer}
        initial="hidden"
        animate="show"
        className="flex flex-col px-2 pb-2"
      >
        {ranked.map((p, i) => (
          <ProducerRow key={p.id} p={p} rank={i + 1} />
        ))}
      </motion.div>
    </section>
  )
}

function ProducerRow({ p, rank }: { p: Producer; rank: number }) {
  const util = Math.round((p.outputMw / p.capacityMw) * 100)
  const c = sourceColor[p.type]

  return (
    <motion.div
      variants={riseIn}
      className="group grid grid-cols-[20px_1fr_64px_56px] items-center gap-x-2 rounded px-2 py-2 transition-colors hover:bg-slate-800/50"
    >
      <span className={`tabular text-xs font-semibold ${rank <= 3 ? 'text-slate-200' : 'text-slate-500'}`}>
        {rank}
      </span>

      <div className="min-w-0">
        <div className="flex items-center gap-1.5">
          <span className="h-2 w-2 shrink-0 rounded-sm" style={{ background: c }} />
          <span className="truncate text-2xs font-medium text-slate-200">{p.name}</span>
        </div>
        {/* utilization bar */}
        <div className="mt-1 flex items-center gap-1.5">
          <div className="h-1 flex-1 overflow-hidden rounded-full bg-slate-800">
            <motion.div
              className="h-full rounded-full"
              style={{ background: c }}
              initial={{ width: 0 }}
              animate={{ width: `${util}%` }}
              transition={{ duration: 0.9, ease: [0.22, 1, 0.36, 1] }}
            />
          </div>
          <span className="tabular text-[10px] text-slate-500">{util}%</span>
        </div>
      </div>

      <div className="text-right">
        <div className="tabular text-2xs font-semibold text-slate-100">{p.outputMw}</div>
        <div className="tabular text-[10px] text-slate-500">/{p.capacityMw} MW</div>
      </div>

      <div className="flex flex-col items-end gap-0.5">
        <span className="tabular text-2xs font-medium text-slate-200">{p.reliability}%</span>
        <DeltaBadge pct={p.trend === 'up' ? 1.2 : p.trend === 'down' ? -1.1 : 0} trend={p.trend} />
      </div>
    </motion.div>
  )
}
