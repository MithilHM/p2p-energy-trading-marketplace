import { motion } from 'framer-motion'
import { ServerCog } from 'lucide-react'
import type { HealthNode } from '../../data/types'
import { healthNodes } from '../../data/mockData'
import { StatusIndicator } from '../primitives/StatusIndicator'
import { Sparkline } from '../primitives/Sparkline'
import { staggerContainer, riseIn } from '../../lib/motion'
import { color } from '../../theme/tokens'

const statusColor: Record<HealthNode['status'], string> = {
  operational: color.production,
  degraded: color.market,
  down: color.alert,
}

/**
 * Enterprise operations panel. Status is communicated through indicators and
 * inline traces rather than gauges/speedometers — operational, not decorative.
 */
export function SystemHealthPanel() {
  const allUp = healthNodes.every((n) => n.status === 'operational')
  const uptime = '99.98%'

  return (
    <section className="panel flex flex-col overflow-hidden">
      <header className="flex items-center justify-between border-b border-slate-700/50 px-4 py-3">
        <div className="flex items-center gap-2">
          <ServerCog className="h-3.5 w-3.5 text-slate-300" strokeWidth={2} />
          <h3 className="eyebrow text-slate-300">System Health</h3>
        </div>
        <div className="flex items-center gap-3">
          <span className="tabular text-2xs text-slate-500">
            uptime <span className="text-production">{uptime}</span>
          </span>
          <StatusIndicator
            status={allUp ? 'operational' : 'degraded'}
            label={allUp ? 'All Systems Nominal' : 'Partial Degradation'}
          />
        </div>
      </header>

      <motion.div
        variants={staggerContainer}
        initial="hidden"
        animate="show"
        className="grid grid-cols-2 gap-px bg-slate-800/40 sm:grid-cols-3 lg:grid-cols-5"
      >
        {healthNodes.map((n) => (
          <motion.div
            key={n.id}
            variants={riseIn}
            className="group flex flex-col gap-2 bg-slate-850/80 p-3.5 transition-colors hover:bg-slate-800/60"
          >
            <div className="flex items-center justify-between">
              <span className="eyebrow text-slate-400">{n.label}</span>
              <StatusIndicator status={n.status} showLabel={false} />
            </div>

            <div className="flex items-baseline gap-1">
              <span className="tabular text-xl font-semibold text-slate-50">{n.value}</span>
              <span className="text-2xs font-medium text-slate-500">{n.unit}</span>
            </div>

            <div className="flex items-center justify-between gap-2">
              <span className="text-2xs text-slate-500">{n.metric}</span>
              <Sparkline
                data={n.trace}
                color={statusColor[n.status]}
                width={56}
                height={18}
                fill={false}
                strokeWidth={1.25}
              />
            </div>
          </motion.div>
        ))}
      </motion.div>
    </section>
  )
}
