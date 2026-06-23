/**
 * Peer Network Map — the hero. A dark MapLibre basemap of Bengaluru (CARTO
 * dark-matter, no API key) with a transparent canvas overlay that draws the
 * glowing peer mesh, animated energy transfers and node tooltips, projected
 * onto real lat/long. If the basemap tiles can't load (offline), it degrades to
 * a dark field and projects nodes via the city bounding box, so the network
 * still renders anywhere.
 */
import { useEffect, useRef, useState } from 'react'
import { useReducedMotion } from 'framer-motion'
import maplibregl from 'maplibre-gl'
import 'maplibre-gl/dist/maplibre-gl.css'
import { Layers, Radio, ZoomIn, ZoomOut } from 'lucide-react'
import type { ActiveTransfer, RosterNode } from '../../demo/events'
import { BLR_CENTER } from '../../demo/bengaluru'
import { color } from '../../theme/tokens'
import { useNetworkModel } from './useNetworkModel'
import type { ActiveEdge, NetworkModel } from './useNetworkModel'
import { edgePoint } from './layout'
import type { ProjectedNode } from './layout'

const STYLE_URL = 'https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json'

interface Props {
  roster: RosterNode[]
  transfers: ActiveTransfer[]
  heroIds: string[]
  readings: Record<string, { energy: number; role: string; ts: number }>
}

function sideColor(side: ProjectedNode['side']): string {
  if (side === 'consumer') return color.consumption
  if (side === 'hub') return color.market
  return color.production // producer + prosumer = supply
}

export function NetworkMap({ roster, transfers, heroIds, readings }: Props) {
  const reduced = useReducedMotion() ?? false
  const model = useNetworkModel(roster, transfers, heroIds)
  const wrapRef = useRef<HTMLDivElement>(null)
  const mapDivRef = useRef<HTMLDivElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const mapRef = useRef<maplibregl.Map | null>(null)
  const mapReadyRef = useRef(false)
  const projectedRef = useRef<Map<string, { x: number; y: number }>>(new Map())
  const hoveredRef = useRef<string | null>(null)
  const [hovered, setHovered] = useState<string | null>(null)
  const [offline, setOffline] = useState(false)
  const [, setTick] = useState(0) // force re-render so tooltip follows the map

  // ---- map init ----
  useEffect(() => {
    if (!mapDivRef.current) return
    let map: maplibregl.Map
    try {
      map = new maplibregl.Map({
        container: mapDivRef.current,
        style: STYLE_URL,
        center: [BLR_CENTER.lng, BLR_CENTER.lat],
        zoom: 11.2,
        pitch: 52,
        bearing: -18,
        attributionControl: false,
        dragRotate: true,
      })
    } catch {
      setOffline(true)
      return
    }
    mapRef.current = map
    const onReady = () => {
      mapReadyRef.current = true
    }
    map.on('load', onReady)
    map.on('error', () => {
      // tiles/style failed — fall back to the dark field projection
      if (!mapReadyRef.current) setOffline(true)
    })
    map.on('move', () => setTick((t) => (t + 1) % 1000000))
    map.on('mousemove', (e) => {
      const p = projectedRef.current
      let best: string | null = null
      let bestD = 16 * 16
      for (const [id, pos] of p) {
        const d = (pos.x - e.point.x) ** 2 + (pos.y - e.point.y) ** 2
        if (d < bestD) {
          bestD = d
          best = id
        }
      }
      if (best !== hoveredRef.current) {
        hoveredRef.current = best
        setHovered(best)
      }
    })

    // if it never loads (offline), drop to fallback so nodes still render
    const t = setTimeout(() => {
      if (!mapReadyRef.current) setOffline(true)
    }, 4500)

    return () => {
      clearTimeout(t)
      map.remove()
      mapRef.current = null
      mapReadyRef.current = false
    }
  }, [])

  // ---- overlay draw loop ----
  useEffect(() => {
    const canvas = canvasRef.current
    const wrap = wrapRef.current
    if (!canvas || !wrap) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    let size = { w: 0, h: 0, dpr: 1 }
    const resize = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 2)
      const w = wrap.clientWidth
      const h = wrap.clientHeight
      size = { w, h, dpr }
      canvas.width = Math.round(w * dpr)
      canvas.height = Math.round(h * dpr)
      canvas.style.width = `${w}px`
      canvas.style.height = `${h}px`
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    }
    resize()
    const ro = new ResizeObserver(resize)
    ro.observe(wrap)

    const project = (n: ProjectedNode) => {
      if (mapRef.current && mapReadyRef.current && n.lng != null && n.lat != null) {
        const p = mapRef.current.project([n.lng, n.lat])
        return { x: p.x, y: p.y }
      }
      return { x: n.nx * size.w, y: n.ny * size.h }
    }

    const drawNodeGlow = (x: number, y: number, r: number, c: string, alpha: number) => {
      ctx.globalAlpha = alpha * 0.25
      ctx.fillStyle = c
      ctx.beginPath()
      ctx.arc(x, y, r + 5, 0, Math.PI * 2)
      ctx.fill()
      ctx.globalAlpha = alpha
      ctx.beginPath()
      ctx.arc(x, y, r, 0, Math.PI * 2)
      ctx.fill()
    }

    const frame = (now: number) => {
      const { w, h } = size
      const m: NetworkModel = model.current
      ctx.clearRect(0, 0, w, h)
      if (!m.nodes.length) return

      // project everything once per frame
      const pos = projectedRef.current
      pos.clear()
      for (const n of m.nodes) pos.set(n.id, project(n))

      const hub = pos.get('HUB')
      const hasHero = m.heroIds.size > 0

      // faint peer-to-peer mesh
      ctx.lineWidth = 0.6
      ctx.strokeStyle = 'rgba(190, 210, 235, 1)'
      for (const n of m.nodes) {
        const a = pos.get(n.id)
        if (!a) continue
        const ns = m.neighbors.get(n.id)
        if (!ns) continue
        for (const nb of ns) {
          const b = pos.get(nb)
          if (!b) continue
          ctx.globalAlpha = 0.05
          ctx.beginPath()
          ctx.moveTo(a.x, a.y)
          ctx.lineTo(b.x, b.y)
          ctx.stroke()
        }
      }
      // links to the grid hub
      if (hub) {
        for (const n of m.nodes) {
          if (n.side === 'hub') continue
          const a = pos.get(n.id)
          if (!a) continue
          ctx.strokeStyle = n.side === 'consumer' ? color.consumption : color.production
          ctx.globalAlpha = 0.04
          ctx.beginPath()
          ctx.moveTo(a.x, a.y)
          ctx.lineTo(hub.x, hub.y)
          ctx.stroke()
        }
      }
      ctx.globalAlpha = 1

      // active transfers
      const live: ActiveEdge[] = []
      for (const e of m.edges) {
        const s = pos.get(e.fromId)
        const en = pos.get(e.toId)
        if (!s || !en) continue
        const elapsed = now - e.start
        const keep = e.spotlight
          ? m.heroIds.has(e.fromId) && m.heroIds.has(e.toId)
          : elapsed <= e.durationMs
        if (!keep) continue
        live.push(e)

        const c = e.spotlight ? color.market : color.production
        ctx.strokeStyle = c
        ctx.globalAlpha = e.spotlight ? 0.55 : 0.25
        ctx.lineWidth = e.spotlight ? 2.2 : 1.3
        ctx.beginPath()
        const STEPS = 26
        for (let i = 0; i <= STEPS; i++) {
          const pt = edgePoint(s, en, i / STEPS)
          if (i === 0) ctx.moveTo(pt.x, pt.y)
          else ctx.lineTo(pt.x, pt.y)
        }
        ctx.stroke()

        if (!reduced) {
          const count = e.spotlight ? 4 : 2
          const base = e.spotlight ? (elapsed / e.durationMs) % 1 : Math.min(1, elapsed / e.durationMs)
          for (let i = 0; i < count; i++) {
            const t = e.spotlight ? (base + i / count) % 1 : Math.max(0, base - i * 0.12)
            if (!e.spotlight && t <= 0) continue
            const pt = edgePoint(s, en, t)
            ctx.globalAlpha = (e.spotlight ? 0.95 : 0.7) * Math.max(0.15, Math.sin(Math.PI * t))
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
        const p = pos.get(n.id)
        if (!p) continue
        const hero = m.heroIds.has(n.id)
        const isHub = n.side === 'hub'
        const c = sideColor(n.side)
        const r = isHub ? 6.5 : hero ? 6 : 1.8
        const alpha = hero || isHub ? 1 : hasHero ? 0.4 : 0.9

        if ((hero || isHub) && !reduced) {
          const pulse = (Math.sin(now / 320) + 1) / 2
          ctx.globalAlpha = 0.16 + 0.2 * pulse
          ctx.fillStyle = c
          ctx.beginPath()
          ctx.arc(p.x, p.y, r + 6 + pulse * 5, 0, Math.PI * 2)
          ctx.fill()
        }
        drawNodeGlow(p.x, p.y, r, c, alpha)

        if (hero || isHub) {
          ctx.globalAlpha = 1
          ctx.strokeStyle = '#0a0e14'
          ctx.lineWidth = 1.5
          ctx.beginPath()
          ctx.arc(p.x, p.y, r, 0, Math.PI * 2)
          ctx.stroke()
        }
      }
      ctx.globalAlpha = 1
    }

    let raf = 0
    if (reduced) {
      frame(performance.now())
    } else {
      const loop = (t: number) => {
        frame(t)
        raf = requestAnimationFrame(loop)
      }
      raf = requestAnimationFrame(loop)
    }
    return () => {
      cancelAnimationFrame(raf)
      ro.disconnect()
    }
  }, [model, reduced])

  // tooltip target: hovered node, else the spotlight hero (seller)
  const tipId = hovered ?? heroIds[0] ?? null
  const tipNode = tipId ? roster.find((n) => n.id === tipId) : null
  const tipPos = tipId ? projectedRef.current.get(tipId) : null
  const tipReading = tipId ? readings[tipId] : undefined

  return (
    <section className="panel relative h-full overflow-hidden p-0" data-spotlight="network">
      <div ref={wrapRef} className="absolute inset-0">
        <div ref={mapDivRef} className="absolute inset-0" />
        {offline && (
          <div
            className="absolute inset-0"
            style={{
              background:
                'radial-gradient(1000px 600px at 50% 80%, rgba(16,185,129,0.06), transparent 60%), linear-gradient(180deg,#0b1018,#0a0e14)',
            }}
          />
        )}
        <canvas ref={canvasRef} className="pointer-events-none absolute inset-0" />
      </div>

      {/* header chrome */}
      <div className="pointer-events-none absolute left-4 top-3 flex items-center gap-2.5">
        <h3 className="text-base font-semibold tracking-tight text-slate-50">Peer Network Map</h3>
        <span className="inline-flex items-center gap-1 rounded-full border border-production/40 bg-production/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-production">
          <Radio className="h-2.5 w-2.5" /> Live
        </span>
      </div>
      <p className="pointer-events-none absolute left-4 top-9 text-2xs text-slate-400">
        Bengaluru · real-time geospatial distribution of active energy peers
      </p>

      {/* controls */}
      <div className="absolute right-3 top-3 flex gap-1.5">
        <MapBtn label="Zoom in" onClick={() => mapRef.current?.zoomIn()}>
          <ZoomIn className="h-3.5 w-3.5" />
        </MapBtn>
        <MapBtn label="Zoom out" onClick={() => mapRef.current?.zoomOut()}>
          <ZoomOut className="h-3.5 w-3.5" />
        </MapBtn>
        <MapBtn
          label="Reset view"
          onClick={() =>
            mapRef.current?.flyTo({ center: [BLR_CENTER.lng, BLR_CENTER.lat], zoom: 11.2, pitch: 52, bearing: -18 })
          }
        >
          <Layers className="h-3.5 w-3.5" />
        </MapBtn>
      </div>

      {/* legend */}
      <div className="absolute bottom-3 right-3 rounded-md border border-slate-700/60 bg-slate-950/75 px-3 py-2 backdrop-blur-sm">
        <LegendRow c={color.consumption} label="Consumer Node" />
        <LegendRow c={color.production} label="Producer / Prosumer (Supply)" />
        <LegendRow c={color.market} label="Grid Hub" />
      </div>

      {/* node tooltip */}
      {tipNode && tipPos && (
        <div
          className="pointer-events-none absolute z-10 -translate-x-1/2 -translate-y-full rounded-md border border-slate-700/70 bg-slate-950/85 px-3 py-2 backdrop-blur-sm"
          style={{ left: tipPos.x, top: tipPos.y - 14 }}
        >
          <div className="text-2xs font-semibold text-slate-100">{tipNode.name}</div>
          <div className="text-[10px] text-slate-400">
            {tipNode.area ?? 'Bengaluru'} · {tipNode.id}
          </div>
          <div className="mt-1 tabular text-2xs text-production">
            {tipNode.side === 'consumer' ? 'Demand' : 'Output'}:{' '}
            {(tipReading?.energy ?? tipNode.capacityKw).toFixed(1)} kW
          </div>
          <div className="mt-1 h-0.5 w-full overflow-hidden rounded bg-slate-800">
            <div
              className="h-full bg-production"
              style={{
                width: `${Math.min(100, ((tipReading?.energy ?? tipNode.capacityKw) / Math.max(1, tipNode.capacityKw)) * 100)}%`,
              }}
            />
          </div>
        </div>
      )}

      {roster.length === 0 && (
        <div className="absolute inset-0 flex items-center justify-center text-2xs text-slate-500">
          awaiting network roster…
        </div>
      )}
    </section>
  )
}

function MapBtn({ children, onClick, label }: { children: React.ReactNode; onClick: () => void; label: string }) {
  return (
    <button
      onClick={onClick}
      aria-label={label}
      title={label}
      className="inline-flex h-7 w-7 items-center justify-center rounded border border-slate-700/70 bg-slate-950/75 text-slate-300 backdrop-blur-sm transition-colors hover:bg-slate-800 hover:text-slate-100"
    >
      {children}
    </button>
  )
}

function LegendRow({ c, label }: { c: string; label: string }) {
  return (
    <div className="flex items-center gap-2 py-0.5 text-[10px] text-slate-300">
      <span className="inline-block h-2 w-2 rounded-full" style={{ background: c }} />
      {label}
    </div>
  )
}
