/**
 * Scalable peer-to-peer network — a single <canvas> driven by one rAF loop.
 * Renders ~180 nodes + capped animated transfer edges + pooled particles with
 * zero DOM churn (the original per-particle SVG approach won't scale this far).
 * Reads live data through a ref so the loop never waits on React re-renders.
 */
import { useEffect, useRef } from 'react'
import { useReducedMotion } from 'framer-motion'
import { Network } from 'lucide-react'
import type { ActiveTransfer, RosterNode } from '../../demo/events'
import { color } from '../../theme/tokens'
import { useNetworkModel } from './useNetworkModel'
import type { ActiveEdge, NetworkModel } from './useNetworkModel'
import { edgePoint } from './layout'
import type { ProjectedNode } from './layout'

interface NetworkCanvasProps {
  roster: RosterNode[]
  transfers: ActiveTransfer[]
  heroIds: string[]
}

const PAD = 26

function sideColor(side: ProjectedNode['side']): string {
  if (side === 'producer') return color.production
  if (side === 'consumer') return color.consumption
  return color.market
}

export function NetworkCanvas({ roster, transfers, heroIds }: NetworkCanvasProps) {
  const reduced = useReducedMotion() ?? false
  const model = useNetworkModel(roster, transfers, heroIds)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const wrapRef = useRef<HTMLDivElement>(null)
  const sizeRef = useRef({ w: 0, h: 0, dpr: 1 })

  useEffect(() => {
    const canvas = canvasRef.current
    const wrap = wrapRef.current
    if (!canvas || !wrap) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const resize = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 2)
      const w = wrap.clientWidth
      const h = wrap.clientHeight
      sizeRef.current = { w, h, dpr }
      canvas.width = Math.round(w * dpr)
      canvas.height = Math.round(h * dpr)
      canvas.style.width = `${w}px`
      canvas.style.height = `${h}px`
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    }
    resize()
    const ro = new ResizeObserver(resize)
    ro.observe(wrap)

    const px = (n: ProjectedNode) => {
      const { w, h } = sizeRef.current
      return { x: PAD + n.nx * (w - PAD * 2), y: PAD + n.ny * (h - PAD * 2) }
    }

    const drawFrame = (now: number) => {
      const { w, h } = sizeRef.current
      const m: NetworkModel = model.current
      ctx.clearRect(0, 0, w, h)
      if (!m.nodes.length) return

      const hub = m.byId.get('HUB')
      const hubP = hub ? px(hub) : { x: w / 2, y: h / 2 }

      // faint peer→exchange mesh
      ctx.lineWidth = 1
      for (const n of m.nodes) {
        if (n.side === 'hub') continue
        const p = px(n)
        ctx.strokeStyle = n.side === 'producer' ? color.production : color.consumption
        ctx.globalAlpha = 0.05
        ctx.beginPath()
        ctx.moveTo(p.x, p.y)
        ctx.lineTo(hubP.x, hubP.y)
        ctx.stroke()
      }
      ctx.globalAlpha = 1

      // prune + draw active transfer edges
      const live: ActiveEdge[] = []
      for (const e of m.edges) {
        const from = m.byId.get(e.fromId)
        const to = m.byId.get(e.toId)
        if (!from || !to) continue
        const elapsed = now - e.start
        const keep = e.spotlight
          ? m.heroIds.has(e.fromId) && m.heroIds.has(e.toId)
          : elapsed <= e.durationMs
        if (!keep) continue
        live.push(e)

        const s = px(from)
        const en = px(to)
        const c = e.spotlight ? color.market : color.production

        // base rail
        ctx.strokeStyle = c
        ctx.globalAlpha = e.spotlight ? 0.5 : 0.22
        ctx.lineWidth = e.spotlight ? 2 : 1.2
        ctx.beginPath()
        const STEPS = 24
        for (let i = 0; i <= STEPS; i++) {
          const pt = edgePoint(s, en, i / STEPS)
          if (i === 0) ctx.moveTo(pt.x, pt.y)
          else ctx.lineTo(pt.x, pt.y)
        }
        ctx.stroke()

        // particles
        if (!reduced) {
          const count = e.spotlight ? 4 : 2
          const base = e.spotlight ? (elapsed / e.durationMs) % 1 : Math.min(1, elapsed / e.durationMs)
          for (let i = 0; i < count; i++) {
            const t = e.spotlight ? (base + i / count) % 1 : Math.max(0, base - i * 0.12)
            if (!e.spotlight && t <= 0) continue
            const pt = edgePoint(s, en, t)
            const fade = Math.sin(Math.PI * t)
            ctx.globalAlpha = (e.spotlight ? 0.95 : 0.7) * Math.max(0.15, fade)
            ctx.fillStyle = c
            ctx.beginPath()
            ctx.arc(pt.x, pt.y, e.spotlight ? 3 : 2, 0, Math.PI * 2)
            ctx.fill()
          }
        }
      }
      m.edges = live
      ctx.globalAlpha = 1

      // nodes
      for (const n of m.nodes) {
        const p = px(n)
        const hero = m.heroIds.has(n.id)
        const isHub = n.side === 'hub'
        const c = sideColor(n.side)
        const r = isHub ? 7 : hero ? 6 : 2.3

        if (hero || isHub) {
          // pulse ring
          const pulse = isHub ? 0.5 : (Math.sin(now / 320) + 1) / 2
          ctx.globalAlpha = 0.18 + 0.22 * pulse
          ctx.fillStyle = c
          ctx.beginPath()
          ctx.arc(p.x, p.y, r + 6 + pulse * 4, 0, Math.PI * 2)
          ctx.fill()
        }

        ctx.globalAlpha = hero || isHub ? 1 : m.heroIds.size > 0 ? 0.45 : 0.85
        ctx.fillStyle = c
        ctx.beginPath()
        ctx.arc(p.x, p.y, r, 0, Math.PI * 2)
        ctx.fill()

        if (hero || isHub) {
          ctx.globalAlpha = 1
          ctx.strokeStyle = '#0a0e14'
          ctx.lineWidth = 1.5
          ctx.stroke()
          // label
          ctx.globalAlpha = 0.9
          ctx.fillStyle = color.text300
          ctx.font = '600 10px JetBrains Mono, monospace'
          ctx.textAlign = p.x > w * 0.5 ? 'right' : 'left'
          const dx = p.x > w * 0.5 ? -10 : 10
          ctx.fillText(n.name, p.x + dx, p.y + 3)
        }
      }
      ctx.globalAlpha = 1
    }

    let raf = 0
    if (reduced) {
      drawFrame(performance.now())
    } else {
      const loop = (t: number) => {
        drawFrame(t)
        raf = requestAnimationFrame(loop)
      }
      raf = requestAnimationFrame(loop)
    }

    return () => {
      cancelAnimationFrame(raf)
      ro.disconnect()
    }
  }, [model, reduced])

  const nodeCount = roster.length

  return (
    <section className="panel flex h-full flex-col overflow-hidden" data-spotlight="network">
      <header className="flex items-center justify-between border-b border-slate-700/50 px-4 py-3">
        <div className="flex items-center gap-2">
          <Network className="h-3.5 w-3.5 text-production" strokeWidth={2} />
          <h3 className="eyebrow text-slate-300">Peer-to-Peer Energy Network</h3>
        </div>
        <div className="flex items-center gap-3 text-2xs text-slate-500">
          <Legend c={color.production} label="Producers" />
          <Legend c={color.consumption} label="Consumers" />
          <Legend c={color.market} label="Exchange" />
          <span className="tabular text-slate-400">{nodeCount} peers</span>
        </div>
      </header>
      <div ref={wrapRef} className="relative min-h-[360px] flex-1">
        <canvas ref={canvasRef} className="absolute inset-0" />
        {nodeCount === 0 && (
          <div className="absolute inset-0 flex items-center justify-center text-2xs text-slate-600">
            awaiting network roster…
          </div>
        )}
      </div>
    </section>
  )
}

function Legend({ c, label }: { c: string; label: string }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <span className="inline-block h-2 w-2 rounded-full" style={{ background: c }} />
      {label}
    </span>
  )
}
