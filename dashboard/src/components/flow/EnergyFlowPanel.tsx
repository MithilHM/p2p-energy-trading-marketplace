import { motion } from 'framer-motion'
import { Network, Workflow } from 'lucide-react'
import { EnergyFlowVisualization } from './EnergyFlowVisualization'
import { riseIn } from '../../lib/motion'

/**
 * Framed presentation of the signature energy-flow network. Given distinct
 * chrome from ordinary chart panels to mark it as the platform centerpiece.
 */
export function EnergyFlowPanel() {
  return (
    <motion.section
      variants={riseIn}
      className="panel relative overflow-hidden"
    >
      <header className="flex items-center justify-between gap-3 border-b border-slate-700/50 px-4 py-3">
        <div className="flex items-center gap-2.5">
          <span className="flex h-7 w-7 items-center justify-center rounded bg-production/10 ring-1 ring-production/30">
            <Workflow className="h-4 w-4 text-production" strokeWidth={2} />
          </span>
          <div>
            <h3 className="text-xs font-semibold tracking-tight text-slate-100">Energy Flow Network</h3>
            <p className="text-2xs text-slate-500">Real-time settlement topology · Producers → Exchange → Consumers</p>
          </div>
        </div>
        <span className="hidden items-center gap-1.5 text-2xs text-slate-500 sm:inline-flex">
          <Network className="h-3 w-3" /> 6 nodes · 5 active links
        </span>
      </header>
      <div className="p-3">
        <EnergyFlowVisualization />
      </div>
    </motion.section>
  )
}
