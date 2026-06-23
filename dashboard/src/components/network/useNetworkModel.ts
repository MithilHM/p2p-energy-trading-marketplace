/**
 * Holds the mutable model the canvas RAF loop reads each frame: projected nodes
 * (by id), and a capped ring buffer of active transfer edges. New transfers are
 * promoted to active edges (spotlight ones jump the queue); they self-expire
 * when their animation completes. Kept in a ref so the draw loop sees the latest
 * data without re-subscribing or re-rendering React.
 */
import { useEffect, useRef } from 'react'
import type { ActiveTransfer, RosterNode } from '../../demo/events'
import { computeNeighbors, projectRoster } from './layout'
import type { ProjectedNode } from './layout'

const MAX_ACTIVE_EDGES = 24

export interface ActiveEdge {
  key: string
  fromId: string
  toId: string
  spotlight: boolean
  /** performance.now() when promoted */
  start: number
  durationMs: number
}

export interface NetworkModel {
  nodes: ProjectedNode[]
  byId: Map<string, ProjectedNode>
  neighbors: Map<string, string[]>
  edges: ActiveEdge[]
  heroIds: Set<string>
}

const transferKey = (t: ActiveTransfer) => `${t.tradeId}:${t.startedAt}`

export function useNetworkModel(roster: RosterNode[], transfers: ActiveTransfer[], heroIds: string[]) {
  const modelRef = useRef<NetworkModel>({
    nodes: [], byId: new Map(), neighbors: new Map(), edges: [], heroIds: new Set(),
  })
  const seenRef = useRef<Set<string>>(new Set())

  // roster identity → reproject nodes + recompute mesh neighbours
  useEffect(() => {
    const nodes = projectRoster(roster)
    modelRef.current.nodes = nodes
    modelRef.current.byId = new Map(nodes.map((n) => [n.id, n]))
    modelRef.current.neighbors = computeNeighbors(nodes, 2)
  }, [roster])

  // hero set
  useEffect(() => {
    modelRef.current.heroIds = new Set(heroIds)
  }, [heroIds])

  // promote any newly-seen transfers to active edges
  useEffect(() => {
    const now = performance.now()
    for (const t of transfers) {
      const key = transferKey(t)
      if (seenRef.current.has(key)) continue
      seenRef.current.add(key)
      const edge: ActiveEdge = {
        key,
        fromId: t.fromId,
        toId: t.toId,
        spotlight: t.spotlight,
        start: now,
        durationMs: t.durationMs || 2600,
      }
      const edges = modelRef.current.edges
      edges.push(edge)
      // cap: drop oldest non-spotlight first
      if (edges.length > MAX_ACTIVE_EDGES) {
        const idx = edges.findIndex((e) => !e.spotlight)
        edges.splice(idx >= 0 ? idx : 0, 1)
      }
    }
    // keep seen set bounded
    if (seenRef.current.size > 512) seenRef.current = new Set([...seenRef.current].slice(-256))
  }, [transfers])

  return modelRef
}
