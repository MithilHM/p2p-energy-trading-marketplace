import { Volume2, VolumeX, Zap } from 'lucide-react'
import { StatusIndicator } from '../primitives/StatusIndicator'
import { formatClock } from '../../lib/format'
import type { VoiceControls } from '../../demo/useVoiceAlerts'

interface TopBarProps {
  now: number
  marketOpen: boolean
  voice?: VoiceControls
  currentPath?: string
}

/** Tickers in the top bar — a compact macro strip of headline rates. */
const ticker = [
  { label: 'SPOT', value: '72.48', unit: '₹/MWh', up: true },
  { label: 'PEAK', value: '94.10', unit: '₹/MWh', up: true },
  { label: 'OFF-PEAK', value: '51.32', unit: '₹/MWh', up: false },
  { label: 'REC', value: '38.75', unit: '₹/MWh', up: true },
  { label: 'CO₂', value: '0.21', unit: 't/MWh', up: false },
]

export function TopBar({ now, marketOpen, voice, currentPath }: TopBarProps) {
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
          {/* Navigation Button */}
          <button
            type="button"
            onClick={() => {
              const nextPath = currentPath === '/producer/dashboard' ? '/' : '/producer/dashboard'
              window.history.pushState({}, '', nextPath)
              window.dispatchEvent(new Event('popstate'))
            }}
            className="flex items-center gap-1 px-3 py-1.5 rounded border border-slate-700/70 bg-slate-900/60 text-xs font-semibold text-slate-300 hover:text-slate-150 hover:bg-slate-800/80 transition-colors"
          >
            {currentPath === '/producer/dashboard' ? 'Exchange Dashboard' : 'Peer Dashboard'}
          </button>

          {/* Voice alerts toggle */}
          {voice?.supported && (
            <button
              type="button"
              onClick={voice.toggle}
              aria-pressed={voice.enabled}
              title={voice.enabled ? 'Mute voice alerts' : 'Enable voice alerts'}
              aria-label={voice.enabled ? 'Mute voice alerts' : 'Enable voice alerts'}
              className={`flex h-8 w-8 items-center justify-center rounded border transition-colors ${
                voice.enabled
                  ? 'border-production/40 bg-production/15 text-production hover:bg-production/25'
                  : 'border-slate-700/70 bg-slate-900/60 text-slate-400 hover:text-slate-200'
              }`}
            >
              {voice.enabled ? (
                <Volume2 className="h-4 w-4" strokeWidth={2} />
              ) : (
                <VolumeX className="h-4 w-4" strokeWidth={2} />
              )}
            </button>
          )}

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
        </div>
      </div>
    </header>
  )
}
