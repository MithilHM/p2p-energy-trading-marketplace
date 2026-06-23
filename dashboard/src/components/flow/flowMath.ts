import type { FlowLink, FlowNode } from '../../data/types'

/** Design-space dimensions for the flow canvas. The container is locked to
 *  this aspect ratio so normalized node coords map 1:1 to both SVG units and
 *  HTML percentages. */
export const VB = { w: 1000, h: 460 }

export interface Pt {
  x: number
  y: number
}

export interface ResolvedLink {
  link: FlowLink
  from: FlowNode
  to: FlowNode
  d: string
  c0: Pt
  c1: Pt
  c2: Pt
  c3: Pt
  /** particle count scaled by flow magnitude */
  particles: number
  /** stroke width scaled by flow */
  width: number
}

function toSvg(n: FlowNode): Pt {
  return { x: n.x * VB.w, y: n.y * VB.h }
}

/** Sample a cubic bezier at parameter t∈[0,1]. */
export function bezier(c0: Pt, c1: Pt, c2: Pt, c3: Pt, t: number): Pt {
  const mt = 1 - t
  const a = mt * mt * mt
  const b = 3 * mt * mt * t
  const c = 3 * mt * t * t
  const d = t * t * t
  return {
    x: a * c0.x + b * c1.x + c * c2.x + d * c3.x,
    y: a * c0.y + b * c1.y + c * c2.y + d * c3.y,
  }
}

/** Build a smooth horizontal S-curve between two nodes and pre-compute the
 *  control points (reused by the particle sampler). */
export function resolveLink(link: FlowLink, nodes: Record<string, FlowNode>): ResolvedLink | null {
  const from = nodes[link.from]
  const to = nodes[link.to]
  if (!from || !to) return null

  const s = toSvg(from)
  const e = toSvg(to)
  const dx = e.x - s.x
  const bend = Math.max(80, Math.abs(dx) * 0.45)

  const c0 = s
  const c1 = { x: s.x + bend, y: s.y }
  const c2 = { x: e.x - bend, y: e.y }
  const c3 = e

  const d = `M ${c0.x} ${c0.y} C ${c1.x} ${c1.y} ${c2.x} ${c2.y} ${c3.x} ${c3.y}`

  return {
    link,
    from,
    to,
    d,
    c0,
    c1,
    c2,
    c3,
    particles: Math.max(2, Math.min(6, Math.round(link.flow / 80))),
    width: Math.max(1.5, Math.min(6, link.flow / 90)),
  }
}
