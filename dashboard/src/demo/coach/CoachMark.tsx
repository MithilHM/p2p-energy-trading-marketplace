/**
 * The guide dialog box. Anchors next to the spotlighted panel (or bottom-center
 * when there is no target), shows the stage copy + progress, and hosts the
 * walkthrough controls. Terminal styling — bordered panel, no glow.
 */
import { motion } from 'framer-motion'
import {
  ChevronLeft,
  ChevronRight,
  Pause,
  Play,
  RotateCcw,
  SkipForward,
  Circle,
} from 'lucide-react'
import type { Rect } from './useSpotlightRect'
import { ease } from '../../lib/motion'

const W = 360
const GAP = 16
const M = 12

interface CoachMarkProps {
  index: number
  total: number
  title: string
  body: string
  ready: boolean
  paused: boolean
  rect: Rect | null
  controls: {
    next: () => void
    back: () => void
    pause: () => void
    play: () => void
    skip: () => void
    replay: () => void
  }
}

function placement(rect: Rect | null): { top: number; left: number } {
  const vw = window.innerWidth
  const vh = window.innerHeight
  if (!rect) {
    return { top: vh - 240, left: Math.max(M, vw / 2 - W / 2) }
  }
  // prefer to the right of the target, else left, else below
  let left = rect.left + rect.width + GAP
  if (left + W > vw - M) left = rect.left - W - GAP
  if (left < M) left = Math.min(Math.max(M, rect.left), vw - W - M)
  let top = rect.top
  top = Math.min(Math.max(M, top), vh - 230)
  return { top, left }
}

export function CoachMark({ index, total, title, body, ready, paused, rect, controls }: CoachMarkProps) {
  const { top, left } = placement(rect)
  const isLast = index === total - 1
  const pct = Math.round(((index + 1) / total) * 100)

  return (
    <motion.div
      className="panel fixed z-50 w-[360px] p-0 text-slate-200 shadow-xl"
      style={{ top, left }}
      initial={{ opacity: 0, y: 10, scale: 0.98 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: 8, scale: 0.98 }}
      transition={{ duration: 0.32, ease }}
    >
      {/* header */}
      <div className="flex items-center justify-between border-b border-slate-700/50 px-4 py-2.5">
        <span className="eyebrow text-production">Guided Walkthrough</span>
        <span className="tabular text-2xs text-slate-500">
          {index + 1} / {total}
        </span>
      </div>

      {/* body */}
      <div className="px-4 py-3.5">
        <h3 className="mb-1.5 text-sm font-semibold text-slate-50">{title}</h3>
        <p className="text-xs leading-relaxed text-slate-400">{body}</p>

        <div className="mt-3 flex items-center gap-1.5 text-2xs">
          <Circle
            className={`h-2 w-2 ${ready ? 'fill-production text-production' : 'fill-slate-600 text-slate-600'}`}
            strokeWidth={0}
          />
          <span className={ready ? 'text-production' : 'text-slate-500'}>
            {ready ? 'live data caught up' : 'waiting for live data…'}
          </span>
        </div>
      </div>

      {/* progress bar */}
      <div className="h-0.5 w-full bg-slate-800">
        <div className="h-full bg-production transition-all duration-500" style={{ width: `${pct}%` }} />
      </div>

      {/* controls */}
      <div className="flex items-center justify-between gap-2 px-3 py-2.5">
        <div className="flex items-center gap-1.5">
          <Ctl onClick={controls.back} disabled={index === 0} label="Back">
            <ChevronLeft className="h-3.5 w-3.5" />
          </Ctl>
          <Ctl onClick={paused ? controls.play : controls.pause} label={paused ? 'Resume' : 'Pause'}>
            {paused ? <Play className="h-3.5 w-3.5" /> : <Pause className="h-3.5 w-3.5" />}
          </Ctl>
          <Ctl onClick={controls.replay} label="Replay">
            <RotateCcw className="h-3.5 w-3.5" />
          </Ctl>
          <Ctl onClick={controls.skip} label="Skip">
            <SkipForward className="h-3.5 w-3.5" />
          </Ctl>
        </div>

        <button
          onClick={controls.next}
          className="inline-flex items-center gap-1.5 rounded border border-production/40 bg-production/10 px-3 py-1.5 text-2xs font-semibold uppercase tracking-wide text-production transition-colors hover:bg-production/20"
        >
          {isLast ? 'Finish' : 'Next'}
          <ChevronRight className="h-3.5 w-3.5" />
        </button>
      </div>
    </motion.div>
  )
}

function Ctl({
  children,
  onClick,
  disabled,
  label,
}: {
  children: React.ReactNode
  onClick: () => void
  disabled?: boolean
  label: string
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      title={label}
      className="inline-flex h-7 w-7 items-center justify-center rounded border border-slate-700/70 bg-slate-900/60 text-slate-400 transition-colors hover:bg-slate-800 hover:text-slate-200 disabled:cursor-not-allowed disabled:opacity-40"
    >
      {children}
    </button>
  )
}
