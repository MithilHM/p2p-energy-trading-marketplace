/**
 * The brain of the guided simulator. A small state machine over the stage list
 * that: owns the transport subscription, folds events into `DemoEventState`,
 * fires each stage's backend cue on entry, and exposes a clean control API to
 * the view. Pacing is manual — stages advance on next()/back().
 */
import { useCallback, useMemo, useReducer, useRef, useState } from 'react'
import type { DemoEvent, DemoEventState } from './events'
import { emptyState } from './events'
import { reduceEvent } from './eventReducer'
import { STAGES } from './stages'
import type { SpotlightTarget } from './stages'
import { useOrchestrator } from './useOrchestrator'
import { useVoiceAlerts } from './useVoiceAlerts'

export type DemoStatus = 'idle' | 'running' | 'paused' | 'done'

type Action = DemoEvent | { type: '__reset' }

function rootReducer(s: DemoEventState, a: Action): DemoEventState {
  if (a.type === '__reset') return emptyState()
  return reduceEvent(s, a)
}

const LAST = STAGES.length - 1

export function useDemoOrchestrator() {
  const [events, dispatch] = useReducer(rootReducer, undefined, emptyState)
  const [status, setStatus] = useState<DemoStatus>('idle')
  const [stageIndex, setStageIndex] = useState(0)
  const firedRef = useRef<Set<number>>(new Set())

  const voice = useVoiceAlerts()

  const { state: conn, connect, cue, disconnect } = useOrchestrator((e: DemoEvent) => {
    voice.announce(e)
    dispatch(e)
  })

  const fireCue = useCallback(
    (idx: number) => {
      const stage = STAGES[idx]
      if (stage?.cue && !firedRef.current.has(idx)) {
        firedRef.current.add(idx)
        cue(stage.cue)
      }
    },
    [cue]
  )

  const run = useCallback(async () => {
    firedRef.current.clear()
    dispatch({ type: '__reset' })
    setStatus('running')
    setStageIndex(0)
    await connect()
    fireCue(0)
  }, [connect, fireCue])

  const next = useCallback(() => {
    setStageIndex((i) => {
      if (i >= LAST) {
        setStatus('done')
        return i
      }
      const n = i + 1
      fireCue(n)
      return n
    })
  }, [fireCue])

  const back = useCallback(() => {
    setStatus('running')
    setStageIndex((i) => Math.max(0, i - 1))
  }, [])

  const goTo = useCallback(
    (i: number) => {
      const target = Math.max(0, Math.min(LAST, i))
      setStatus('running')
      // fire cues for every stage up to the target so prerequisites
      // (run → spotlight → step) are satisfied; firedRef dedupes.
      for (let j = 0; j <= target; j++) fireCue(j)
      setStageIndex(target)
    },
    [fireCue]
  )

  const pause = useCallback(() => {
    setStatus('paused')
    cue('pause')
  }, [cue])

  const play = useCallback(() => {
    setStatus('running')
    cue('resume')
  }, [cue])

  const skip = useCallback(() => {
    setStatus('done')
    cue('resume')
  }, [cue])

  const replay = useCallback(async () => {
    cue('reset')
    disconnect()
    void run()
  }, [cue, disconnect, run])

  const stage = STAGES[stageIndex]
  const inGuide = status === 'running' || status === 'paused'

  const spotlightTarget: SpotlightTarget = inGuide ? stage.spotlight : null
  const ready = useMemo(() => (inGuide ? stage.ready(events) : true), [inGuide, stage, events])

  return {
    status,
    conn,
    stageIndex,
    total: STAGES.length,
    stage,
    spotlightTarget,
    ready,
    dialog: { title: stage.title, body: stage.body },
    events,
    voice,
    controls: { run, next, back, goTo, pause, play, skip, replay },
  }
}
