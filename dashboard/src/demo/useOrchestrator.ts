/**
 * Transport hook. Tries the live orchestrator WS first; on failure (or ~1.5s
 * with no connection) transparently falls back to the deterministic offline
 * replay. Either way the consumer just receives a normalized `DemoEvent` stream
 * and a `cue()` to drive the /demo control surface.
 */
import { useCallback, useEffect, useRef, useState } from 'react'
import type { DemoEvent } from './events'
import { connectLive } from './orchestratorClient'
import { createReplay } from './replay'
import type { CueName, Source, Transport } from './transport'

export type ConnState = 'offline' | 'connecting' | Source

export function useOrchestrator(onEvent: (e: DemoEvent) => void) {
  const emitRef = useRef(onEvent)
  emitRef.current = onEvent

  const transportRef = useRef<Transport | null>(null)
  const [state, setState] = useState<ConnState>('offline')

  const emit = useCallback((e: DemoEvent) => emitRef.current(e), [])

  const connect = useCallback(async () => {
    if (transportRef.current) return
    setState('connecting')
    const live = await connectLive(emit)
    if (transportRef.current) return // a parallel connect already won
    if (live) {
      transportRef.current = live
      setState('live')
    } else {
      transportRef.current = createReplay({ emit, now: () => Date.now() })
      setState('replay')
    }
  }, [emit])

  const cue = useCallback((name: CueName, payload?: unknown) => {
    transportRef.current?.cue(name, payload)
  }, [])

  const disconnect = useCallback(() => {
    transportRef.current?.close()
    transportRef.current = null
    setState('offline')
  }, [])

  useEffect(() => () => transportRef.current?.close(), [])

  return { state, connect, cue, disconnect }
}
