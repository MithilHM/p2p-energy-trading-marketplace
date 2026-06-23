/** Shared transport contract for both live (WS) and offline (replay) sources. */
import type { DemoEvent } from './events'

export type CueName = 'run' | 'reset' | 'step' | 'spotlight' | 'pause' | 'resume'

export type Source = 'live' | 'replay'

export interface Transport {
  source: Source
  /** mirror of the orchestrator's /demo control surface */
  cue: (name: CueName, payload?: unknown) => void
  close: () => void
}

export type EmitFn = (e: DemoEvent) => void
