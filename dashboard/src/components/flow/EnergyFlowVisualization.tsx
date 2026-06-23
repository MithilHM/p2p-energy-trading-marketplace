import { useMemo } from 'react'
import { motion, useReducedMotion } from 'framer-motion'
import {
  Building2,
  Factory,
  Network,
  Sun,
  Wind,
  BatteryCharging,
  type LucideIcon,
} from 'lucide-react'
import type { FlowNode, FlowNodeKind } from '../../data/types'
import { flowLinks, flowNodes } from '../../data/mockData'
import { color } from '../../theme/tokens'
import { resolveLink, VB } from './flowMath'
import { FlowParticle } from './FlowParticle'

const kindIcon: Record<FlowNodeKind, LucideIcon> = {
  solar: Sun,
  wind: Wind,
  battery: BatteryCharging,
  market: Network,
  industrial: Factory,
  commercial: Building2,
}

const kindAccent: Record<FlowNodeKind, { ring: string; text: string; bg: string; hex: string }> = {
  solar: { ring: 'ring-market/40', text: 'text-market', bg: 'bg-market/10', hex: color.market },
  wind: { ring: 'ring-teal-500/40', text: 'text-teal-400', bg: 'bg-teal-500/10', hex: color.teal },
  battery: { ring: 'ring-forecast/40', text: 'text-forecast', bg: 'bg-forecast/10', hex: color.purple },
  market: { ring: 'ring-production/50', text: 'text-production', bg: 'bg-production/10', hex: color.production },
  industrial: { ring: 'ring-consumption/40', text: 'text-consumption', bg: 'bg-consumption/10', hex: color.consumption },
  commercial: { ring: 'ring-indigo-500/40', text: 'text-indigo-400', bg: 'bg-indigo-500/10', hex: color.indigo },
}

/** Producer-side links glow emerald (supply); consumer-side links glow blue
 *  (delivery). Encodes direction with color, not just motion. */
function linkColor(side: FlowNode['side']) {
  return side === 'producer' ? color.production : color.consumption
}

/**
 * ENERGY FLOW VISUALIZATION — the platform's signature view.
 *
 * Producers → Exchange → Consumers, rendered as an animated network. HTML node
 * chips are overlaid on an aspect-locked SVG so their normalized coordinates
 * map exactly onto the bezier links and traveling energy packets beneath them.
 */
export function EnergyFlowVisualization() {
  const reduced = useReducedMotion() ?? false

  const nodeMap = useMemo(
    () => Object.fromEntries(flowNodes.map((n) => [n.id, n])) as Record<string, FlowNode>,
    []
  )
  const links = useMemo(
    () => flowLinks.map((l) => resolveLink(l, nodeMap)).filter(Boolean) as NonNullable<
      ReturnType<typeof resolveLink>
    >[],
    [nodeMap]
  )

  const totalThroughput = flowLinks
    .filter((l) => nodeMap[l.from]?.side === 'producer')
    .reduce((s, l) => s + l.flow, 0)

  return (
    <div className="relative w-full overflow-hidden rounded" style={{ aspectRatio: `${VB.w} / ${VB.h}` }}>
      {/* SVG layer: links + particles */}
      <svg
        viewBox={`0 0 ${VB.w} ${VB.h}`}
        preserveAspectRatio="xMidYMid meet"
        className="absolute inset-0 h-full w-full"
        aria-hidden
      >
        <defs>
          <filter id="flow-glow" x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur stdDeviation="1.4" result="b" />
            <feMerge>
              <feMergeNode in="b" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
          {/* faint column guide gradient */}
          <linearGradient id="flow-col" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={color.border700} stopOpacity={0.0} />
            <stop offset="50%" stopColor={color.border700} stopOpacity={0.18} />
            <stop offset="100%" stopColor={color.border700} stopOpacity={0.0} />
          </linearGradient>
        </defs>

        {/* column guides for producer / hub / consumer lanes */}
        {[0.1, 0.5, 0.9].map((x) => (
          <line
            key={x}
            x1={x * VB.w}
            y1={28}
            x2={x * VB.w}
            y2={VB.h - 28}
            stroke="url(#flow-col)"
            strokeWidth={1}
          />
        ))}

        {/* links */}
        {links.map((rl) => {
          const c = linkColor(rl.from.side)
          return (
            <g key={rl.link.id}>
              {/* base rail */}
              <path d={rl.d} fill="none" stroke={c} strokeOpacity={0.18} strokeWidth={rl.width} strokeLinecap="round" />
              {/* animated pulse dash traveling the rail */}
              {!reduced && (
                <motion.path
                  d={rl.d}
                  fill="none"
                  stroke={c}
                  strokeOpacity={0.55}
                  strokeWidth={rl.width}
                  strokeLinecap="round"
                  strokeDasharray="2 26"
                  initial={{ strokeDashoffset: 0 }}
                  animate={{ strokeDashoffset: -280 }}
                  transition={{ duration: 3.4, ease: 'linear', repeat: Infinity }}
                />
              )}
              {/* energy packets */}
              {Array.from({ length: rl.particles }).map((_, i) => (
                <FlowParticle
                  key={i}
                  link={rl}
                  delay={(i / rl.particles) * 2.6}
                  duration={2.6}
                  color={c}
                  radius={rl.width * 0.7 + 1.2}
                  reduced={reduced}
                />
              ))}
            </g>
          )
        })}
      </svg>

      {/* HTML layer: node chips, aligned by normalized coords */}
      {flowNodes.map((n) => (
        <NodeChip key={n.id} node={n} />
      ))}

      {/* lane captions */}
      <LaneCaption x={0.1} label="Producers" />
      <LaneCaption x={0.5} label="Exchange" highlight />
      <LaneCaption x={0.9} label="Consumers" />

      {/* live throughput readout */}
      <div className="pointer-events-none absolute bottom-2 right-3 text-right">
        <div className="eyebrow text-slate-500">Live Throughput</div>
        <div className="tabular text-sm font-semibold text-production">{totalThroughput} MW</div>
      </div>
    </div>
  )
}

function NodeChip({ node }: { node: FlowNode }) {
  const Icon = kindIcon[node.kind]
  const a = kindAccent[node.kind]
  const isHub = node.side === 'hub'

  return (
    <motion.div
      className="absolute -translate-x-1/2 -translate-y-1/2"
      style={{ left: `${node.x * 100}%`, top: `${node.y * 100}%` }}
      initial={{ opacity: 0, scale: 0.8 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.5, delay: 0.2, ease: [0.22, 1, 0.36, 1] }}
    >
      <div
        className={`flex items-center gap-2 rounded-md border border-slate-700/70 bg-slate-900/90 px-2.5 py-1.5 shadow-panel backdrop-blur-sm ${
          isHub ? 'ring-1 ring-production/40' : ''
        }`}
      >
        <span className={`relative flex shrink-0 items-center justify-center rounded ${a.bg} ring-1 ${a.ring} ${isHub ? 'h-9 w-9' : 'h-7 w-7'}`}>
          <Icon className={`${isHub ? 'h-5 w-5' : 'h-3.5 w-3.5'} ${a.text}`} strokeWidth={2} />
          {isHub && (
            <span className="absolute inset-0 rounded ring-1 ring-production/50 animate-pulse-ring" />
          )}
        </span>
        <div className="min-w-0 leading-tight">
          <div className={`truncate font-semibold ${isHub ? 'text-xs text-slate-50' : 'text-2xs text-slate-200'}`}>
            {node.label}
          </div>
          <div className="tabular text-2xs text-slate-500">{node.sub}</div>
        </div>
      </div>
    </motion.div>
  )
}

function LaneCaption({ x, label, highlight }: { x: number; label: string; highlight?: boolean }) {
  return (
    <div
      className="pointer-events-none absolute top-1.5 -translate-x-1/2"
      style={{ left: `${x * 100}%` }}
    >
      <span className={`eyebrow ${highlight ? 'text-production' : 'text-slate-500'}`}>{label}</span>
    </div>
  )
}
