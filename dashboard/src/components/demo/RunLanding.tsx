/**
 * Idle landing screen: project title + the primary RUN SIMULATION button that
 * starts the guided walkthrough. Terminal styling — a bordered call-to-action,
 * not a glowing gaming button.
 */
import { motion } from 'framer-motion'
import { Play, Zap, Network, Coins, ScrollText } from 'lucide-react'
import { staggerContainer, riseIn } from '../../lib/motion'
import type { ConnState } from '../../demo/useOrchestrator'

const BEATS = [
  { icon: Network, label: '~180 rooftop-solar & home peers across Bengaluru' },
  { icon: Zap, label: 'Demand, supply & a self-discovering ₹/kWh price' },
  { icon: Coins, label: 'Buyers & sellers matched, energy transferred' },
  { icon: ScrollText, label: 'Smart-contract escrow & automated ledger' },
]

export function RunLanding({ onRun, conn }: { onRun: () => void; conn: ConnState }) {
  return (
    <motion.div
      variants={staggerContainer}
      initial="hidden"
      animate="show"
      className="flex min-h-[70vh] flex-col items-center justify-center text-center"
    >
      <motion.div variants={riseIn} className="mb-2 flex items-center gap-2">
        <span className="eyebrow text-production">VOLTGRID Simulator</span>
      </motion.div>

      <motion.h1 variants={riseIn} className="max-w-2xl text-3xl font-semibold tracking-tight text-slate-50 sm:text-4xl">
        Peer-to-Peer Energy Settlement, end to end
      </motion.h1>

      <motion.p variants={riseIn} className="mt-3 max-w-xl text-sm leading-relaxed text-slate-400">
        A guided walkthrough of a live energy market across Bengaluru — from rooftop-solar peers
        metering energy, through ₹/kWh pricing and matching, to on-chain settlement. Press run and
        step through it.
      </motion.p>

      <motion.button
        variants={riseIn}
        onClick={onRun}
        className="mt-8 inline-flex items-center gap-2.5 rounded-md border border-production/50 bg-production/10 px-7 py-3.5 text-sm font-semibold uppercase tracking-wider text-production transition-colors hover:bg-production/20"
      >
        <Play className="h-4 w-4" strokeWidth={2.5} />
        Run Simulation
      </motion.button>

      <motion.div variants={riseIn} className="mt-3 flex items-center gap-2 text-2xs text-slate-500">
        <span className="relative flex h-1.5 w-1.5">
          <span
            className={`relative inline-flex h-1.5 w-1.5 rounded-full ${
              conn === 'live' ? 'bg-production' : conn === 'connecting' ? 'bg-market' : 'bg-slate-500'
            }`}
          />
        </span>
        {conn === 'live'
          ? 'live · orchestrator :8010'
          : conn === 'connecting'
          ? 'connecting…'
          : 'will run in local replay if no backend is found'}
        <span className="text-slate-600">· manual step-through · ← → to navigate</span>
      </motion.div>

      <motion.div
        variants={riseIn}
        className="mt-10 grid w-full max-w-2xl grid-cols-1 gap-2 sm:grid-cols-2"
      >
        {BEATS.map((b) => (
          <div
            key={b.label}
            className="panel-inset flex items-center gap-3 px-3.5 py-3 text-left text-2xs text-slate-400"
          >
            <b.icon className="h-4 w-4 shrink-0 text-production" strokeWidth={2} />
            {b.label}
          </div>
        ))}
      </motion.div>
    </motion.div>
  )
}
