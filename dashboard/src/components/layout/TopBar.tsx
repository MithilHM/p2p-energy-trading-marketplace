import { Bell, ChevronDown, Search, Zap } from 'lucide-react'
import { motion } from 'framer-motion'
import { StatusIndicator } from '../primitives/StatusIndicator'
import { formatClock } from '../../lib/format'

interface TopBarProps {
  now: number
  marketOpen: boolean
}

/** Tickers in the top bar — a compact macro strip of headline rates. */
const ticker = [
  { label: 'SPOT', value: '72.48', unit: '$/MWh', up: true },
  { label: 'PEAK', value: '94.10', unit: '$/MWh', up: true },
  { label: 'OFF-PEAK', value: '51.32', unit: '$/MWh', up: false },
  { label: 'REC', value: '38.75', unit: '$/MWh', up: true },
  { label: 'CO₂', value: '0.21', unit: 't/MWh', up: false },
]

export function TopBar({ now, marketOpen }: TopBarProps) {
  return (
    <header className="sticky top-0 z-40 border-b border-slate-800/80 bg-charcoal/85 backdrop-blur-md">
      <div className="flex h-14 items-center gap-4 px-4 sm:px-5">
        {/* Brand */}
        <div className="flex items-center gap-2.5">
          <div className="flex h-7 w-7 items-center justify-center rounded bg-production/15 ring-1 ring-production/30 lg:hidden">
            <Zap className="h-4 w-4 text-production" strokeWidth={2.25} fill="currentColor" />
          </div>
          <div className="leading-none">
            <div className="flex items-baseline gap-1.5">
              <span className="text-sm font-bold tracking-tight text-slate-50">VOLTGRID</span>
              <span className="text-2xs font-medium text-slate-500">EXCHANGE</span>
            </div>
            <div className="mt-0.5 hidden text-2xs text-slate-500 sm:block">
              P2P Energy Settlement Network
            </div>
          </div>
        </div>

        <div className="hidden h-7 w-px bg-slate-800 md:block" />

        {/* Live ticker strip */}
        <div className="hidden min-w-0 flex-1 items-center gap-5 overflow-hidden md:flex">
          {ticker.map((t) => (
            <div key={t.label} className="flex items-baseline gap-1.5 whitespace-nowrap">
              <span className="text-2xs font-semibold uppercase tracking-wide text-slate-500">
                {t.label}
              </span>
              <span className="tabular text-xs font-semibold text-slate-200">{t.value}</span>
              <span className={`text-2xs font-medium ${t.up ? 'text-production' : 'text-alert'}`}>
                {t.up ? '▲' : '▼'}
              </span>
            </div>
          ))}
        </div>

        <div className="flex flex-1 items-center justify-end gap-2 md:flex-none">
          {/* Search */}
          <button className="hidden h-8 items-center gap-2 rounded border border-slate-700/70 bg-slate-900/60 px-2.5 text-slate-400 transition-colors hover:border-slate-600 hover:text-slate-200 lg:flex">
            <Search className="h-3.5 w-3.5" />
            <span className="text-2xs">Search markets</span>
            <kbd className="rounded border border-slate-700 px-1 text-2xs text-slate-500">⌘K</kbd>
          </button>

          {/* Market status */}
          <div className="flex items-center gap-2 rounded border border-slate-700/70 bg-slate-900/60 px-2.5 py-1.5">
            <StatusIndicator
              status={marketOpen ? 'operational' : 'degraded'}
              label={marketOpen ? 'Market Open' : 'Pre-Auction'}
            />
            <span className="hidden tabular text-2xs font-medium text-slate-300 sm:inline">
              {formatClock(now)} UTC
            </span>
          </div>

          {/* Alerts */}
          <button className="relative flex h-8 w-8 items-center justify-center rounded border border-slate-700/70 bg-slate-900/60 text-slate-400 transition-colors hover:border-slate-600 hover:text-slate-200">
            <Bell className="h-4 w-4" strokeWidth={1.9} />
            <motion.span
              className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-alert px-1 text-[9px] font-bold text-white"
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ type: 'spring', stiffness: 500, damping: 18, delay: 0.6 }}
            >
              3
            </motion.span>
          </button>

          {/* Account */}
          <button className="flex items-center gap-2 rounded border border-slate-700/70 bg-slate-900/60 py-1 pl-1 pr-2 transition-colors hover:border-slate-600">
            <span className="flex h-6 w-6 items-center justify-center rounded bg-gradient-to-br from-production/30 to-consumption/30 text-2xs font-bold text-slate-100">
              ME
            </span>
            <span className="hidden text-2xs font-medium text-slate-300 sm:inline">Desk · NA-East</span>
            <ChevronDown className="h-3.5 w-3.5 text-slate-500" />
          </button>
        </div>
      </div>
    </header>
  )
}
