/** Pure geometry helpers for the network canvas. Reuses the cubic-bezier
 *  sampler from the original flow renderer so transfer curves match the
 *  platform's established visual language. */
import { bezier } from '../flow/flowMath'
import type { Pt } from '../flow/flowMath'
import type { RosterNode } from '../../demo/events'

export type { Pt }

/** Normalize a roster coord to 0..1 (backend sends 0..100, replay sends 0..1). */
export function norm(v: number): number {
  return v > 1.0001 ? v / 100 : v
}

export interface ProjectedNode {
  id: string
  name: string
  area?: string
  side: RosterNode['side']
  kind: RosterNode['kind']
  nx: number // normalized 0..1 (fallback layout)
  ny: number
  lng?: number
  lat?: number
  capacityKw: number
}

export function projectRoster(nodes: RosterNode[]): ProjectedNode[] {
  return nodes.map((n) => ({
    id: n.id,
    name: n.name,
    area: n.area,
    side: n.side,
    kind: n.kind,
    nx: norm(n.x),
    ny: norm(n.y),
    lng: n.lng,
    lat: n.lat,
    capacityKw: n.capacityKw,
  }))
}

/** Precompute up to k nearest neighbours per node (by normalized coords) to
 *  draw the faint peer-to-peer mesh. Excludes the hub. */
export function computeNeighbors(nodes: ProjectedNode[], k = 2): Map<string, string[]> {
  const peers = nodes.filter((n) => n.side !== 'hub')
  const out = new Map<string, string[]>()
  for (const a of peers) {
    const dists = peers
      .filter((b) => b.id !== a.id)
      .map((b) => ({ id: b.id, d: (a.nx - b.nx) ** 2 + (a.ny - b.ny) ** 2 }))
      .sort((p, q) => p.d - q.d)
      .slice(0, k)
      .map((p) => p.id)
    out.set(a.id, dists)
  }
  return out
}

/** Sample the smooth S-curve between two pixel points at t∈[0,1]. */
export function edgePoint(s: Pt, e: Pt, t: number): Pt {
  const dx = e.x - s.x
  const bend = Math.max(50, Math.abs(dx) * 0.4)
  const c1 = { x: s.x + bend, y: s.y }
  const c2 = { x: e.x - bend, y: e.y }
  return bezier(s, c1, c2, e, t)
}
